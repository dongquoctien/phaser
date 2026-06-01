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
  readonly homeX: number;
  readonly homeY: number;

  sprite: Phaser.GameObjects.Image;
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

    this.sprite = scene.add.image(x, y, texture).setScale(opts.scale ?? 0.9).setDepth(10);
    // Heroes face right (default art); enemies face left.
    this.sprite.setFlipX(!opts.isHero);

    const barY = y - this.sprite.displayHeight / 2 - 8;
    this.barBg = scene.add.rectangle(x, barY, this.barW, 6, 0x1a1020).setDepth(11);
    this.barFill = scene.add
      .rectangle(x - this.barW / 2 + 1, barY, this.barW - 2, 4, opts.isHero ? 0x7ce06a : 0xe2483f)
      .setOrigin(0, 0.5)
      .setDepth(12);
  }

  get alive(): boolean {
    return this.hp > 0;
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
