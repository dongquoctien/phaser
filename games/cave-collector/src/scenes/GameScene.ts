import Phaser from 'phaser';
import { SceneKeys, Tex, Anim, Reg, Ev, Audio as AK, Icon } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { TILE, type LevelData } from '../levels';
import { STORY_LEVELS, genEndlessLevel } from '../systems/levelGen';
import { Hero } from '../objects/Hero';
import { Shuriken } from '../objects/Shuriken';
import { Robot } from '../objects/Robot';
import { Slime } from '../objects/Slime';
import { Beetle } from '../objects/Beetle';
import { Bat } from '../objects/Bat';
import { Boss } from '../objects/Boss';
import { buildBackground } from '../systems/background';
import { AudioSystem } from '../systems/Audio';
import { Api } from '../systems/Api';
import { Storage } from '../systems/Storage';

export type GameMode = 'story' | 'endless';

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
  private slimes!: Phaser.Physics.Arcade.Group;
  private beetles!: Phaser.Physics.Arcade.Group;
  private bats!: Phaser.Physics.Arcade.Group;
  private shurikens!: Phaser.Physics.Arcade.Group;
  private boss?: Boss;
  private lockHintAt = 0;
  private door!: Phaser.Physics.Arcade.Image;
  private emitter!: Phaser.GameObjects.Particles.ParticleEmitter; // spark burst (frame 0)
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter; // smoke puff (frame 2)
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
  private mode: GameMode = 'story';
  private level!: LevelData; // the active level (story slice or generated endless)

  constructor() {
    super(SceneKeys.Game);
  }

  init(data: { level?: number; resetProgress?: boolean; mode?: GameMode }): void {
    this.levelIndex = data.level ?? 0;
    this.mode = data.mode ?? this.mode ?? 'story';
    this.cleared = false;
    this.dead = false;
    if (data.resetProgress || this.registry.get(Reg.Lives) == null) {
      this.registry.set(Reg.Score, 0);
      this.registry.set(Reg.Stars, 0);
      this.registry.set(Reg.Lives, START_LIVES);
      this.registry.set(Reg.RunStart, Date.now());
      // Open a fresh leaderboard session for this run (no-op if no backend).
      void Api.startSession();
    }
    // Resolve the active level: a Story slice, or a freshly-generated endless one.
    this.level = this.mode === 'endless'
      ? genEndlessLevel(this.levelIndex, (Math.random() * 1e9) | 0)
      : STORY_LEVELS[Math.min(this.levelIndex, STORY_LEVELS.length - 1)];
  }

  create(): void {
    const level = this.level;
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

    // Robots — patrolling sentry-bots that walk their platform and turn at walls
    // / edges (Robot.ts). Rendered at 0.6 (~19px, ~1.2 tiles) to sit beside the hero.
    this.robots = this.physics.add.group({ classType: Robot, runChildUpdate: true });
    for (const r of level.robots) {
      const robot = this.robots.get(r.x, r.y) as Robot;
      if (robot) robot.spawn(r.x, r.y, this.platforms);
    }

    // Slimes — slow ground hoppers (stompable).
    this.slimes = this.physics.add.group({ classType: Slime, runChildUpdate: true });
    for (const s of level.slimes ?? []) {
      const sl = this.slimes.get(s.x, s.y) as Slime;
      if (sl) sl.spawn(s.x, s.y, this.platforms);
    }
    // Beetles — spiked patrollers (NOT stompable).
    this.beetles = this.physics.add.group({ classType: Beetle, runChildUpdate: true });
    for (const b of level.beetles ?? []) {
      const be = this.beetles.get(b.x, b.y) as Beetle;
      if (be) be.spawn(b.x, b.y, this.platforms);
    }
    // Bats — flying sweep+bob hazards (alternative to shuriken).
    this.bats = this.physics.add.group({ classType: Bat, runChildUpdate: true });
    for (const b of level.bats ?? []) {
      const bt = this.bats.get(b.x, b.y) as Bat;
      if (bt) bt.launch(b.x, b.y, b.range, b.speed);
    }

    // Shuriken hazards (pooled group).
    this.shurikens = this.physics.add.group({ classType: Shuriken, runChildUpdate: true });
    for (const s of level.shurikens) {
      const sh = this.shurikens.get(s.x, s.y) as Shuriken;
      if (sh) sh.launch(s.x, s.y, s.range, s.speed);
    }

    // Exit door — 48px frame at 0.66 (~32px, 2 tiles): a clear goal, not huge.
    // depth 2 so it always reads ABOVE the floor tiles (all at depth 0) — never
    // occluded by a tile/step drawn after it.
    this.door = this.physics.add.staticImage(level.exit.x, level.exit.y, Tex.Door);
    this.door.setScale(0.66).setOrigin(0.5, 1).setDepth(2).refreshBody();

    // BOSS — guards the Story finale's exit (last campaign level only). It hovers in
    // an arena a good stretch before the door, and the door stays LOCKED until the
    // boss is down so the fight can't be skipped.
    const isFinale = this.mode === 'story' && this.levelIndex === STORY_LEVELS.length - 1;
    if (isFinale) {
      this.boss = new Boss(this);
      // arena: ~10 tiles before the door (room to fight, hover a bit above the floor)
      this.boss.spawn(level.exit.x - 10 * TILE, level.exit.y - 2 * TILE);
      this.door.setTint(0x556677); // dimmed = locked
      this.boss.on('fire', () => this.audio.play(AK.BossLaser));
      this.boss.once('died', (bx: number, by: number) => {
        this.emitter.emitParticleAt(bx, by - 20, 24);
        this.cameras.main.shake(300, 0.012);
        this.registry.inc(Reg.Score, COIN_POINTS * 20);
        this.popText(bx, by - 30, 'BOSS DOWN!', '#ffd23f');
        this.door.clearTint(); // unlock
        this.emitHud();
      });
    }

    // Hero.
    this.hero = new Hero(this, level.spawn.x, level.spawn.y);
    this.hero.on('landed', () => { this.dust(this.hero.x, this.hero.y); this.audio.play(AK.Land); });
    this.hero.on('jumped', () => { this.dust(this.hero.x, this.hero.y); this.audio.playPitched(AK.Jump); });
    this.hero.on('step', () => this.audio.play(AK.Footstep));

    // Colliders.
    this.physics.add.collider(this.hero, this.platforms);
    this.physics.add.collider(this.robots, this.platforms);
    this.physics.add.collider(this.slimes, this.platforms);
    this.physics.add.collider(this.beetles, this.platforms);
    this.physics.add.collider(this.hero, this.blocks, this.onBlockHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);

    // Overlaps.
    this.physics.add.overlap(this.hero, this.stars, this.collectStar as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.hero, this.coins, this.collectCoin as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.hero, this.robots, this.hitGroundEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.hero, this.slimes, this.hitGroundEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.hero, this.beetles, this.hitGroundEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.hero, this.bats, this.hitHazard as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.hero, this.shurikens, this.hitHazard as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    if (this.boss) {
      this.physics.add.overlap(this.hero, this.boss, this.hitBoss as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    }
    this.physics.add.overlap(this.hero, this.door, this.reachExit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
  }

  private hitBoss(hero: Hero, boss: Phaser.Physics.Arcade.Sprite): void {
    if (hero.dead || hero.invuln > 0) return;
    const b = boss as Boss;
    const stomping = hero.body.velocity.y > 40 && hero.y < boss.y - boss.displayHeight * 0.5;
    if (stomping) {
      hero.bounce();
      this.audio.play(AK.BotHit);
      b.takeStomp(); // damages the boss; it dies after HP hits 0
    } else {
      this.damageHero(boss.x);
    }
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
    const mk = (x: number, iconKey: string, w = 52) => {
      const z = this.add.zone(x, GAME_HEIGHT - 30, w, 52).setOrigin(0.5).setScrollFactor(0).setInteractive();
      const g = this.add.rectangle(x, GAME_HEIGHT - 30, w, 52, 0xffffff, 0.12).setScrollFactor(0).setStrokeStyle(1, 0xffffff, 0.3);
      // pixelarticons arrow texture (NOT an emoji glyph — §8)
      const ic = this.add.image(x, GAME_HEIGHT - 30, iconKey).setDisplaySize(22, 22).setScrollFactor(0).setAlpha(0.85);
      hud.add([g, ic]);
      return z;
    };
    const lz = mk(26, Icon.ArrowLeft);
    const rz = mk(84, Icon.ArrowRight);
    const jz = mk(GAME_WIDTH - 36, Icon.ArrowUp, 64);
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
    // Spark burst (gold, frame 0) — block-hit / collect / stomp feedback.
    this.emitter = this.add.particles(0, 0, Tex.Spark, {
      frame: 0,
      lifespan: 380,
      speed: { min: 30, max: 90 },
      scale: { start: 1, end: 0 },
      gravityY: 200,
      emitting: false,
    });
    this.emitter.setDepth(50);

    // Foot dust (smoke cloud, frame 2) — jump + landing puff. Drifts up/out and
    // fades, no gravity, so it reads as kicked-up dust rather than a gold spark.
    this.dustEmitter = this.add.particles(0, 0, Tex.Spark, {
      frame: 2,
      lifespan: 320,
      speed: { min: 12, max: 40 },
      angle: { min: 200, max: 340 }, // up-and-outward
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      gravityY: 0,
      emitting: false,
    });
    this.dustEmitter.setDepth(49);
  }

  private dust(x: number, y: number): void {
    // Puff at the FEET (hero origin is its feet, so y is already the ground point).
    this.dustEmitter.emitParticleAt(x, y, 3);
  }

  // -------------------------------------------------------------------------
  // Callbacks
  private onBlockHit(hero: Hero, block: Phaser.Physics.Arcade.Image): void {
    // Only "hit" when the hero bonks the block from BELOW — i.e. the collision
    // is on the hero's top edge while rising. Using the physics collision
    // direction (not a y-offset guess) keeps this correct at any hero size.
    if (block.getData('used')) return;
    const fromBelow = hero.body.blocked.up || hero.body.touching.up;
    if (!fromBelow || hero.body.velocity.y > 20) return;
    block.setData('used', true);
    block.setTexture(Tex.BlockUsed);
    this.cameras.main.shake(120, 0.004);
    this.audio.play(AK.BlockPay);
    this.emitter.emitParticleAt(block.x, block.y - 8, 8);

    // Pop a star out the top — it rises a SHORT hop and settles ~1 tile above the
    // block, well within the hero's jump reach (a high float was un-collectable).
    const star = this.stars.create(block.x, block.y - 16, Tex.Star) as Phaser.Physics.Arcade.Sprite;
    star.play(Anim.StarSpin);
    const body = star.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    star.setVelocityY(-80); // small pop, not a launch
    this.time.delayedCall(140, () => {
      body.setAllowGravity(false);
      star.setVelocity(0, 0);
      star.y = block.y - 12; // settle just above the block top — collectable on the
                             // same jump that punched it (the hero is right there).
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

  // Robots + slimes are stompable; beetles (spiked) are not — landing on one still
  // hurts. The enemy carries `stompable` (Beetle = false); default true.
  private hitGroundEnemy(hero: Hero, enemy: Phaser.Physics.Arcade.Sprite): void {
    if (hero.dead || hero.invuln > 0) return;
    const stompable = (enemy as Phaser.Physics.Arcade.Sprite & { stompable?: boolean }).stompable !== false;
    const stomping = stompable && hero.body.velocity.y > 40 && hero.y < enemy.y - 6;
    if (stomping) {
      const isSlime = enemy.texture.key === Tex.Slime;
      enemy.destroy();
      hero.bounce();
      this.audio.play(isSlime ? AK.SlimeHit : AK.BotHit);
      this.registry.inc(Reg.Score, COIN_POINTS * 2);
      this.cameras.main.shake(100, 0.005);
      this.emitter.emitParticleAt(enemy.x, enemy.y - 6, 10);
      this.popText(enemy.x, enemy.y - 16, '+50', '#7fd6da');
      this.emitHud();
    } else {
      this.damageHero(enemy.x);
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
      this.scene.restart({ level: this.levelIndex, mode: this.mode });
    }
  }

  private reachExit(): void {
    if (this.cleared) return;
    // Door is locked while the finale boss is still alive — beat it first.
    if (this.boss && this.boss.active) {
      if (this.time.now > this.lockHintAt) {
        this.lockHintAt = this.time.now + 1500;
        this.popText(this.door.x, this.door.y - 40, 'DEFEAT THE BOSS!', '#ff7db0');
      }
      return;
    }
    this.cleared = true;
    this.hero.setVelocity(0, 0);
    this.physics.pause();
    this.cameras.main.flash(200, 255, 255, 255);
    this.audio.stopMusic();
    this.audio.play(AK.LevelClear);
    this.saveBest();

    // Endless never "wins" — clearing a stage just rolls into a harder one. Story
    // ends with a win screen after the last campaign level.
    const isLast = this.mode === 'story' && this.levelIndex >= STORY_LEVELS.length - 1;
    if (isLast) this.submitRun('win', STORY_LEVELS.length);
    this.time.delayedCall(700, () => {
      if (isLast) {
        this.scene.stop(SceneKeys.Hud);
        this.scene.start(SceneKeys.Menu, { won: true, score: this.registry.get(Reg.Score) });
      } else {
        this.scene.restart({ level: this.levelIndex + 1, mode: this.mode });
      }
    });
  }

  private gameOver(): void {
    if (this.dead) return;
    this.dead = true;
    this.hero.die();
    this.physics.world.gravity.y = 900;
    this.saveBest();
    this.submitRun('gameover', this.levelIndex);
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
    Storage.setBest(score);
  }

  /** Submit the finished run to the leaderboard backend (once; no-op offline). */
  private submitRun(outcome: 'win' | 'gameover', levels: number): void {
    void Api.submitRun({
      score: (this.registry.get(Reg.Score) as number) ?? 0,
      stars: (this.registry.get(Reg.Stars) as number) ?? 0,
      levels,
      outcome,
      startedAt: (this.registry.get(Reg.RunStart) as number) ?? Date.now(),
      endedAt: Date.now(),
    });
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

    // Boss laser beam — a transient hurt-zone; check overlap with the hero while live.
    const beam = this.boss?.beamZone;
    if (beam && !this.hero.dead && this.hero.invuln <= 0) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(this.hero.getBounds(), beam.getBounds())) {
        this.damageHero(this.hero.x < beam.x ? this.hero.x + 99 : this.hero.x - 99);
      }
    }

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
