import Phaser from 'phaser';
import { SceneKeys, RegistryKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, Tuning } from '../config';
import { Hero } from '../objects/Hero';
import { Enemy, type EnemyKind } from '../objects/Enemy';
import { Bullet } from '../objects/Bullet';
import { XpGem } from '../objects/XpGem';
import { EquipDrop } from '../objects/EquipDrop';
import { Joystick } from '../objects/Joystick';
import { SpatialHash } from '../systems/SpatialHash';
import { Audio } from '../systems/Audio';
import { Equipment } from '../systems/Equipment';
import { Footer } from '../systems/Footer';
import { AudioKeys } from '../types/keys';
import { makeWeaponStats, type WeaponStats, type Skill, type RunState } from '../types/skills';
import { DIFFICULTY, DIFFICULTY_COLOR, type Difficulty, type DiffMul } from '../types/difficulty';
import { EQUIP_SLOTS, type EquipSlot, type EquipTier } from '../types/equipment';

declare const __DEV__: boolean;

export class GameScene extends Phaser.Scene {
  private hero!: Hero;
  private joystick!: Joystick;
  private enemies!: Phaser.GameObjects.Group;
  private bullets!: Phaser.GameObjects.Group;
  private gems!: Phaser.GameObjects.Group;
  private drops!: Phaser.GameObjects.Group;
  private hash = new SpatialHash<Enemy>(Tuning.hashCellSize);
  private audio!: Audio;
  private equip!: Equipment;
  private footer!: Footer;
  private weapon: WeaponStats = makeWeaponStats();
  private taken: Record<string, number> = {};
  private diffKey: Difficulty = 'normal';
  private diff: DiffMul = DIFFICULTY.normal;

  // run state
  private elapsed = 0; // seconds survived
  private kills = 0;
  private level = 1;
  private xp = 0;
  private xpNeeded: number = Tuning.xpBase;
  private over = false;
  private nextFireAt = 0;
  private nextSpawnAt = 0;
  private nextBossAt: number = Tuning.bossFirstSpawn * 1000;

