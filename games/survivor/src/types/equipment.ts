import { TextureKeys, type TextureKey } from './keys';

// Four wearable slots. Each maps to a hero-overlay texture (drawn on the hero),
// a small icon texture (drop + footer), and a stat bonus that scales with tier.
export type EquipSlot = 'hat' | 'shirt' | 'gun' | 'shoes';

export const EQUIP_SLOTS: EquipSlot[] = ['hat', 'shirt', 'gun', 'shoes'];

// Tier 0 = empty. 1..3 = increasing quality (boss drops the high tiers).
export type EquipTier = 0 | 1 | 2 | 3;

// The aggregate buff from all equipped gear. Recomputed from scratch on every
// change (never blindly stacked) so replace-on-better is exact.
export interface EquipBonus {
  maxHp: number; // hat
  armor: number; // shirt — fractional contact-damage reduction (capped)
  bulletDamage: number; // gun — flat add to weapon damage
  moveSpeed: number; // shoes — flat add to hero speed
}

export const ZERO_BONUS: EquipBonus = { maxHp: 0, armor: 0, bulletDamage: 0, moveSpeed: 0 };

// Per-slot, the stat contributed by ONE tier. The slot's total = perTier × tier.
// armor is capped separately in the Equipment system (see ARMOR_CAP).
const PER_TIER: Record<EquipSlot, Partial<EquipBonus>> = {
  hat: { maxHp: 25 },
  shirt: { armor: 0.12 },
  gun: { bulletDamage: 6 },
  shoes: { moveSpeed: 14 },
};

export const ARMOR_CAP = 0.6;

/** The bonus a single equipped item of `slot` at `tier` contributes. */
export function slotBonus(slot: EquipSlot, tier: EquipTier): EquipBonus {
  const p = PER_TIER[slot];
  return {
    maxHp: (p.maxHp ?? 0) * tier,
    armor: (p.armor ?? 0) * tier,
    bulletDamage: (p.bulletDamage ?? 0) * tier,
    moveSpeed: (p.moveSpeed ?? 0) * tier,
  };
}

// Distinct textures: the hero overlay (big, baked on the hero grid) vs the small
// drop/footer icon.
export const SLOT_OVERLAY_TEXTURE: Record<EquipSlot, TextureKey> = {
  hat: TextureKeys.OvHat,
  shirt: TextureKeys.OvShirt,
  gun: TextureKeys.OvGun,
  shoes: TextureKeys.OvShoes,
};

export const SLOT_ICON_TEXTURE: Record<EquipSlot, TextureKey> = {
  hat: TextureKeys.IcoHat,
  shirt: TextureKeys.IcoShirt,
  gun: TextureKeys.IcoGun,
  shoes: TextureKeys.IcoShoes,
};

export const SLOT_LABEL: Record<EquipSlot, string> = {
  hat: 'Helmet',
  shirt: 'Armor',
  gun: 'Weapon',
  shoes: 'Boots',
};
