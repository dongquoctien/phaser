import Phaser from 'phaser';
import { SceneKeys, Tex, Anim, Reg, Ev, Audio as AK } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { LEVELS, TILE, type LevelData } from '../levels';
import { Hero } from '../objects/Hero';
import { Shuriken } from '../objects/Shuriken';
import { buildBackground } from '../systems/background';
import { AudioSystem } from '../systems/Audio';

const STAR_POINTS = 100;
const COIN_POINTS = 25;
const START_LIVES = 3;

export class GameScene extends Phaser.Scene {
  private hero!: Hero;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private blocks!: Phaser.Physics.Arcade.StaticGroup;
  private stars!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private robots!: Phaser.Physics.Arcade.Group;
  private shurikens!: Phaser.Physics.Arcade.Group;
  private door!: Phaser.Physics.Arcade.Image;
  private emitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private audio!: AudioSystem;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyJump!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private touchLeft = false;
  private touchRight = false;
  private touchJump = false;
  private prevTouchJump = false;

  private levelIndex = 0;
  private cleared = false;
  private dead = false;
  private deathLine = 9999;

  constructor() {
    super(SceneKeys.Game);
  }

  init(data: { level?: number; resetProgress?: boolean }): void {
    this.levelIndex = data.level ?? 0;
    this.cleared = false;
    this.dead = false;
    if (data.resetProgress || this.registry.get(Reg.Lives) == null) {
      this.registry.set(Reg.Score, 0);
      this.registry.set(Reg.Stars, 0);
      this.registry.set(Reg.Lives, START_LIVES);
    }
  }

