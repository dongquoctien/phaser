import Phaser from 'phaser';
import { SceneKeys, Tex, Anim, RegistryKeys, type HeroId } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { LEVELS, GROUND_TOP, TILE, type LevelDef } from '../levels';
import { Player } from '../objects/Player';
import { Enemy } from '../objects/Enemy';

// ── The side-scroller ────────────────────────────────────────────────────────
// Core loop: run + jump through a level, fight enemies (warrior melee / magician
// bolts), dodge spikes, reach the flag → next level → boss → win. HP as hearts;
// death restarts the level. Emits HUD events to UIScene.
const INVULN_MS = 900;
const PROJ_SPEED = 320;

export class GameScene extends Phaser.Scene {
  private hero!: HeroId;
  private player!: Player;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private enemies: Enemy[] = [];
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private spikes!: Phaser.Physics.Arcade.StaticGroup;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private flag?: Phaser.GameObjects.Sprite;
  private boss?: Enemy;
  private bossHp = 0; private bossMaxHp = 30;
  private levelDef!: LevelDef;
  private hp = 5;
  private invulnUntil = 0;
  private cleared = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private touch = { left: false, right: false, jump: false, atk: false };

  constructor() { super(SceneKeys.Game); }

  create(): void {
    this.hero = (this.registry.get(RegistryKeys.Hero) as HeroId) ?? 'warrior';
    this.hp = (this.registry.get(RegistryKeys.Hp) as number) ?? 5;
    const levelIndex = (this.registry.get(RegistryKeys.Level) as number) ?? 0;
    this.levelDef = LEVELS[Phaser.Math.Clamp(levelIndex, 0, LEVELS.length - 1)];
    this.enemies = [];
    this.cleared = false;
    this.boss = undefined;

    const L = this.levelDef;
    this.physics.world.setBounds(0, 0, L.width, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, L.width, GAME_HEIGHT);

    this.buildBackground();
    this.buildTerrain();
    this.buildHazards();
    this.spawnEnemies();

    // player
    this.player = new Player(this, L.startX, GROUND_TOP, this.hero);
    this.physics.add.collider(this.player.sprite, this.solids);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(120, 80);

    // projectiles (magician)
    this.projectiles = this.physics.add.group({ allowGravity: false });

    // colliders / overlaps
    this.physics.add.collider(this.enemyGroup, this.solids);
    this.physics.add.overlap(this.player.sprite, this.enemyGroup, (_p, e) => this.onPlayerHit(e as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player.sprite, this.spikes, () => this.damagePlayer());
    this.physics.add.overlap(this.projectiles, this.enemyGroup, (proj, e) => this.onProjectileHit(proj as Phaser.Physics.Arcade.Sprite, e as Phaser.Physics.Arcade.Sprite));
    this.physics.add.collider(this.projectiles, this.solids, (proj) => (proj as Phaser.Physics.Arcade.Sprite).destroy());

    if (L.boss) this.spawnBoss();
    else this.buildFlag();

    this.setupInput();

    // HUD overlay
    this.scene.launch(SceneKeys.UI);
    this.emitHud();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scene.stop(SceneKeys.UI); this.tweens.killAll(); });
  }

  // ── build ──────────────────────────────────────────────────────────────────
  private buildBackground(): void {
    this.cameras.main.setBackgroundColor('#1b2240');
    // parallax hill bands
    const g = this.add.graphics().setScrollFactor(0).setDepth(-10);
    g.fillStyle(0x29366f, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x3b5dc9, 0.35).fillTriangle(0, GAME_HEIGHT, 120, 150, 240, GAME_HEIGHT);
    g.fillStyle(0x3b5dc9, 0.25).fillTriangle(160, GAME_HEIGHT, 320, 130, 480, GAME_HEIGHT);
    // crystals as far decor
    for (let i = 0; i < this.levelDef.width; i += 280) {
      this.add.image(i + 60, GROUND_TOP - 6, Tex.Crystal).setOrigin(0.5, 1).setScrollFactor(0.4).setDepth(-5).setAlpha(0.7);
    }
  }

  private buildTerrain(): void {
    this.solids = this.physics.add.staticGroup();
    const L = this.levelDef;
    // ground strip
    for (let x = 0; x < L.width; x += TILE) {
      const t = this.add.image(x, GROUND_TOP, Tex.Ground).setOrigin(0, 0);
      this.addSolid(x + TILE / 2, GROUND_TOP + TILE / 2, TILE, TILE);
      void t;
    }
    // platforms
    for (const p of L.plats) {
      for (let i = 0; i < p.w; i++) {
        this.add.image(p.x + i * TILE, p.y, Tex.Platform).setOrigin(0, 0).setDisplaySize(TILE, TILE);
      }
      this.addSolid(p.x + (p.w * TILE) / 2, p.y + 10, p.w * TILE, 14);
    }
  }

  private addSolid(cx: number, cy: number, w: number, h: number): void {
    const r = this.add.rectangle(cx, cy, w, h, 0x000000, 0);
    this.physics.add.existing(r, true);
    this.solids.add(r);
  }

  private buildHazards(): void {
    this.spikes = this.physics.add.staticGroup();
    for (const s of this.levelDef.spikes) {
      for (let i = 0; i < s.n; i++) {
        const spr = this.add.image(s.x + i * 16, s.y, Tex.Spike).setOrigin(0, 1);
        const r = this.add.rectangle(s.x + i * 16 + 8, s.y - 6, 14, 10, 0xff0000, 0);
        this.physics.add.existing(r, true);
        this.spikes.add(r);
        void spr;
      }
    }
  }

  private spawnEnemies(): void {
    this.enemyGroup = this.physics.add.group();
    for (const e of this.levelDef.enemies) {
      const enemy = new Enemy(this, e.x, e.y, e.type);
      this.enemies.push(enemy);
      this.enemyGroup.add(enemy.sprite);
    }
  }

  private spawnBoss(): void {
    const bx = this.levelDef.width - 140;
    this.boss = new Enemy(this, bx, GROUND_TOP, 'skeleton'); // reuse Enemy as a walker base
    this.boss.sprite.anims.stop();
    this.boss.sprite.play(Anim.BossMove); // demon-knight idle frames, not the skeleton anim
    this.boss.sprite.setScale(1.6);
    (this.boss.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.bossHp = this.bossMaxHp;
    this.boss.hp = 9999; // boss HP tracked separately so it survives the per-hit die()
    this.enemies.push(this.boss);
    this.enemyGroup.add(this.boss.sprite); // so projectiles/melee + contact-damage hit it
    this.physics.add.overlap(this.player.sprite, this.boss.sprite, () => this.damagePlayer());
    // boss bob/charge
    this.tweens.add({ targets: this.boss.sprite, y: GROUND_TOP - 8, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.game.events.emit('ak-boss', { hp: this.bossHp, max: this.bossMaxHp });
  }

  private buildFlag(): void {
    this.flag = this.add.sprite(this.levelDef.flagX, GROUND_TOP, Tex.Flag).setOrigin(0.5, 1);
    this.physics.add.existing(this.flag, true);
    this.physics.add.overlap(this.player.sprite, this.flag, () => this.clearLevel());
  }

  // ── input ────────────────────────────────────────────────────────────────
  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('LEFT,RIGHT,UP,A,D,W,SPACE,J,K') as never;
    kb.on('keydown-SPACE', () => this.player.queueJump(this.time.now));
    kb.on('keydown-UP', () => this.player.queueJump(this.time.now));
    kb.on('keydown-W', () => this.player.queueJump(this.time.now));
    kb.on('keydown-J', () => this.doAttack());
    kb.on('keydown-K', () => this.doAttack());
    // touch buttons via UIScene events
    this.game.events.on('ak-touch', (t: Partial<typeof this.touch>) => Object.assign(this.touch, t));
    this.game.events.on('ak-jump', () => this.player.queueJump(this.time.now));
    this.game.events.on('ak-atk', () => this.doAttack());
  }

  private doAttack(): void {
    if (!this.player.tryAttack(this.time.now)) return;
    if (this.hero === 'magician') this.castBolt();
    else this.cameras.main.shake(60, 0.003);
  }

  private castBolt(): void {
    const p = this.player.sprite;
    const proj = this.projectiles.create(p.x + this.player.facing * 18, p.y - 60, Tex.Fireball) as Phaser.Physics.Arcade.Sprite;
    proj.setVelocityX(PROJ_SPEED * this.player.facing);
    proj.setData('dmg', 2);
    this.time.delayedCall(1400, () => proj.active && proj.destroy());
  }

  // ── combat resolution ──────────────────────────────────────────────────────
  private onProjectileHit(proj: Phaser.Physics.Arcade.Sprite, eSpr: Phaser.Physics.Arcade.Sprite): void {
    const e = eSpr.getData('ref') as Enemy;
    if (!e || !e.alive) return;
    this.hitFx(eSpr.x, eSpr.y - 40);
    proj.destroy();
    this.applyEnemyDamage(e, (proj.getData('dmg') as number) ?? 2);
  }

  private applyEnemyDamage(e: Enemy, dmg: number): void {
    if (e === this.boss) {
      this.bossHp -= dmg;
      e.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(80, () => { if (e.sprite.active) { e.sprite.clearTint(); e.sprite.setTintMode(Phaser.TintModes.MULTIPLY); } });
      this.game.events.emit('ak-boss', { hp: Math.max(0, this.bossHp), max: this.bossMaxHp });
      if (this.bossHp <= 0) this.defeatBoss();
      return;
    }
    e.hurt(dmg);
  }

  private onPlayerHit(_eSpr: Phaser.Physics.Arcade.Sprite): void {
    this.damagePlayer();
  }

  private damagePlayer(): void {
    if (this.time.now < this.invulnUntil || this.cleared) return;
    this.invulnUntil = this.time.now + INVULN_MS;
    this.hp -= 1;
    this.emitHud();
    const p = this.player.sprite;
    p.setVelocityY(-180).setVelocityX(-this.player.facing * 140);
    this.cameras.main.shake(140, 0.006);
    // blink
    this.tweens.add({ targets: p, alpha: 0.3, duration: 90, yoyo: true, repeat: 4, onComplete: () => p.setAlpha(1) });
    if (this.hp <= 0) this.die();
  }

  private hitFx(x: number, y: number): void {
    const s = this.add.sprite(x, y, Tex.Hit).setScale(1.4).setDepth(50);
    this.tweens.add({ targets: s, scale: 2, alpha: 0, duration: 220, onComplete: () => s.destroy() });
  }

  // ── outcomes ─────────────────────────────────────────────────────────────
  private clearLevel(): void {
    if (this.cleared) return;
    this.cleared = true;
    this.registry.set(RegistryKeys.Hp, this.hp);
    const next = (this.registry.get(RegistryKeys.Level) as number) + 1;
    this.flash('LEVEL CLEAR', () => {
      this.registry.set(RegistryKeys.Level, next);
      this.scene.restart();
    });
  }

  private defeatBoss(): void {
    if (this.cleared) return;
    this.cleared = true;
    this.boss && this.boss.sprite.setVelocity(0, 0);
    if (this.boss) this.tweens.add({ targets: this.boss.sprite, angle: 180, alpha: 0, duration: 700 });
    this.cameras.main.shake(400, 0.012);
    this.flash('YOU WIN!', () => {
      this.registry.set(RegistryKeys.Level, 0);
      this.scene.start(SceneKeys.Menu);
    });
  }

  private die(): void {
    if (this.cleared) return;
    this.cleared = true;
    this.flash('YOU DIED', () => {
      this.registry.set(RegistryKeys.Hp, 5);
      this.scene.restart();
    });
  }

  private flash(text: string, then: () => void): void {
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, text, {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffcd75', stroke: '#10131f', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.tweens.add({ targets: t, scale: 1.2, duration: 300, yoyo: true });
    this.time.delayedCall(1100, () => { this.cameras.main.fade(260, 0, 0, 0); });
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, then);
  }

  private emitHud(): void {
    this.game.events.emit('ak-hud', { hp: this.hp, level: this.levelDef.name });
  }

  // ── loop ───────────────────────────────────────────────────────────────────
  update(time: number): void {
    if (this.cleared) return;
    const k = this.keys;
    const left = k.LEFT.isDown || k.A.isDown || this.touch.left;
    const right = k.RIGHT.isDown || k.D.isDown || this.touch.right;
    const jumpHeld = k.SPACE.isDown || k.UP.isDown || k.W.isDown || this.touch.jump;
    this.player.update(time, left, right, jumpHeld);

    // warrior melee: check hitbox against enemies during the active window
    const box = this.player.meleeHitbox();
    if (box) {
      for (const e of this.enemies) {
        if (!e.alive || e.sprite.getData('hitThisSwing')) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(box, e.sprite.getBounds())) {
          e.sprite.setData('hitThisSwing', true);
          this.time.delayedCall(300, () => e.sprite.active && e.sprite.setData('hitThisSwing', false));
          this.hitFx(e.sprite.x, e.sprite.y - 40);
          this.applyEnemyDamage(e, 2);
        }
      }
    }

    // enemies AI
    for (const e of this.enemies) e.update(time, this.player.sprite.x);

    // fell off the world
    if (this.player.sprite.y > GAME_HEIGHT + 40) this.die();
  }
}
