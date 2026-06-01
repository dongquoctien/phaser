import Phaser from 'phaser';
import { SceneKeys, AudioKeys, RegistryKeys, TextureKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, Tuning } from '../config';
import { Unit } from '../objects/Unit';
import { Projectile, type ShotData } from '../objects/Projectile';
import { Audio } from '../systems/Audio';
import { Footer } from '../systems/Footer';
import { Juice } from '../systems/Juice';
import { STARTERS, PETS, heroById, statsFor, type HeroDef } from '../types/roster';
import { freshProfile, type AttackProfile, type Skill, skillById } from '../types/skills';

declare const __DEV__: boolean;

// One hero (left) shoots projectiles at advancing enemies (right). Skills modify
// the shot — multishot/pierce/bounce/crit/burn/poison/execute — and COMPOUND, so
// depth comes from the build, not flat %. Pets join every 5 floors and add
// support fire.
export class GameScene extends Phaser.Scene {
  private hero!: Unit;
  private heroDef!: HeroDef;
  private profile!: AttackProfile;
  private pets: Unit[] = [];
  private enemies: Unit[] = [];
  private bullets!: Phaser.GameObjects.Group;
  private audio!: Audio;
  private footer!: Footer;
  private juice!: Juice;

  private taken: Record<string, number> = {};
  private floor = 1;
  private round = 1;
  private hits = 0;
  private level = 1;
  private xp = 0;
  private xpNeeded: number = Tuning.xpBase;
  private pendingLevels = 0;
  private petsRecruited = 0;
  private over = false;
  private spawning = false;
  private heroNextFire = 0;
  private trailTick = 0;

