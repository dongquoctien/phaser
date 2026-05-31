import Phaser from 'phaser';
import type { Hero } from '../objects/Hero';
import {
  ARMOR_CAP,
  EQUIP_SLOTS,
  SLOT_OVERLAY_TEXTURE,
  ZERO_BONUS,
  slotBonus,
  type EquipBonus,
  type EquipSlot,
  type EquipTier,
} from '../types/equipment';

// Owns the hero's equipped gear: the equipped tier per slot, the aggregate stat
// bonus (recomputed from scratch — never blindly stacked), and 4 overlay Images
// that copy the hero's transform each frame so gear renders ON the hero.
//
// Stat contract (non-stacking):
//   • maxHp / moveSpeed live on the Hero → applied as a DELTA vs the previous
//     bonus (so re-equipping a better item only adds the difference, and a
//     positive maxHp delta also heals).
//   • armor / bulletDamage are read at one call-site each (contact damage, fire)
//     → exposed as getters, NOT written onto the hero/weapon.
export class Equipment {
  readonly slots: Record<EquipSlot, EquipTier> = { hat: 0, shirt: 0, gun: 0, shoes: 0 };
  private bonus: EquipBonus = { ...ZERO_BONUS };
  private overlays: Record<EquipSlot, Phaser.GameObjects.Image>;
  private onChange?: () => void;

  constructor(scene: Phaser.Scene, private hero: Hero) {
    const mk = (slot: EquipSlot) =>
      scene.add
        .image(hero.x, hero.y, SLOT_OVERLAY_TEXTURE[slot])
        .setOrigin(0.5)
        .setDepth(11) // just above the hero (depth 10)
        .setVisible(false);
    this.overlays = {
      shoes: mk('shoes'),
      shirt: mk('shirt'),
      hat: mk('hat'),
      gun: mk('gun'),
    };
  }

  /** Register a callback fired after a successful equip (e.g. footer refresh). */
  setOnChange(cb: () => void): void {
    this.onChange = cb;
  }

  /** Effective armor (0..ARMOR_CAP) — read at the contact-damage site. */
  get armor(): number {
    return Math.min(ARMOR_CAP, this.bonus.armor);
  }

  /** Flat bullet-damage add — read at the fire site (keeps weapon.damage pure). */
  get bulletDamage(): number {
    return this.bonus.bulletDamage;
  }

  /** Equip `tier` into `slot`, but only if it beats what's already worn. */
  equip(slot: EquipSlot, tier: EquipTier): boolean {
    if (tier <= this.slots[slot]) return false; // not an upgrade
    this.slots[slot] = tier;
    this.recompute();
    const ov = this.overlays[slot];
    ov.setTexture(SLOT_OVERLAY_TEXTURE[slot]).setVisible(true);
    this.onChange?.();
    return true;
  }

  /** Rebuild the aggregate bonus from the equipped tiers and re-apply deltas. */
  private recompute(): void {
    const prev = this.bonus;
    const next: EquipBonus = { ...ZERO_BONUS };
    for (const slot of EQUIP_SLOTS) {
      const b = slotBonus(slot, this.slots[slot]);
      next.maxHp += b.maxHp;
      next.armor += b.armor;
      next.bulletDamage += b.bulletDamage;
      next.moveSpeed += b.moveSpeed;
    }
    // maxHp lives on the hero — apply the delta and heal a positive change.
    const hpDelta = next.maxHp - prev.maxHp;
    if (hpDelta !== 0) {
      this.hero.maxHp += hpDelta;
      if (hpDelta > 0) this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + hpDelta);
    }
    // moveSpeed lives on the hero — apply the delta.
    this.hero.speed += next.moveSpeed - prev.moveSpeed;
    this.bonus = next;
  }

  /** Copy the hero's transform onto every visible overlay. Call each frame. */
  follow(): void {
    for (const slot of EQUIP_SLOTS) {
      const ov = this.overlays[slot];
      if (!ov.visible) continue;
      ov.x = this.hero.x;
      ov.y = this.hero.y;
      ov.rotation = this.hero.rotation;
      ov.setScale(this.hero.scaleX, this.hero.scaleY);
    }
  }
}
