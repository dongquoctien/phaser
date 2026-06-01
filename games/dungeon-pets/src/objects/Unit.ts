import Phaser from 'phaser';

// A combatant — hero or enemy. A sprite + a small HP bar above it. Auto-battle
// logic (target select, damage) lives in GameScene; the Unit owns its own stats,
// HP bar, and the little attack-lunge / hurt-flash juice.
export class Unit {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  attackInterval: number; // ms (already includes archetype speed)
  nextAttackAt = 0;
  readonly isHero: boolean;
  homeX: number;
  homeY: number;

  // Damage-over-time (burn = red, poison = green). Each is a remaining-duration
  // (ms) + per-second damage; the scene ticks them via tickDot().
  burnUntil = 0;
  burnDps = 0;
  poisonUntil = 0;
  poisonDps = 0;

  // §4 telegraph: while > 0 the enemy is winding up a melee (rear back + red).
  telegraphUntil = 0;

  sprite: Phaser.GameObjects.Image;
  baseScale = 0.9; // the sprite's resting scale (juice tweens scale around this)
  private barBg: Phaser.GameObjects.Rectangle;
  private barFill: Phaser.GameObjects.Rectangle;
  private scene: Phaser.Scene;
  private barW = 44;

  constructor(
    scene: Phaser.Scene,
    texture: string,
    x: number,
    y: number,
    opts: { hp: number; atk: number; def: number; attackInterval: number; isHero: boolean; scale?: number },
  ) {
    this.scene = scene;
    this.homeX = x;
    this.homeY = y;
    this.isHero = opts.isHero;
    this.hp = opts.hp;
    this.maxHp = opts.hp;
    this.atk = opts.atk;
    this.def = opts.def;
    this.attackInterval = opts.attackInterval;

    this.baseScale = opts.scale ?? 0.9;
    this.sprite = scene.add.image(x, y, texture).setScale(this.baseScale).setDepth(10);
    // Heroes face right (default art); enemies face left.
    this.sprite.setFlipX(!opts.isHero);

    const barY = y - this.sprite.displayHeight / 2 - 8;
    this.barBg = scene.add.rectangle(x, barY, this.barW, 6, 0x1a1020).setDepth(11);
    this.barFill = scene.add
      .rectangle(x - this.barW / 2 + 1, barY, this.barW - 2, 4, opts.isHero ? 0x7ce06a : 0xe2483f)
      .setOrigin(0, 0.5)
      .setDepth(12);
  }

  dead = false; // set once when removed from play — guards double-kill

  get alive(): boolean {
    return !this.dead && this.hp > 0;
  }

  /** Apply incoming damage (already mitigated by caller). Returns true if killed. */
  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    this.updateBar();
    this.sprite.setTint(0xff6666);
    this.scene.time.delayedCall(80, () => this.sprite.clearTint());
    return this.hp <= 0;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.updateBar();
  }

  /** Squash-and-stretch pop when firing (§2 game-feel): stretch toward aim. */
  recoil(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseScale * 1.12, scaleY: this.baseScale * 0.9,
      duration: 70, yoyo: true, ease: 'Quad.easeOut',
    });
  }

  /** A slow breathing bob so idle units feel alive (§2 secondary action). */
  startIdleBob(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      scaleY: this.baseScale * 0.97,
      duration: 900 + Math.random() * 400,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  /** Brief positional knock from a hit (sprite only — homeX/anchor unchanged). */
  knockback(px: number): void {
    const dir = this.isHero ? -1 : 1; // enemies (facing left) get pushed right
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.homeX + dir * px,
      duration: 70, yoyo: true, ease: 'Quad.easeOut',
    });
  }

  /** Start a melee wind-up: rear back + red tint so the player can read it (§4). */
  startTelegraph(until: number): void {
    this.telegraphUntil = until;
    this.sprite.setTint(0xff5a5a);
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.homeX + (this.isHero ? 12 : -12), // pull back, away from the hero
      scaleX: this.sprite.scaleX * 1.08, scaleY: this.sprite.scaleY * 0.92,
      duration: 180, yoyo: true, ease: 'Sine.easeInOut',
    });
  }

  clearTelegraph(): void {
    if (this.telegraphUntil !== 0) {
      this.telegraphUntil = 0;
      this.sprite.clearTint();
    }
  }

  /** Add a burn/poison stack: dps scales with hit damage, refreshes duration. */
  applyBurn(dps: number, now: number): void {
    this.burnDps += dps;
    this.burnUntil = now + 2500;
  }
  applyPoison(dps: number, now: number): void {
    this.poisonDps += dps;
    this.poisonUntil = now + 3000;
  }

  /** Tick DoT; returns damage dealt this frame (caller checks for death). */
  tickDot(dt: number, now: number): number {
    let dmg = 0;
    if (now < this.burnUntil) dmg += this.burnDps * dt;
    else this.burnDps = 0;
    if (now < this.poisonUntil) dmg += this.poisonDps * dt;
    else this.poisonDps = 0;
    if (dmg > 0) {
      this.hp = Math.max(0, this.hp - dmg);
      this.updateBar();
      // subtle tint toward the active DoT colour
      this.sprite.setTint(now < this.burnUntil ? 0xff8c3a : 0x8cff6a);
      this.scene.time.delayedCall(60, () => { if (this.alive) this.sprite.clearTint(); });
    }
    return dmg;
  }

  /** Move the sprite (and home anchor) toward a target — enemies advancing. */
  advance(towardX: number, towardY: number, speed: number, dt: number): void {
    const dx = towardX - this.homeX;
    const dy = towardY - this.homeY;
    const d = Math.hypot(dx, dy) || 1;
    const step = Math.min(d, speed * dt);
    this.homeX += (dx / d) * step;
    this.homeY += (dy / d) * step;
    this.sprite.setPosition(this.homeX, this.homeY);
    this.syncBar();
  }

  private syncBar(): void {
    const barY = this.homeY - this.sprite.displayHeight / 2 - 8;
    this.barBg.setPosition(this.homeX, barY);
    this.barFill.setPosition(this.homeX - this.barW / 2 + 1, barY);
  }

  /** Raise max HP by a factor, scaling current HP with it. */
  scaleMaxHp(factor: number): void {
    this.maxHp = Math.round(this.maxHp * factor);
    this.hp = Math.min(this.maxHp, Math.round(this.hp * factor));
    this.updateBar();
  }

  /** A quick lunge toward the target for attack juice. */
  lunge(towardX: number): void {
    const dir = Math.sign(towardX - this.homeX) || 1;
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.homeX + dir * 16,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private updateBar(): void {
    const frac = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    this.barFill.width = (this.barW - 2) * frac;
  }

  destroy(): void {
    this.sprite.destroy();
    this.barBg.destroy();
    this.barFill.destroy();
  }

  /** Fade + shrink on death, then destroy. */
  die(onDone?: () => void): void {
    this.barBg.destroy();
    this.barFill.destroy();
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scale: this.sprite.scale * 0.6,
      angle: this.isHero ? -25 : 25,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.sprite.destroy();
        onDone?.();
      },
    });
  }
}