  create(): void {
    const level = LEVELS[this.levelIndex];
    const worldW = level.widthTiles * TILE;
    const worldH = level.heightTiles * TILE;

    // Physics bounds extend below the visible floor so the hero can fall into
    // pits (triggering a life-loss); the camera stays clamped to the level.
    this.physics.world.setBounds(0, 0, worldW, worldH + 200);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.deathLine = worldH + 8;

    this.audio = new AudioSystem(this);
    buildBackground(this, worldW, worldH);
    this.buildLevel(level);
    this.setupInput();
    this.setupParticles();
    this.audio.playMusic(AK.BgmGame);

    // HUD overlay runs in parallel.
    this.scene.launch(SceneKeys.Hud);
    this.emitHud();

    // Camera follows the hero with a deadzone (smooth, not jittery).
    this.cameras.main.startFollow(this.hero, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(80, 60);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  // -------------------------------------------------------------------------
  private buildLevel(level: LevelData): void {
    // Platforms — built from 16px tiles laid in horizontal runs.
    this.platforms = this.physics.add.staticGroup();
    for (const [tx, ty, len] of level.platforms) {
      for (let i = 0; i < len; i++) {
        const img = this.platforms.create(
          (tx + i) * TILE + TILE / 2,
          ty * TILE + TILE / 2,
          Tex.TileTop,
        ) as Phaser.Physics.Arcade.Image;
        img.refreshBody();
      }
    }

    // ? blocks.
    this.blocks = this.physics.add.staticGroup();
    for (const b of level.blocks) {
      const img = this.blocks.create(b.x, b.y, Tex.Block) as Phaser.Physics.Arcade.Image;
      img.setData('used', false);
      img.refreshBody();
    }

    // Collectibles.
    this.stars = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const s of level.stars) {
      const star = this.stars.create(s.x, s.y, Tex.Star) as Phaser.Physics.Arcade.Sprite;
      star.play(Anim.StarSpin);
      this.bobble(star);
    }
    this.coins = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const c of level.coins) {
      const coin = this.coins.create(c.x, c.y, Tex.Coin) as Phaser.Physics.Arcade.Sprite;
      coin.play(Anim.CoinSpin);
    }

    // Robots — sit on a surface, gravity-bound, immovable horizontally.
    this.robots = this.physics.add.group();
    for (const r of level.robots) {
      const robot = this.robots.create(r.x, r.y, Tex.Robot) as Phaser.Physics.Arcade.Sprite;
      robot.setOrigin(0.5, 1);
      (robot.body as Phaser.Physics.Arcade.Body).setSize(12, 13).setOffset(2, 3);
      robot.play(Anim.RobotIdle);
    }

    // Shuriken hazards (pooled group).
    this.shurikens = this.physics.add.group({ classType: Shuriken, runChildUpdate: true });
    for (const s of level.shurikens) {
      const sh = this.shurikens.get(s.x, s.y) as Shuriken;
      if (sh) sh.launch(s.x, s.y, s.range, s.speed);
    }

    // Exit door.
    this.door = this.physics.add.staticImage(level.exit.x, level.exit.y, Tex.Door);
    this.door.setOrigin(0.5, 1).refreshBody();

    // Hero.
    this.hero = new Hero(this, level.spawn.x, level.spawn.y);
    this.hero.on('landed', () => { this.dust(this.hero.x, this.hero.y); this.audio.play(AK.Land); });
    this.hero.on('jumped', () => { this.dust(this.hero.x, this.hero.y); this.audio.playPitched(AK.Jump); });
    this.hero.on('step', () => this.audio.play(AK.Footstep));

    // Colliders.
    this.physics.add.collider(this.hero, this.platforms);
    this.physics.add.collider(this.robots, this.platforms);
    this.physics.add.collider(this.hero, this.blocks, this.onBlockHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);

    // Overlaps.
    this.physics.add.overlap(this.hero, this.stars, this.collectStar as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.hero, this.coins, this.collectCoin as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.hero, this.robots, this.hitRobot as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.hero, this.shurikens, this.hitHazard as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.hero, this.door, this.reachExit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
  }

  private bobble(obj: Phaser.GameObjects.Sprite): void {
    this.tweens.add({ targets: obj, y: obj.y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  // -------------------------------------------------------------------------
  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyJump = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);

    // On-screen touch controls (mobile). Recompute every frame in update(),
    // never inside pointermove — that's the joystick-lag anti-pattern.
    this.buildTouchControls();
  }

  private buildTouchControls(): void {
    const hud = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    const mk = (x: number, label: string, w = 52) => {
      const z = this.add.zone(x, GAME_HEIGHT - 30, w, 52).setOrigin(0.5).setScrollFactor(0).setInteractive();
      const g = this.add.rectangle(x, GAME_HEIGHT - 30, w, 52, 0xffffff, 0.12).setScrollFactor(0).setStrokeStyle(1, 0xffffff, 0.3);
      const t = this.add.text(x, GAME_HEIGHT - 30, label, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0);
      hud.add([g, t]);
      return z;
    };
    const lz = mk(26, '◀');
    const rz = mk(84, '▶');
    const jz = mk(GAME_WIDTH - 36, '⤒', 64);
    lz.on('pointerdown', () => (this.touchLeft = true));
    lz.on('pointerup', () => (this.touchLeft = false));
    lz.on('pointerout', () => (this.touchLeft = false));
    rz.on('pointerdown', () => (this.touchRight = true));
    rz.on('pointerup', () => (this.touchRight = false));
    rz.on('pointerout', () => (this.touchRight = false));
    jz.on('pointerdown', () => (this.touchJump = true));
    jz.on('pointerup', () => (this.touchJump = false));
    jz.on('pointerout', () => (this.touchJump = false));
    hud.add([lz, rz, jz]);
    this.input.addPointer(2); // multitouch: move + jump at once
  }

  private setupParticles(): void {
    this.emitter = this.add.particles(0, 0, Tex.Spark, {
      lifespan: 380,
      speed: { min: 30, max: 90 },
      scale: { start: 1, end: 0 },
      gravityY: 200,
      emitting: false,
    });
    this.emitter.setDepth(50);
  }

  private dust(x: number, y: number): void {
    this.emitter.emitParticleAt(x, y, 4);
  }

  // -------------------------------------------------------------------------
  // Callbacks
  private onBlockHit(hero: Hero, block: Phaser.Physics.Arcade.Image): void {
    // Only "hit" when rising into the block from below.
    if (hero.body.velocity.y >= 0 || block.getData('used')) return;
    if (hero.y - 12 < block.y) return; // hero head must be near the block bottom
    block.setData('used', true);
    block.setTexture(Tex.BlockUsed);
    this.cameras.main.shake(120, 0.004);
    this.audio.play(AK.BlockPay);
    this.emitter.emitParticleAt(block.x, block.y - 8, 8);

    // Pop a star out the top.
    const star = this.stars.create(block.x, block.y - 16, Tex.Star) as Phaser.Physics.Arcade.Sprite;
    star.play(Anim.StarSpin);
    (star.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    star.setVelocityY(-180);
    this.time.delayedCall(120, () => {
      (star.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      star.setVelocity(0, 0);
      this.bobble(star);
    });
  }

  private collectStar(_hero: Hero, star: Phaser.Physics.Arcade.Sprite): void {
    star.destroy();
    this.registry.inc(Reg.Score, STAR_POINTS);
    this.registry.inc(Reg.Stars, 1);
    this.audio.play(AK.Star);
    this.cameras.main.flash(80, 80, 60, 20);
    this.emitter.emitParticleAt(star.x, star.y, 6);
    this.popText(star.x, star.y, `+${STAR_POINTS}`, '#ffd23f');
    this.emitHud();
  }

  private collectCoin(_hero: Hero, coin: Phaser.Physics.Arcade.Sprite): void {
    coin.destroy();
    this.registry.inc(Reg.Score, COIN_POINTS);
    this.audio.playPitched(AK.Coin);
    this.emitter.emitParticleAt(coin.x, coin.y, 3);
    this.emitHud();
  }

  private hitRobot(hero: Hero, robot: Phaser.Physics.Arcade.Sprite): void {
    if (hero.dead || hero.invuln > 0) return;
    const stomping = hero.body.velocity.y > 40 && hero.y < robot.y - 6;
    if (stomping) {
      robot.destroy();
      hero.bounce();
      this.audio.play(AK.BotHit);
      this.registry.inc(Reg.Score, COIN_POINTS * 2);
      this.cameras.main.shake(100, 0.005);
      this.emitter.emitParticleAt(robot.x, robot.y - 6, 10);
      this.popText(robot.x, robot.y - 16, '+50', '#7fd6da');
      this.emitHud();
    } else {
      this.damageHero(robot.x);
    }
  }

  private hitHazard(hero: Hero, _sh: Phaser.GameObjects.GameObject): void {
    if (hero.dead || hero.invuln > 0) return;
    this.damageHero((_sh as Phaser.Physics.Arcade.Sprite).x);
  }

  private damageHero(fromX: number): void {
    const hero = this.hero;
    hero.hurtFrom(fromX);
    this.audio.play(AK.Hurt);
    this.cameras.main.shake(180, 0.01);
    this.cameras.main.flash(120, 120, 20, 40);
    const lives = (this.registry.get(Reg.Lives) as number) - 1;
    this.registry.set(Reg.Lives, lives);
    this.emitHud();
    if (lives <= 0) this.gameOver();
  }

  private hitFell(): void {
    // Fell into a pit.
    if (this.dead) return;
    this.registry.set(Reg.Lives, (this.registry.get(Reg.Lives) as number) - 1);
    this.emitHud();
    if ((this.registry.get(Reg.Lives) as number) <= 0) {
      this.gameOver();
    } else {
      this.scene.restart({ level: this.levelIndex });
    }
  }

  private reachExit(): void {
    if (this.cleared) return;
    this.cleared = true;
    this.hero.setVelocity(0, 0);
    this.physics.pause();
    this.cameras.main.flash(200, 255, 255, 255);
    this.audio.stopMusic();
    this.audio.play(AK.LevelClear);

    const isLast = this.levelIndex >= LEVELS.length - 1;
    this.saveBest();
    this.time.delayedCall(700, () => {
      if (isLast) {
        this.scene.stop(SceneKeys.Hud);
        this.scene.start(SceneKeys.Menu, { won: true, score: this.registry.get(Reg.Score) });
      } else {
        this.scene.restart({ level: this.levelIndex + 1 });
      }
    });
  }

  private gameOver(): void {
    if (this.dead) return;
    this.dead = true;
    this.hero.die();
    this.physics.world.gravity.y = 900;
    this.saveBest();
    this.audio.stopMusic();
    this.audio.play(AK.GameOver);
    this.cameras.main.shake(300, 0.012);
    this.time.delayedCall(1100, () => {
      this.scene.stop(SceneKeys.Hud);
      this.scene.start(SceneKeys.Menu, { gameOver: true, score: this.registry.get(Reg.Score) });
    });
  }

  private saveBest(): void {
    const score = this.registry.get(Reg.Score) as number;
    const best = Number(localStorage.getItem(Reg.Best) || 0);
    if (score > best) localStorage.setItem(Reg.Best, String(score));
  }

  private popText(x: number, y: number, msg: string, color: string): void {
    const t = this.add.text(x, y, msg, { fontFamily: 'monospace', fontSize: '10px', color }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: y - 16, alpha: 0, duration: 600, onComplete: () => t.destroy() });
  }

  private emitHud(): void {
    this.game.events.emit(Ev.ScoreChanged, this.registry.get(Reg.Score));
    this.game.events.emit(Ev.StarsChanged, this.registry.get(Reg.Stars));
    this.game.events.emit(Ev.LivesChanged, this.registry.get(Reg.Lives));
  }

  // -------------------------------------------------------------------------
  update(_time: number, deltaMs: number): void {
    if (this.cleared) return;

    const left = this.cursors.left.isDown || this.keyA.isDown || this.touchLeft;
    const right = this.cursors.right.isDown || this.keyD.isDown || this.touchRight;
    const jumpHeld = this.cursors.up.isDown || this.keyJump.isDown || this.keyW.isDown || this.touchJump;
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keyJump) ||
      Phaser.Input.Keyboard.JustDown(this.keyW) ||
      (this.touchJump && !this.prevTouchJump);
    this.prevTouchJump = this.touchJump;

    this.hero.control(left, right, jumpPressed, jumpHeld, deltaMs);

    // Fell into a pit (below the visible floor).
    if (!this.dead && !this.cleared && this.hero.y > this.deathLine) {
      this.hitFell();
    }
  }

  private cleanup(): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.hero?.removeAllListeners();
  }
}
