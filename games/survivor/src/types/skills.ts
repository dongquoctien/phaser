import { Tuning } from '../tuning';
import { TextureKeys, type TextureKey } from './keys';
import type { Hero } from '../objects/Hero';

export type Rarity = 'common' | 'rare' | 'epic';

// Mutable run state that skills modify. WeaponStats lives here so weapon skills
// can buff fire rate / projectile count without touching the hero.
export interface WeaponStats {
  fireInterval: number;
  damage: number;
  projectileCount: number;
}

export interface RunState {
  hero: Hero;
  weapon: WeaponStats;
}

export interface Skill {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: TextureKey; // baked skill-icon texture (level-up card + footer chip)
  maxStacks?: number; // default Infinity
  apply: (s: RunState) => void;
}

export function makeWeaponStats(): WeaponStats {
  return {
    fireInterval: Tuning.fireInterval,
    damage: Tuning.bulletDamage,
    projectileCount: Tuning.projectileCount,
  };
}

export const SKILL_POOL: Skill[] = [
  {
    id: 'dmg',
    name: 'Sharp Rounds',
    desc: '+25% bullet damage',
    rarity: 'common',
    icon: TextureKeys.SkDmg,
    apply: (s) => {
      s.weapon.damage = Math.round(s.weapon.damage * 1.25);
    },
  },
  {
    id: 'rate',
    name: 'Rapid Fire',
    desc: '-15% fire interval',
    rarity: 'common',
    icon: TextureKeys.SkRate,
    apply: (s) => {
      s.weapon.fireInterval = Math.max(90, Math.round(s.weapon.fireInterval * 0.85));
    },
  },
  {
    id: 'multi',
    name: 'Split Shot',
    desc: '+1 projectile',
    rarity: 'rare',
    icon: TextureKeys.SkMulti,
    maxStacks: 4,
    apply: (s) => {
      s.weapon.projectileCount += 1;
    },
  },
  {
    id: 'speed',
    name: 'Light Boots',
    desc: '+12% move speed',
    rarity: 'common',
    icon: TextureKeys.SkSpeed,
    apply: (s) => {
      s.hero.speed = Math.round(s.hero.speed * 1.12);
    },
  },
  {
    id: 'hp',
    name: 'Vitality',
    desc: '+25 max HP & heal',
    rarity: 'common',
    icon: TextureKeys.SkHp,
    apply: (s) => {
      s.hero.maxHp += 25;
      s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + 25);
    },
  },
  {
    id: 'magnet',
    name: 'Magnet',
    desc: '+40% pickup radius',
    rarity: 'rare',
    icon: TextureKeys.SkMagnet,
    apply: (s) => {
      s.hero.pickupRadius = Math.round(s.hero.pickupRadius * 1.4);
    },
  },
  {
    id: 'regen',
    name: 'Bandages',
    desc: 'Heal 30 HP now',
    rarity: 'common',
    icon: TextureKeys.SkHeal,
    apply: (s) => {
      s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + 30);
    },
  },
  {
    id: 'glass',
    name: 'Glass Cannon',
    desc: '+60% damage',
    rarity: 'epic',
    icon: TextureKeys.SkGlass,
    maxStacks: 2,
    apply: (s) => {
      s.weapon.damage = Math.round(s.weapon.damage * 1.6);
    },
  },
];

/** Pick `n` distinct skills, respecting maxStacks against the taken counts. */
export function rollChoices(
  taken: Record<string, number>,
  n: number,
): Skill[] {
  const avail = SKILL_POOL.filter(
    (sk) => (taken[sk.id] ?? 0) < (sk.maxStacks ?? Infinity),
  );
  // Shuffle (Fisher–Yates) a copy, take n.
  const a = avail.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}
