// Team-wide buffs learned on level-up. Each skill mutates the shared TeamBuffs,
// which Unit reads when computing damage / attacks. Kept data-only (no Phaser).

export interface TeamBuffs {
  atkMul: number; // multiply every hero's attack
  hpMul: number; // multiply max hp (applied as a heal-on-gain too)
  defMul: number;
  haste: number; // multiply attack speed (lower interval); >1 = faster
  critChance: number; // 0..1
  critMul: number;
  lifesteal: number; // fraction of damage healed to the attacker
  extraHits: number; // additional strikes per attack
  doubleChance: number; // chance to attack twice
}

export function freshBuffs(): TeamBuffs {
  return {
    atkMul: 1, hpMul: 1, defMul: 1, haste: 1,
    critChance: 0.05, critMul: 1.8, lifesteal: 0,
    extraHits: 0, doubleChance: 0,
  };
}

export type Rarity = 'common' | 'rare' | 'epic';

export interface Skill {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: string; // a glyph drawn on the card (emoji-free; short label)
  maxStacks?: number;
  apply: (b: TeamBuffs) => void;
}

export const SKILL_POOL: Skill[] = [
  { id: 'atk', name: 'Sharpen', desc: '+20% team ATK', rarity: 'common', icon: 'ATK',
    apply: (b) => { b.atkMul *= 1.2; } },
  { id: 'hp', name: 'Vitality', desc: '+25% max HP & heal', rarity: 'common', icon: 'HP',
    apply: (b) => { b.hpMul *= 1.25; } },
  { id: 'def', name: 'Bulwark', desc: '+30% DEF', rarity: 'common', icon: 'DEF',
    apply: (b) => { b.defMul *= 1.3; } },
  { id: 'haste', name: 'Frenzy', desc: '+15% attack speed', rarity: 'common', icon: 'SPD',
    apply: (b) => { b.haste *= 1.15; } },
  { id: 'crit', name: 'Keen Eye', desc: '+12% crit chance', rarity: 'rare', maxStacks: 5, icon: 'CRIT',
    apply: (b) => { b.critChance = Math.min(0.85, b.critChance + 0.12); } },
  { id: 'critdmg', name: 'Deadly', desc: '+50% crit damage', rarity: 'rare', maxStacks: 4, icon: 'CDMG',
    apply: (b) => { b.critMul += 0.5; } },
  { id: 'lifesteal', name: 'Vampiric', desc: '+10% lifesteal', rarity: 'rare', maxStacks: 4, icon: 'LIFE',
    apply: (b) => { b.lifesteal = Math.min(0.6, b.lifesteal + 0.1); } },
  { id: 'multi', name: 'Flurry', desc: '+1 strike per attack', rarity: 'epic', maxStacks: 3, icon: '+1',
    apply: (b) => { b.extraHits += 1; } },
  { id: 'double', name: 'Double Up', desc: '+25% double-attack', rarity: 'epic', maxStacks: 3, icon: 'x2',
    apply: (b) => { b.doubleChance = Math.min(0.9, b.doubleChance + 0.25); } },
];

/** Pick `n` distinct skills, respecting maxStacks against the taken counts. */
export function rollChoices(taken: Record<string, number>, n: number): Skill[] {
  const avail = SKILL_POOL.filter((sk) => (taken[sk.id] ?? 0) < (sk.maxStacks ?? Infinity));
  const a = avail.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}