  // HUD
  private hpBar!: Phaser.GameObjects.Graphics;
  private xpBar!: Phaser.GameObjects.Graphics;
  private timeText!: Phaser.GameObjects.Text;
  private lvlText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Game);
  }

  create(data?: { difficulty?: Difficulty }): void {
    this.elapsed = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeeded = Tuning.xpBase;
    this.over = false;
    this.weapon = makeWeaponStats();
    this.taken = {};
    this.nextFireAt = 0;
    this.nextSpawnAt = 0;
    this.nextBossAt = Tuning.bossFirstSpawn * 1000;

    this.diffKey =
      data?.difficulty ??
      (this.registry.get(RegistryKeys.Difficulty) as Difficulty) ??
      'normal';
    this.diff = DIFFICULTY[this.diffKey];

    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.drawGrid();

    this.hero = new Hero(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.joystick = new Joystick(this);
    this.audio = new Audio(this);

    this.enemies = this.add.group({ classType: Enemy, maxSize: Tuning.poolEnemies });
    this.bullets = this.add.group({ classType: Bullet, maxSize: Tuning.poolBullets });
    this.gems = this.add.group({ classType: XpGem, maxSize: Tuning.poolGems });
    this.drops = this.add.group({ classType: EquipDrop, maxSize: Tuning.poolEquip });
    this.prealloc(this.enemies, Enemy, Tuning.poolEnemies);
    this.prealloc(this.bullets, Bullet, Tuning.poolBullets);
    this.prealloc(this.gems, XpGem, Tuning.poolGems);
    this.prealloc(this.drops, EquipDrop, Tuning.poolEquip);

    // Equipment (overlays on the hero) + footer HUD (skills + gear).
    this.equip = new Equipment(this, this.hero);
    this.footer = new Footer(this);
    this.equip.setOnChange(() => this.footer.refreshEquip(this.equip));

    this.buildHud();

    // 1s survival ticker.
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.over) {
          this.elapsed += 1;
          this.timeText.setText(formatClock(this.elapsed));
        }
      },
    });

    // Listen for the level-up pick coming back from LevelUpScene.
    this.events.on('skillPicked', this.applySkill, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('skillPicked', this.applySkill, this);
    });

    // Dev-only hooks for the FPS gate + deterministic feature tests.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const dev = this as unknown as {
        __stress: (n: number) => void;
        __dropEquip: (slot: EquipSlot, tier: EquipTier) => void;
        __addXp: (n: number) => void;
        __equip: Equipment;
      };
      dev.__stress = (n: number) => {
        for (let i = 0; i < n; i++) this.spawnOne(Math.random() < 0.3 ? 'runner' : 'walker');
      };
      dev.__dropEquip = (slot: EquipSlot, tier: EquipTier) =>
        this.dropEquip(this.hero.x + 28, this.hero.y, slot, tier);
      dev.__addXp = (n: number) => this.addXp(n);
      dev.__equip = this.equip;
    }
  }

  // ── pools ──────────────────────────────────────────────────────────────────
  private prealloc<T extends Phaser.GameObjects.GameObject>(
    group: Phaser.GameObjects.Group,
    ctor: new (scene: Phaser.Scene) => T,
    n: number,
  ): void {
    for (let i = 0; i < n; i++) {
      const obj = new ctor(this);
      this.add.existing(obj);
      group.add(obj);
    }
  }

  // ── main loop ──────────────────────────────────────────────────────────────
  update(time: number, deltaMs: number): void {
    if (this.over) return;
    const dt = deltaMs / 1000;

    // 1. input → hero (then drag equipment overlays onto the hero transform)
    this.joystick.sample();
    this.hero.drive(this.joystick.dx, this.joystick.dy);
    this.equip.follow();

    // 2. spawn
    this.spawnDirector(time);

    // 3. broad-phase rebuild
    const enemyList = this.enemies.getChildren() as Enemy[];
    this.hash.rebuild(enemyList);

    // 4. enemy steering toward hero (+ cheap separation)
    const hx = this.hero.x;
    const hy = this.hero.y;
    for (let i = 0; i < enemyList.length; i++) {
      const e = enemyList[i];
      if (!e.active) continue;
      e.moveToward(hx, hy, dt, time);
    }

    // 5. weapon auto-fire (on cadence, grid-targeted)
    if (time >= this.nextFireAt) {
      this.fire(time);
      this.audio.play(AudioKeys.Shoot);
      this.nextFireAt = time + this.weapon.fireInterval;
    }

    // 6. bullets integrate + hit enemies (grid query)
    const bulletList = this.bullets.getChildren() as Bullet[];
    for (let i = 0; i < bulletList.length; i++) {
      const b = bulletList[i];
      if (!b.active) continue;
      if (b.integrate(dt, time) || this.outOfBounds(b.x, b.y, 40)) {
        b.despawn();
        continue;
      }
      let consumed = false;
      this.hash.query(b.x, b.y, b.radius + 16, (e) => {
        if (consumed || !e.active) return;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d <= b.radius + e.radius) {
          consumed = true;
          if (e.takeDamage(b.damage, time)) this.killEnemy(e);
        }
      });
      if (consumed) b.despawn();
    }

    // 7. enemy → hero contact
    let contact = 0;
    this.hash.query(hx, hy, Tuning.heroRadius + 28, (e) => {
      if (!e.active) return;
      const d = Math.hypot(e.x - hx, e.y - hy);
      if (d <= Tuning.heroRadius + e.radius) contact = Math.max(contact, e.damage);
    });
    if (contact > 0) contact *= 1 - this.equip.armor; // shirt mitigates at-use
    if (contact > 0 && this.hero.hurt(contact, time)) {
      this.audio.play(AudioKeys.Hurt);
      this.updateHpBar();
      if (this.hero.isDead) {
        this.gameOver();
        return;
      }
    }

    // 8. gems home + pickup
    const gemList = this.gems.getChildren() as XpGem[];
    for (let i = 0; i < gemList.length; i++) {
      const g = gemList[i];
      if (!g.active) continue;
      if (g.update(hx, hy, this.hero.pickupRadius, dt)) {
        g.despawn();
        this.audio.play(AudioKeys.Pickup);
        this.addXp(g.value);
      }
    }

    // 9. equipment drops home + pickup → equip onto the hero
    const dropList = this.drops.getChildren() as EquipDrop[];
    for (let i = 0; i < dropList.length; i++) {
      const d = dropList[i];
      if (!d.active) continue;
      if (d.update(hx, hy, this.hero.pickupRadius, dt)) {
        const slot = d.slot;
        const tier = d.tier;
        d.despawn();
        this.audio.play(AudioKeys.Pickup);
        if (this.equip.equip(slot, tier)) this.updateHpBar(); // maxHp may grow
      }
    }
  }

  // ── spawning ───────────────────────────────────────────────────────────────
  private spawnDirector(time: number): void {
    // Boss on a timer.
    if (time >= this.nextBossAt) {
      this.spawnOne('boss');
      this.nextBossAt = time + Tuning.bossInterval * 1000;
    }
    if (time < this.nextSpawnAt) return;
    const ramp =
      Math.max(Tuning.spawnIntervalMin, Tuning.spawnInterval - this.elapsed * 6) *
      this.diff.spawnInterval;
    this.nextSpawnAt = time + ramp;
    const batch = Math.max(
      1,
      Math.round((Tuning.spawnBatch + Math.floor(this.elapsed / 25)) * this.diff.spawnBatch),
    );
    for (let i = 0; i < batch; i++) {
      const kind: EnemyKind =
        this.elapsed >= Tuning.runnerUnlockSec && Math.random() < 0.35 ? 'runner' : 'walker';
      this.spawnOne(kind);
    }
  }

  private spawnOne(kind: EnemyKind): void {
    const e = this.enemies.getFirstDead(false) as Enemy | null;
    if (!e) return;
    const ang = Math.random() * Math.PI * 2;
    const r = Tuning.spawnRingRadius * this.diff.spawnRing;
    const x = this.hero.x + Math.cos(ang) * r;
    const y = this.hero.y + Math.sin(ang) * r;
    const hpScale = 1 + Math.floor(this.elapsed / 30) * Tuning.enemyHpScalePer30s;
    e.spawn(kind, x, y, hpScale, this.diff.enemyHp, this.diff.contactDamage);
  }

  // ── weapon ─────────────────────────────────────────────────────────────────
  private fire(time: number): void {
    const target = this.hash.nearest(this.hero.x, this.hero.y, 320);
    let baseAng: number;
    if (target) baseAng = Math.atan2(target.y - this.hero.y, target.x - this.hero.x);
    else baseAng = -Math.PI / 2; // up if nothing in range
    const count = this.weapon.projectileCount;
    const spread = 0.18;
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * spread;
      const a = baseAng + off;
      const b = this.bullets.getFirstDead(false) as Bullet | null;
      if (!b) break;
      const dmg = this.weapon.damage + this.equip.bulletDamage; // gear adds at-use
      b.fire(this.hero.x, this.hero.y, Math.cos(a), Math.sin(a), dmg, time);
    }
  }

  private killEnemy(e: Enemy): void {
    const gx = e.x;
    const gy = e.y;
    const isBoss = e.kind === 'boss';
    e.despawn();
    this.audio.play(AudioKeys.Hit);
    this.kills += 1;
    this.killText.setText(`${this.kills}`);
    // Drop gem(s).
    const drops = isBoss ? 8 : 1;
    for (let i = 0; i < drops; i++) {
      const g = this.gems.getFirstDead(false) as XpGem | null;
      if (!g) break;
      const jx = gx + (isBoss ? Phaser.Math.Between(-30, 30) : 0);
      const jy = gy + (isBoss ? Phaser.Math.Between(-30, 30) : 0);
      g.drop(jx, jy, Tuning.gemValue);
    }
    // Rare equipment drop (bosses always drop a high tier).
    if (isBoss || Math.random() < Tuning.equipDropChance) {
      this.dropEquip(
        gx,
        gy,
        EQUIP_SLOTS[Math.floor(Math.random() * EQUIP_SLOTS.length)],
        this.rollTier(isBoss),
      );
    }
  }

  private rollTier(isBoss: boolean): EquipTier {
    if (isBoss) return Math.random() < 0.5 ? 3 : 2;
    return Math.random() < 0.8 ? 1 : 2;
  }

  private dropEquip(x: number, y: number, slot: EquipSlot, tier: EquipTier): void {
    const d = this.drops.getFirstDead(false) as EquipDrop | null;
    if (!d) return;
    d.drop(x, y, slot, tier);
  }

  // ── xp / level ─────────────────────────────────────────────────────────────
  private addXp(v: number): void {
    this.xp += v;
    if (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level += 1;
      this.xpNeeded = Math.round(this.xpNeeded * Tuning.xpGrowth);
      this.lvlText.setText(`LV ${this.level}`);
      this.levelUp();
    }
    this.updateXpBar();
  }

  private levelUp(): void {
    this.audio.play(AudioKeys.LevelUp);
    this.scene.pause();
    this.scene.launch(SceneKeys.LevelUp, { taken: this.taken, gameKey: SceneKeys.Game });
  }

  private applySkill(skill: Skill): void {
    this.taken[skill.id] = (this.taken[skill.id] ?? 0) + 1;
    const state: RunState = { hero: this.hero, weapon: this.weapon };
    skill.apply(state);
    this.footer.refreshSkills(this.taken);
    this.updateHpBar();
  }

  // ── death ──────────────────────────────────────────────────────────────────
  private gameOver(): void {
    if (this.over) return;
    this.over = true;
    this.hero.setVelocity(0, 0);
    const best = (this.registry.get(RegistryKeys.BestTime) as number) ?? 0;
    if (this.elapsed > best) this.registry.set(RegistryKeys.BestTime, this.elapsed);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `GAME OVER\n${formatClock(this.elapsed)}`, {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#b13e53',
        align: 'center',
        stroke: '#1a1c2c',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(100);
    this.time.delayedCall(1800, () => this.scene.start(SceneKeys.Menu));
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private outOfBounds(x: number, y: number, m: number): boolean {
    return x < -m || y < -m || x > GAME_WIDTH + m || y > GAME_HEIGHT + m;
  }

  private drawGrid(): void {
    const g = this.add.graphics().setDepth(0);
    g.lineStyle(1, 0xffffff, 0.04);
    for (let x = 0; x <= GAME_WIDTH; x += 40) g.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += 40) g.lineBetween(0, y, GAME_WIDTH, y);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  private buildHud(): void {
    this.hpBar = this.add.graphics().setDepth(60);
    this.xpBar = this.add.graphics().setDepth(60);
    this.timeText = this.add
      .text(GAME_WIDTH / 2, 10, '0:00', {
        fontFamily: 'monospace', fontSize: '22px', color: '#ffffff',
        stroke: '#1a1c2c', strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(61);
    this.lvlText = this.add
      .text(10, 10, 'LV 1', {
        fontFamily: 'monospace', fontSize: '14px', color: '#a7f070',
        stroke: '#1a1c2c', strokeThickness: 3,
      })
      .setDepth(61);
    this.add
      .text(10, 28, this.diffKey.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '10px', color: DIFFICULTY_COLOR[this.diffKey],
        stroke: '#1a1c2c', strokeThickness: 2,
      })
      .setDepth(61);
    this.killText = this.add
      .text(GAME_WIDTH - 10, 28, '0', {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffcd75',
        stroke: '#1a1c2c', strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setDepth(61);

    // Mute toggle (top-right). Text label, no emoji.
    const muteBtn = this.add
      .text(GAME_WIDTH - 10, 8, this.audio.muted ? '[MUTED]' : '[SOUND]', {
        fontFamily: 'monospace', fontSize: '11px', color: '#8a91b4',
        stroke: '#1a1c2c', strokeThickness: 2,
      })
      .setOrigin(1, 0)
      .setDepth(61)
      .setInteractive({ useHandCursor: true });
    muteBtn.on('pointerup', () => {
      const m = this.audio.toggleMute();
      muteBtn.setText(m ? '[MUTED]' : '[SOUND]');
    });

    this.updateHpBar();
    this.updateXpBar();
  }

  private updateHpBar(): void {
    const w = GAME_WIDTH - 20;
    const frac = this.hero ? this.hero.hp / this.hero.maxHp : 1;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x1a1c2c, 0.8).fillRect(10, 40, w, 10);
    this.hpBar.fillStyle(0xb13e53, 1).fillRect(11, 41, (w - 2) * frac, 8);
  }

  private updateXpBar(): void {
    const w = GAME_WIDTH - 20;
    const frac = Phaser.Math.Clamp(this.xp / this.xpNeeded, 0, 1);
    this.xpBar.clear();
    this.xpBar.fillStyle(0x1a1c2c, 0.8).fillRect(10, 52, w, 6);
    this.xpBar.fillStyle(0x41a6f6, 1).fillRect(11, 53, (w - 2) * frac, 4);
  }
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