  // HUD
  private floorText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private hitsText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private statText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Game);
  }

  create(data?: { hero?: string }): void {
    this.pets = [];
    this.enemies = [];
    this.taken = {};
    this.floor = 1; this.round = 1; this.hits = 0; this.level = 1;
    this.xp = 0; this.xpNeeded = Tuning.xpBase; this.petsRecruited = 0;
    this.pendingLevels = 0;
    this.over = false; this.spawning = false; this.heroNextFire = 0;

    this.audio = new Audio(this);
    this.juice = new Juice(this);
    this.drawBackdrop();

    const id = data?.hero ?? (this.registry.get(RegistryKeys.Team) as string) ?? STARTERS[0].id;
    this.heroDef = heroById(id) ?? STARTERS[0];
    this.profile = freshProfile(Tuning.baseAttackInterval, Tuning.baseProjectileSpeed);
    this.heroDef.startProfile(this.profile);

    const s = statsFor(this.heroDef);
    this.hero = new Unit(this, this.heroDef.texture, Tuning.heroX, Tuning.heroY, {
      hp: s.hp, atk: s.atk, def: s.def, attackInterval: this.profile.attackInterval, isHero: true, scale: 1.1,
    });
    this.hero.startIdleBob();

    this.bullets = this.add.group({ classType: Projectile, maxSize: Tuning.poolProjectiles });
    for (let i = 0; i < Tuning.poolProjectiles; i++) this.bullets.add(new Projectile(this), true);
    this.bullets.getChildren().forEach((b) => (b as Projectile).despawn());

    this.footer = new Footer(this);
    this.buildHud();
    this.spawnWave();

    this.events.on('skillPicked', this.applySkill, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off('skillPicked', this.applySkill, this));

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      (this as unknown as Record<string, unknown>).__dev = {
        addSkill: (sid: string) => { const sk = skillById(sid); if (sk) this.applySkill(sk); },
        addXp: (n: number) => this.gainXp(n),
        clearWave: () => this.enemies.slice().forEach((e) => this.killEnemy(e)),
        state: () => ({ floor: this.floor, round: this.round, enemies: this.enemies.length, pets: this.pets.length, hits: this.hits, profile: this.profile, taken: this.taken }),
        profile: () => this.profile,
      };
    }
  }

  // ── spawns ─────────────────────────────────────────────────────────────────
  private spawnWave(): void {
    const isBoss = this.round === Tuning.roundsPerFloor && this.floor % Tuning.bossEveryFloors === 0;
    const hpScale = Math.pow(1 + Tuning.enemyHpPerFloor, this.floor - 1);
    const atkScale = Math.pow(1 + Tuning.enemyAtkPerFloor, this.floor - 1);
    if (isBoss) {
      this.addEnemy(TextureKeys.Boss, (Tuning.laneTop + Tuning.laneBottom) / 2, { hp: 9, atk: 1.8, scale: 1.5 }, hpScale, atkScale);
      return;
    }
    const count = Phaser.Math.Between(Tuning.enemiesPerRoundMin, Tuning.enemiesPerRoundMax);
    const span = Tuning.laneBottom - Tuning.laneTop;
    for (let i = 0; i < count; i++) {
      const tex = Math.random() < 0.6 ? TextureKeys.Skeleton : TextureKeys.Slime;
      const tough = tex === TextureKeys.Skeleton ? { hp: 1, atk: 1 } : { hp: 1.5, atk: 0.7 };
      const y = Tuning.laneTop + (span * (i + 0.5)) / count + Phaser.Math.Between(-14, 14);
      this.addEnemy(tex, y, { ...tough, scale: 0.9 }, hpScale, atkScale, i * 60);
    }
  }

  private addEnemy(
    texture: string, y: number, mul: { hp: number; atk: number; scale: number },
    hpScale: number, atkScale: number, xOffset = 0,
  ): void {
    const u = new Unit(this, texture, Tuning.spawnX + xOffset, y, {
      hp: Math.round(Tuning.enemyBaseHp * mul.hp * hpScale),
      atk: Math.round(Tuning.enemyBaseAtk * mul.atk * atkScale),
      def: 0, attackInterval: 1100, isHero: false, scale: mul.scale,
    });
    u.startIdleBob();
    this.enemies.push(u);
  }

  // ── main loop ──────────────────────────────────────────────────────────────
  update(time: number, deltaMs: number): void {
    if (this.over) return;
    // Hit-stop: during a freeze the simulation pauses (firing / advance / projectile
    // integration) but tweens + camera shake keep running for the "weight" effect.
    if (this.juice.frozen) return;
    const dt = deltaMs / 1000;

    // 1. hero + pets fire on cadence
    if (!this.spawning && this.enemies.some((e) => e.alive)) {
      if (time >= this.heroNextFire) {
        this.fireVolley(this.hero, this.profile, 0xffffff);
        this.heroNextFire = time + this.profile.attackInterval;
      }
      for (const pet of this.pets) {
        if (time >= pet.nextAttackAt) {
          this.fireVolley(pet, this.petProfile(), 0x9ad0ff);
          pet.nextAttackAt = time + Tuning.petAttackInterval;
        }
      }
    }

    // 2. enemies advance toward the hero, melee when close, DoT ticks
    const hx = this.hero.homeX;
    const hy = this.hero.homeY;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (this.killByDot(e, dt, time)) continue;
      const dist = Math.hypot(e.homeX - hx, e.homeY - hy);
      if (dist > Tuning.enemyContactRange) {
        e.advance(hx, hy, Tuning.enemySpeed, dt);
        e.clearTelegraph();
      } else if (e.telegraphUntil === 0 && time >= e.nextAttackAt) {
        // §4 telegraph: a readable wind-up (rear back + red tint) BEFORE the hit.
        e.startTelegraph(time + Tuning.telegraphMs);
      } else if (e.telegraphUntil > 0 && time >= e.telegraphUntil) {
        // strike
        e.telegraphUntil = 0;
        e.nextAttackAt = time + e.attackInterval;
        e.lunge(hx);
        const dmg = Math.max(1, e.atk - this.hero.def);
        const dead = this.hero.takeDamage(dmg);
        this.juice.damageNumber(hx, hy - 8, dmg, false);
        this.juice.shake(0.4); // taking damage shakes (red-tinted via hero flash)
        this.audio.playPitched(AudioKeys.Defeat);
        this.updateHpBar();
        if (dead) { this.gameOver(); return; }
      }
    }

    // 3. projectiles fly + resolve hits (+ a faint trail every few frames)
    const minX = -40, maxX = GAME_WIDTH + 40, minY = Tuning.laneTop - 80, maxY = Tuning.laneBottom + 80;
    this.trailTick = (this.trailTick + 1) % 2;
    for (const obj of this.bullets.getChildren()) {
      const b = obj as Projectile;
      if (!b.active) continue;
      if (this.trailTick === 0) this.juice.trail(b.x, b.y, 0xbfe3ff);
      if (b.step(dt, minX, maxX, minY, maxY)) { b.despawn(); continue; }
      this.resolveProjectile(b, time);
    }
  }

  private petProfile(): AttackProfile {
    // pets fire a simple weaker arrow that still benefits from a few modifiers
    const p = freshProfile(Tuning.petAttackInterval, Tuning.baseProjectileSpeed);
    p.damageMul = Tuning.petDamageMul * this.profile.damageMul;
    p.pierce = Math.min(1, this.profile.pierce);
    p.arrows = Math.min(2, this.profile.arrows);
    p.critChance = this.profile.critChance * 0.5;
    return p;
  }

  // ── firing ───────────────────────────────────────────────────────────────
  private fireVolley(shooter: Unit, profile: AttackProfile, tint: number): void {
    const target = this.nearestEnemy(shooter.homeX, shooter.homeY);
    if (!target) return;
    const baseAng = Math.atan2(target.homeY - shooter.homeY, target.homeX - shooter.homeX);
    const dmg = Math.round(shooter.atk * profile.damageMul);
    const total = profile.arrows;
    const spread = Phaser.Math.DegToRad(profile.spreadDeg);
    const angles: number[] = [];
    for (let i = 0; i < total; i++) {
      const off = total === 1 ? 0 : (i - (total - 1) / 2) * spread;
      angles.push(baseAng + off);
    }
    for (let r = 0; r < profile.rearArrows; r++) angles.push(baseAng + Math.PI + (r - (profile.rearArrows - 1) / 2) * spread);

    for (const a of angles) {
      const b = this.bullets.getFirstDead(false) as Projectile | null;
      if (!b) break;
      const data: ShotData = {
        damage: dmg, pierce: profile.pierce, bounce: profile.bounce,
        critChance: profile.critChance, critMul: profile.critMul,
        burn: profile.burn, poison: profile.poison, executeBelow: profile.executeBelow,
        lifesteal: profile.lifesteal, bonusVsFull: profile.bonusVsFull, fromHero: shooter === this.hero,
      };
      b.fire(shooter.homeX + 16, shooter.homeY, a, profile.projectileSpeed, data, tint);
    }
    shooter.recoil(); // §2 squash on fire
    if (shooter === this.hero) this.audio.playPitched(AudioKeys.Skill);
  }

  private resolveProjectile(b: Projectile, time: number): void {
    for (const e of this.enemies) {
      if (!e.alive || b.hitSet.has(e)) continue;
      const d = Math.hypot(e.homeX - b.x, e.homeY - b.y);
      if (d > b.radius + e.sprite.displayWidth * 0.4) continue;
      b.hitSet.add(e);
      this.applyHit(b.data2, e, time);
      // pierce → keep going; else bounce → redirect; else despawn
      if (b.data2.pierce > 0) {
        b.data2.pierce -= 1;
      } else if (b.data2.bounce > 0) {
        const next = this.nearestEnemyExcept(b.x, b.y, b.hitSet);
        if (next) { b.data2.bounce -= 1; b.redirect(next.homeX, next.homeY, Tuning.baseProjectileSpeed); }
        else { b.despawn(); return; }
      } else {
        b.despawn();
        return;
      }
    }
  }

  private applyHit(data: ShotData, e: Unit, time: number): void {
    let dmg = data.damage;
    if (data.bonusVsFull > 0 && e.hp >= e.maxHp - 1) dmg = Math.round(dmg * (1 + data.bonusVsFull));
    const crit = Math.random() < data.critChance;
    if (crit) dmg = Math.round(dmg * data.critMul);
    this.spawnSlash(e.homeX, e.homeY, crit);
    this.audio.playPitched(AudioKeys.Hit); // §5: ±pitch so spammed hits don't fatigue

    // — juice §3: floating damage number + knockback + crit shake/hit-stop —
    this.juice.damageNumber(e.homeX, e.homeY - 8, dmg, crit);
    e.knockback(8 + (crit ? 8 : 0));
    if (crit) { this.juice.shake(0.45); this.juice.hitStop(3, time); this.juice.burst(e.homeX, e.homeY, 0xffd23f, 6, 90); }

    // execute under threshold
    let killed = false;
    if (data.executeBelow > 0 && e.hp - dmg <= e.maxHp * data.executeBelow) killed = true;
    else killed = e.takeDamage(dmg);

    if (data.burn > 0) e.applyBurn(data.damage * 0.5 * data.burn, time);
    if (data.poison > 0) e.applyPoison(data.damage * 0.4 * data.poison, time);
    if (data.fromHero && data.lifesteal > 0) { this.hero.heal(Math.round(dmg * data.lifesteal)); this.updateHpBar(); }

    if (data.fromHero) { this.hits += 1; this.hitsText.setText(`${this.hits}`); }
    if (killed) this.killEnemy(e);
  }

  private killByDot(e: Unit, dt: number, time: number): boolean {
    const d = e.tickDot(dt, time);
    if (d > 0 && !e.alive) { this.killEnemy(e); return true; }
    return false;
  }

  private nearestEnemy(x: number, y: number): Unit | null {
    let best: Unit | null = null, bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.homeX - x, e.homeY - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private nearestEnemyExcept(x: number, y: number, exclude: Set<object>): Unit | null {
    let best: Unit | null = null, bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || exclude.has(e)) continue;
      const d = Math.hypot(e.homeX - x, e.homeY - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private spawnSlash(x: number, y: number, crit: boolean): void {
    const s = this.add.image(x, y, TextureKeys.Slash).setScale(crit ? 0.95 : 0.6).setDepth(20).setAlpha(0.95);
    if (crit) s.setTint(0xffd23f);
    this.tweens.add({ targets: s, alpha: 0, scale: s.scale + 0.3, duration: 170, onComplete: () => s.destroy() });
  }

  private killEnemy(e: Unit): void {
    if (e.dead) return; // already removed (guards double-kill from multi-hit / DoT)
    e.dead = true;
    e.hp = 0;
    // — juice §3: death pop — particle burst + shake + hit-stop (boss = bigger) —
    const big = e.sprite.scale > 1.2; // boss-ish
    this.juice.burst(e.homeX, e.homeY, 0xff8c66, big ? 18 : 10, big ? 180 : 130);
    this.juice.shake(big ? 0.85 : 0.3);
    this.juice.hitStop(big ? 7 : 2, this.time.now);
    e.die();
    this.enemies = this.enemies.filter((x) => x !== e);
    this.gainXp(Tuning.xpPerKill);
    if (this.enemies.length === 0 && !this.spawning && !this.over) this.advanceRound();
  }

  // ── progression ────────────────────────────────────────────────────────────
  private advanceRound(): void {
    this.spawning = true;
    this.time.delayedCall(420, () => {
      if (this.over) return;
      if (this.round >= Tuning.roundsPerFloor) this.advanceFloor();
      else { this.round += 1; this.roundText.setText(`Round ${this.round}/${Tuning.roundsPerFloor}`); this.spawnWave(); }
      this.spawning = false;
    });
  }

  private advanceFloor(): void {
    this.floor += 1;
    this.round = 1;
    const best = (this.registry.get(RegistryKeys.BestFloor) as number) ?? 0;
    if (this.floor - 1 > best) this.registry.set(RegistryKeys.BestFloor, this.floor - 1);
    this.floorText.setText(`Dungeon Floor ${this.floor}`);
    this.roundText.setText(`Round 1/${Tuning.roundsPerFloor}`);
    this.hero.heal(Math.round(this.hero.maxHp * 0.35));
    this.updateHpBar();
    this.juice.burst(this.hero.homeX, this.hero.homeY, 0x7ce06a, 12, 110); // heal sparkle
    if ((this.floor - 1) % Tuning.recruitEveryFloors === 0 && this.pets.length < Tuning.maxPets) {
      const pet = PETS[this.petsRecruited % PETS.length];
      if (pet) { this.petsRecruited += 1; this.addPet(pet); this.audio.play(AudioKeys.LevelUp); this.flashBanner(`${pet.name} joined!`); }
    }
    this.updateStatText();
    this.spawnWave();
  }

  private addPet(def: HeroDef): void {
    const s = statsFor(def);
    const slot = this.pets.length;
    const y = Tuning.heroY + (slot % 2 === 0 ? 72 : -72) + Math.floor(slot / 2) * 30;
    const u = new Unit(this, def.texture, Tuning.heroX - 24, y, {
      hp: s.hp, atk: Math.round(this.hero.atk * 0.6), def: s.def, attackInterval: Tuning.petAttackInterval, isHero: true, scale: 0.8,
    });
    u.startIdleBob();
    this.pets.push(u);
  }

  private gainXp(n: number): void {
    if (this.over) return;
    this.xp += n;
    let gained = 0;
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level += 1;
      this.xpNeeded = Math.round(this.xpNeeded * Tuning.xpGrowth);
      gained += 1;
    }
    if (gained > 0) {
      this.pendingLevels += gained;
      // Only launch ONE pick at a time; the rest fire after each pick resolves.
      if (!this.scene.isPaused()) this.levelUp();
    }
  }

  private levelUp(): void {
    if (this.pendingLevels <= 0 || this.over) return;
    this.pendingLevels -= 1;
    this.audio.play(AudioKeys.LevelUp);
    this.spawning = true; // pause firing during the pick
    this.scene.pause();
    this.scene.launch(SceneKeys.LevelUp, { taken: this.taken, gameKey: SceneKeys.Game });
  }

  private applySkill(skill: Skill): void {
    this.taken[skill.id] = (this.taken[skill.id] ?? 0) + 1;
    skill.apply(this.profile);
    this.audio.play(AudioKeys.Skill);
    this.footer.refresh(this.taken);
    this.updateStatText();
    this.spawning = false;
    // Chain to the next queued level-up, if any (resumes on the next tick).
    if (this.pendingLevels > 0) { this.time.delayedCall(60, () => this.levelUp()); return; }
    // If the wave was wiped while the pick was open, advance now that we resumed.
    if (this.enemies.length === 0 && !this.over) this.advanceRound();
  }

  // ── HUD / backdrop ─────────────────────────────────────────────────────────
  private drawBackdrop(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a1c2c).setOrigin(0).setDepth(-3);
    // Tiled pixel brick wall behind the battle band; a darker floor below it.
    const brick = this.textures.get(TextureKeys.Brick).getSourceImage();
    const tw = brick.width, th = brick.height;
    const wallTop = Tuning.laneTop - 60, wallBottom = Tuning.laneBottom + 50;
    for (let y = wallTop; y < wallBottom; y += th) {
      for (let x = 0; x < GAME_WIDTH; x += tw) {
        const t = this.add.image(x, y, TextureKeys.Brick).setOrigin(0).setDepth(-2);
        if (y > Tuning.laneBottom - 10) t.setTint(0x6a6a8a); // floor darker/cooler
      }
    }
    // a vignette to focus the lane
    this.add.rectangle(0, 0, GAME_WIDTH, wallTop, 0x1a1c2c).setOrigin(0).setDepth(-1).setAlpha(0.6);
    this.add.rectangle(0, wallBottom, GAME_WIDTH, GAME_HEIGHT - wallBottom, 0x1a1c2c).setOrigin(0).setDepth(-1).setAlpha(0.55);
    // Two flickering torches on the side walls.
    [40, GAME_WIDTH - 40].forEach((tx) => {
      const torch = this.add.image(tx, wallTop + 36, TextureKeys.Torch).setScale(1.2).setDepth(-1);
      this.tweens.add({ targets: torch, alpha: 0.65, scaleX: 1.1, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // warm glow pool
      const glow = this.add.circle(tx, wallTop + 30, 34, 0xef7d57, 0.18).setDepth(-1);
      this.tweens.add({ targets: glow, alpha: 0.08, scale: 1.15, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  private buildHud(): void {
    this.floorText = this.add.text(GAME_WIDTH / 2, 22, 'Dungeon Floor 1', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', stroke: '#1a1020', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(60);
    this.roundText = this.add.text(GAME_WIDTH / 2, 56, `Round 1/${Tuning.roundsPerFloor}`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffd23f', stroke: '#1a1020', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(60);
    this.add.text(GAME_WIDTH - 14, 14, 'Hits', { fontFamily: 'monospace', fontSize: '11px', color: '#ff9a66' }).setOrigin(1, 0).setDepth(60);
    this.hitsText = this.add.text(GAME_WIDTH - 14, 28, '0', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', stroke: '#1a1020', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(60);

    this.hpBar = this.add.graphics().setDepth(60);
    // Stat strip sits in the gap BELOW the battlefield and ABOVE the footer panel
    // (footer title is at GAME_HEIGHT-138) so the two never overlap.
    this.statText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 168, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#e8dcff', align: 'center', lineSpacing: 2,
    }).setOrigin(0.5).setDepth(61);
    this.updateHpBar();
    this.updateStatText();

    const muteBtn = this.add.text(14, 16, this.audio.muted ? '[MUTED]' : '[SOUND]', {
      fontFamily: 'monospace', fontSize: '11px', color: '#b9a6d6', stroke: '#1a1020', strokeThickness: 2,
    }).setDepth(60).setInteractive({ useHandCursor: true });
    muteBtn.on('pointerup', () => muteBtn.setText(this.audio.toggleMute() ? '[MUTED]' : '[SOUND]'));
  }

  private updateHpBar(): void {
    const w = GAME_WIDTH - 28;
    const frac = this.hero ? this.hero.hp / this.hero.maxHp : 1;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x1a1020, 0.85).fillRect(14, GAME_HEIGHT - 200, w, 16);
    this.hpBar.fillStyle(0xe2483f, 1).fillRect(15, GAME_HEIGHT - 199, (w - 2) * Phaser.Math.Clamp(frac, 0, 1), 14);
  }

  private updateStatText(): void {
    const p = this.profile;
    this.statText.setText(
      `ATK ${fmt(Math.round(this.hero.atk * p.damageMul))}  ·  HP ${fmt(this.hero.hp)}  ·  LV ${this.level}\n` +
      `arrows ${p.arrows}${p.rearArrows ? '(+' + p.rearArrows + ' rear)' : ''}  pierce ${p.pierce}  bounce ${p.bounce}  crit ${Math.round(p.critChance * 100)}%`,
    );
  }

  private flashBanner(msg: string): void {
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, msg, {
      fontFamily: 'monospace', fontSize: '26px', color: '#7cf59b', stroke: '#1a1020', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(80);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }

  private gameOver(): void {
    if (this.over) return;
    this.over = true;
    // Cancel any pending/open level-up so its overlay can't sit over the defeat
    // screen (e.g. dying with queued level-ups).
    this.pendingLevels = 0;
    if (this.scene.isActive(SceneKeys.LevelUp)) this.scene.stop(SceneKeys.LevelUp);
    if (this.scene.isPaused()) this.scene.resume();
    this.audio.play(AudioKeys.Defeat);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.7).setOrigin(0).setDepth(90);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `DEFEATED\nFloor ${this.floor}\nTAP TO RETRY`, {
      fontFamily: 'monospace', fontSize: '30px', color: '#ff6b6b', align: 'center', stroke: '#1a1020', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(91);
    this.time.delayedCall(700, () => {
      this.input.once('pointerup', () => this.scene.start(SceneKeys.Menu));
      this.input.keyboard?.once('keydown', () => this.scene.start(SceneKeys.Menu));
    });
  }
}

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}
