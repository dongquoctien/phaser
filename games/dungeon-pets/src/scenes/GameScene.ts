import Phaser from 'phaser';
import { SceneKeys, AudioKeys, RegistryKeys, TextureKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, Tuning } from '../config';
import { Unit } from '../objects/Unit';
import { Audio } from '../systems/Audio';
import { STARTERS, PETS, heroById, statsFor, type HeroDef } from '../types/roster';
import { freshBuffs, type TeamBuffs, type Skill } from '../types/skills';

declare const __DEV__: boolean;

export class GameScene extends Phaser.Scene {
  private heroes: Unit[] = [];
  private enemies: Unit[] = [];
  private heroDefs: HeroDef[] = []; // parallel to heroes (for recompute on buff)
  private buffs: TeamBuffs = freshBuffs();
  private taken: Record<string, number> = {};
  private audio!: Audio;

  private floor = 1;
  private round = 1;
  private hits = 0;
  private level = 1;
  private xp = 0;
  private xpNeeded: number = Tuning.xpBase;
  private petsRecruited = 0;
  private over = false;
  private resolving = false; // between-wave pause

  // HUD
  private floorText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private hitsText!: Phaser.GameObjects.Text;
  private statText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Game);
  }

  create(data?: { team?: string[] }): void {
    this.heroes = [];
    this.enemies = [];
    this.heroDefs = [];
    this.buffs = freshBuffs();
    this.taken = {};
    this.floor = 1;
    this.round = 1;
    this.hits = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeeded = Tuning.xpBase;
    this.petsRecruited = 0;
    this.over = false;
    this.resolving = false;

    this.audio = new Audio(this);
    this.drawBackdrop();
    this.buildHud();

    // Resolve the chosen team (registry or passed data; fall back to first 3).
    const ids =
      data?.team ??
      (this.registry.get(RegistryKeys.Team) as string[] | undefined) ??
      STARTERS.slice(0, Tuning.teamSize).map((h) => h.id);
    ids.slice(0, Tuning.teamSize).forEach((id, i) => {
      const def = heroById(id) ?? STARTERS[i];
      this.addHero(def, i);
    });
    this.updateStatText(); // reflect the team now that heroes exist

    this.spawnWave();

    this.events.on('skillPicked', this.applySkill, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('skillPicked', this.applySkill, this);
    });

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      (this as unknown as Record<string, unknown>).__dev = {
        win: () => this.enemies.forEach((e) => e.alive && this.kill(e)),
        addXp: (n: number) => this.gainXp(n),
        state: () => ({ floor: this.floor, round: this.round, heroes: this.heroes.length, enemies: this.enemies.filter((e) => e.alive).length }),
      };
    }
  }

  // ── team / spawns ────────────────────────────────────────────────────────
  private heroSlotY(i: number, total: number): number {
    const span = Tuning.laneBottom - Tuning.laneTop;
    return Tuning.laneTop + (span * (i + 1)) / (total + 1);
  }

  private addHero(def: HeroDef, index: number): void {
    const total = Math.max(Tuning.teamSize, this.heroDefs.length + 1);
    const s = statsFor(def);
    const col = index % 2; // two columns so up to 8 fit
    const x = Tuning.heroLineX - col * 56;
    const y = this.heroSlotY(Math.floor(index / 2), Math.ceil(total / 2));
    const u = new Unit(this, def.texture, x, y, {
      hp: Math.round(s.hp * this.buffs.hpMul),
      atk: Math.round(s.atk * this.buffs.atkMul),
      def: Math.round(s.def * this.buffs.defMul),
      attackInterval: Tuning.attackInterval * def.attackSpeed / this.buffs.haste,
      isHero: true,
      scale: def.pet ? 0.95 : 1,
    });
    this.heroes.push(u);
    this.heroDefs.push(def);
  }

  private spawnWave(): void {
    const isBossRound = this.round === Tuning.roundsPerFloor && this.floor % Tuning.bossEveryFloors === 0;
    const hpScale = 1 + (this.floor - 1) * Tuning.enemyHpPerFloor;
    const atkScale = 1 + (this.floor - 1) * Tuning.enemyAtkPerFloor;

    if (isBossRound) {
      this.addEnemy(TextureKeys.Boss, 0, 1, { hp: 8, atk: 1.7, scale: 1.4 }, hpScale, atkScale);
      return;
    }
    const count = Phaser.Math.Between(Tuning.enemiesPerRoundMin, Tuning.enemiesPerRoundMax);
    for (let i = 0; i < count; i++) {
      const tex = Math.random() < 0.6 ? TextureKeys.Skeleton : TextureKeys.Slime;
      const tough = tex === TextureKeys.Skeleton ? { hp: 1, atk: 1 } : { hp: 1.4, atk: 0.7 };
      this.addEnemy(tex, i, count, { ...tough, scale: 0.9 }, hpScale, atkScale);
    }
  }

  private addEnemy(
    texture: string,
    index: number,
    count: number,
    mul: { hp: number; atk: number; scale: number },
    hpScale: number,
    atkScale: number,
  ): void {
    const span = Tuning.laneBottom - Tuning.laneTop;
    const y = count === 1 ? (Tuning.laneTop + Tuning.laneBottom) / 2 : Tuning.laneTop + (span * (index + 1)) / (count + 1);
    const col = index % 2;
    const x = Tuning.enemyLineX + col * 52;
    const u = new Unit(this, texture, x, y, {
      hp: Math.round(Tuning.enemyBaseHp * mul.hp * hpScale),
      atk: Math.round(Tuning.enemyBaseAtk * mul.atk * atkScale),
      def: 0,
      attackInterval: Tuning.attackInterval * 1.1,
      isHero: false,
      scale: mul.scale,
    });
    this.enemies.push(u);
  }

  // ── main loop ────────────────────────────────────────────────────────────
  update(time: number): void {
    if (this.over || this.resolving) return;

    for (const h of this.heroes) {
      if (!h.alive) continue;
      if (time >= h.nextAttackAt) {
        const target = this.nearestAlive(this.enemies, h);
        if (target) this.performAttack(h, target);
        h.nextAttackAt = time + h.attackInterval;
      }
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (time >= e.nextAttackAt) {
        const target = this.nearestAlive(this.heroes, e);
        if (target) this.performAttack(e, target);
        e.nextAttackAt = time + e.attackInterval;
      }
    }
  }

  private nearestAlive(list: Unit[], from: Unit): Unit | null {
    let best: Unit | null = null;
    let bestD = Infinity;
    for (const u of list) {
      if (!u.alive) continue;
      const d = Math.abs(u.homeY - from.homeY); // same lane band → vertical proximity
      if (d < bestD) { bestD = d; best = u; }
    }
    return best;
  }

  private performAttack(attacker: Unit, target: Unit): void {
    attacker.lunge(target.homeX);
    const strikes = attacker.isHero ? 1 + this.buffs.extraHits + (Math.random() < this.buffs.doubleChance ? 1 : 0) : 1;
    let totalDamage = 0;
    for (let s = 0; s < strikes; s++) {
      let dmg = Math.max(1, attacker.atk - target.def);
      if (attacker.isHero && Math.random() < this.buffs.critChance) dmg = Math.round(dmg * this.buffs.critMul);
      totalDamage += dmg;
    }
    this.audio.play(AudioKeys.Hit);
    this.spawnSlash(target.homeX, target.homeY);
    if (attacker.isHero) {
      this.hits += strikes;
      this.hitsText.setText(`${this.hits}`);
      if (this.buffs.lifesteal > 0) attacker.heal(Math.round(totalDamage * this.buffs.lifesteal));
    }
    const killed = target.takeDamage(totalDamage);
    if (killed) this.kill(target);
  }

  private spawnSlash(x: number, y: number): void {
    const s = this.add.image(x, y, TextureKeys.Slash).setScale(0.7).setDepth(20).setAlpha(0.95);
    this.tweens.add({ targets: s, alpha: 0, scale: 1.0, duration: 180, onComplete: () => s.destroy() });
  }

  private kill(target: Unit): void {
    target.die();
    if (target.isHero) {
      // Keep heroDefs aligned with heroes when one dies.
      const i = this.heroes.indexOf(target);
      if (i >= 0) {
        this.heroes.splice(i, 1);
        this.heroDefs.splice(i, 1);
      }
      if (this.heroes.length === 0) { this.gameOver(); return; }
    } else {
      this.enemies = this.enemies.filter((e) => e !== target);
      this.gainXp(Tuning.xpPerKill);
      if (this.enemies.length === 0 && !this.over) this.advanceRound();
    }
  }

  // ── progression ──────────────────────────────────────────────────────────
  private advanceRound(): void {
    this.resolving = true;
    this.time.delayedCall(450, () => {
      if (this.over) return;
      if (this.round >= Tuning.roundsPerFloor) {
        this.advanceFloor();
      } else {
        this.round += 1;
        this.roundText.setText(`Round ${this.round}/${Tuning.roundsPerFloor}`);
        this.spawnWave();
      }
      this.resolving = false;
    });
  }

  private advanceFloor(): void {
    this.floor += 1;
    this.round = 1;
    const best = (this.registry.get(RegistryKeys.BestFloor) as number) ?? 0;
    if (this.floor - 1 > best) this.registry.set(RegistryKeys.BestFloor, this.floor - 1);
    this.floorText.setText(`Dungeon Floor ${this.floor}`);
    this.roundText.setText(`Round 1/${Tuning.roundsPerFloor}`);
    // Heal the team a bit each floor.
    for (const h of this.heroes) h.heal(Math.round(h.maxHp * 0.4));
    // Recruit a pet every N floors.
    if ((this.floor - 1) % Tuning.recruitEveryFloors === 0 && this.heroes.length < Tuning.maxTeam) {
      const pet = PETS[this.petsRecruited % PETS.length];
      if (pet) {
        this.petsRecruited += 1;
        this.relayoutAndAddPet(pet);
        this.audio.play(AudioKeys.LevelUp);
        this.flashBanner(`${pet.name} joined!`);
      }
    }
    this.updateStatText();
    this.spawnWave();
  }

  private relayoutAndAddPet(pet: HeroDef): void {
    // Append the pet; reposition all heroes to keep the formation tidy.
    this.addHero(pet, this.heroes.length);
    this.repositionHeroes();
  }

  private repositionHeroes(): void {
    const total = this.heroes.length;
    this.heroes.forEach((h, i) => {
      const col = i % 2;
      const x = Tuning.heroLineX - col * 56;
      const y = this.heroSlotY(Math.floor(i / 2), Math.ceil(total / 2));
      this.tweens.add({ targets: h.sprite, x, y, duration: 250 });
    });
  }

  // ── xp / level ───────────────────────────────────────────────────────────
  private gainXp(n: number): void {
    if (this.over) return;
    this.xp += n;
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level += 1;
      this.xpNeeded = Math.round(this.xpNeeded * Tuning.xpGrowth);
      this.levelUp();
    }
  }

  private levelUp(): void {
    this.audio.play(AudioKeys.LevelUp);
    this.resolving = true;
    this.scene.pause();
    this.scene.launch(SceneKeys.LevelUp, { taken: this.taken, gameKey: SceneKeys.Game });
  }

  private applySkill(skill: Skill): void {
    this.taken[skill.id] = (this.taken[skill.id] ?? 0) + 1;
    const before = { ...this.buffs };
    skill.apply(this.buffs);
    this.audio.play(AudioKeys.Skill);
    // Re-derive hero stats from the new buffs (max-hp / atk / def / haste).
    this.heroes.forEach((h, i) => {
      const base = statsFor(this.heroDefs[i]);
      h.atk = Math.round(base.atk * this.buffs.atkMul);
      h.def = Math.round(base.def * this.buffs.defMul);
      h.attackInterval = Tuning.attackInterval * this.heroDefs[i].attackSpeed / this.buffs.haste;
      if (this.buffs.hpMul !== before.hpMul) h.scaleMaxHp(this.buffs.hpMul / before.hpMul);
    });
    this.updateStatText();
    this.resolving = false;
  }

  // ── HUD / backdrop ───────────────────────────────────────────────────────
  private drawBackdrop(): void {
    // dungeon gradient + floor band
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x20162e).setOrigin(0).setDepth(-2);
    this.add.rectangle(0, 200, GAME_WIDTH, 90, 0x2c2140).setOrigin(0).setDepth(-1);
    const lane = this.add.rectangle(0, Tuning.laneTop - 30, GAME_WIDTH, Tuning.laneBottom - Tuning.laneTop + 90, 0x3a2f55).setOrigin(0).setDepth(-1);
    lane.setAlpha(0.9);
    // floor stones suggestion
    const g = this.add.graphics().setDepth(-1);
    g.lineStyle(1, 0xffffff, 0.04);
    for (let y = Tuning.laneTop + 40; y < Tuning.laneBottom + 60; y += 40) g.lineBetween(0, y, GAME_WIDTH, y);
  }

  private buildHud(): void {
    this.floorText = this.add.text(GAME_WIDTH / 2, 22, 'Dungeon Floor 1', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', stroke: '#1a1020', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(60);
    this.roundText = this.add.text(GAME_WIDTH / 2, 56, `Round 1/${Tuning.roundsPerFloor}`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffd23f', stroke: '#1a1020', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(60);
    this.add.text(GAME_WIDTH - 14, 16, 'Hits', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ff9a66',
    }).setOrigin(1, 0).setDepth(60);
    this.hitsText = this.add.text(GAME_WIDTH - 14, 30, '0', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', stroke: '#1a1020', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(60);

    // stat strip
    this.statText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 90, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#e8dcff', align: 'center',
    }).setOrigin(0.5).setDepth(60);
    this.updateStatText();

    const muteBtn = this.add.text(14, 16, this.audio.muted ? '[MUTED]' : '[SOUND]', {
      fontFamily: 'monospace', fontSize: '11px', color: '#b9a6d6', stroke: '#1a1020', strokeThickness: 2,
    }).setDepth(60).setInteractive({ useHandCursor: true });
    muteBtn.on('pointerup', () => muteBtn.setText(this.audio.toggleMute() ? '[MUTED]' : '[SOUND]'));
  }

  private updateStatText(): void {
    const team = this.heroes.length;
    const atk = this.heroes.reduce((s, h) => s + h.atk, 0);
    const hp = this.heroes.reduce((s, h) => s + h.hp, 0);
    this.statText.setText(`TEAM ${team}   ATK ${fmt(atk)}   HP ${fmt(hp)}   LV ${this.level}`);
  }

  private flashBanner(msg: string): void {
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, msg, {
      fontFamily: 'monospace', fontSize: '26px', color: '#7cf59b', stroke: '#1a1020', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(80);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }

  // ── death ────────────────────────────────────────────────────────────────
  private gameOver(): void {
    if (this.over) return;
    this.over = true;
    this.audio.play(AudioKeys.Defeat);
    const reached = this.floor;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.7).setOrigin(0).setDepth(90);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `DEFEATED\nFloor ${reached}\nTAP TO RETRY`, {
      fontFamily: 'monospace', fontSize: '30px', color: '#ff6b6b', align: 'center', stroke: '#1a1020', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(91);
    this.time.delayedCall(700, () => {
      this.input.once('pointerup', () => this.scene.start(SceneKeys.Menu));
      this.input.keyboard?.once('keydown', () => this.scene.start(SceneKeys.Menu));
    });
  }
}

function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
