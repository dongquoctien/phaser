// Attack-modifier roguelite (Archero / Survivor.io style). Skills don't add flat
// %; they CHANGE HOW THE HERO SHOOTS, and they COMPOUND. The whole run's picks
// accumulate into one AttackProfile that the firing code reads. Depth comes from
// synergy: multishot × pierce hits many enemies per arrow; crit × crit-dmg ×
// attack-speed multiply; burn/poison stack as %-style damage over time.

export interface AttackProfile {
  // base
  damageMul: number; // global damage multiplier (few skills touch this directly)
  attackInterval: number; // ms between shots (lowered by haste)
  projectileSpeed: number;

  // "difference in kind" modifiers — these change the shot pattern
  arrows: number; // projectiles per shot (multishot)
  spreadDeg: number; // fan spread for multi-arrows
  pierce: number; // enemies an arrow passes through before dying
  bounce: number; // ricochets to a new nearby enemy after a hit
  rearArrows: number; // arrows fired backwards too

  // on-hit effects
  critChance: number; // 0..1
  critMul: number;
  burn: number; // burn stacks added on hit (DoT, %-ish of hit dmg/sec)
  poison: number; // poison stacks added on hit (DoT)
  executeBelow: number; // instantly kill enemies under this HP fraction (0..1)
  lifesteal: number; // fraction of damage healed to the hero
  bonusVsFull: number; // extra damage multiplier vs full-HP enemies (first hit)
}

export function freshProfile(baseInterval: number, baseSpeed: number): AttackProfile {
  return {
    damageMul: 1, attackInterval: baseInterval, projectileSpeed: baseSpeed,
    arrows: 1, spreadDeg: 16, pierce: 0, bounce: 0, rearArrows: 0,
    critChance: 0.05, critMul: 2.0, burn: 0, poison: 0,
    executeBelow: 0, lifesteal: 0, bonusVsFull: 0,
  };
}

export type Rarity = 'common' | 'rare' | 'epic';

export interface Skill {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: string; // short glyph drawn on the card + footer chip
  tone: number; // chip background hint color
  maxStacks?: number;
  apply: (p: AttackProfile) => void;
}

// Tones for the footer chips, loosely matching the reference grid's colours.
const BLUE = 0x6f86c4, RED = 0xc05a5a, GREEN = 0x6aa84f, GOLD = 0xc8a23b, PURPLE = 0x9a6fc4;

export const SKILL_POOL: Skill[] = [
  // ── shot-pattern (difference in kind) ────────────────────────────────────
  { id: 'multishot', name: 'Multishot', desc: '+1 arrow per shot', rarity: 'rare', icon: '+1', tone: RED, maxStacks: 5,
    apply: (p) => { p.arrows += 1; } },
  { id: 'pierce', name: 'Piercing', desc: 'Arrows pierce +1 enemy', rarity: 'rare', icon: '>>', tone: GOLD, maxStacks: 5,
    apply: (p) => { p.pierce += 1; } },
  { id: 'bounce', name: 'Ricochet', desc: 'Arrows bounce to +1 enemy', rarity: 'rare', icon: '~>', tone: BLUE, maxStacks: 4,
    apply: (p) => { p.bounce += 1; } },
  { id: 'rear', name: 'Rear Arrow', desc: 'Also fire 1 arrow backward', rarity: 'epic', icon: '<>', tone: PURPLE, maxStacks: 2,
    apply: (p) => { p.rearArrows += 1; } },
  // ── attack speed / raw ───────────────────────────────────────────────────
  { id: 'haste', name: 'Swift Shot', desc: '+18% attack speed', rarity: 'common', icon: 'SPD', tone: BLUE, maxStacks: 8,
    apply: (p) => { p.attackInterval = Math.max(120, Math.round(p.attackInterval * 0.82)); } },
  { id: 'power', name: 'Power Shot', desc: '+25% damage', rarity: 'common', icon: 'PWR', tone: RED, maxStacks: 99,
    apply: (p) => { p.damageMul *= 1.25; } },
  // ── crit ─────────────────────────────────────────────────────────────────
  { id: 'crit', name: 'Precision', desc: '+12% crit chance', rarity: 'common', icon: 'CRT', tone: GOLD, maxStacks: 7,
    apply: (p) => { p.critChance = Math.min(0.9, p.critChance + 0.12); } },
  { id: 'critdmg', name: 'Lethal', desc: '+60% crit damage', rarity: 'rare', icon: 'x2', tone: RED, maxStacks: 5,
    apply: (p) => { p.critMul += 0.6; } },
  // ── DoT ──────────────────────────────────────────────────────────────────
  { id: 'burn', name: 'Blaze', desc: 'Hits set enemies on fire', rarity: 'rare', icon: 'FIRE', tone: RED, maxStacks: 4,
    apply: (p) => { p.burn += 1; } },
  { id: 'poison', name: 'Venom', desc: 'Hits poison enemies', rarity: 'rare', icon: 'PSN', tone: GREEN, maxStacks: 4,
    apply: (p) => { p.poison += 1; } },
  // ── conditional / execute ────────────────────────────────────────────────
  { id: 'execute', name: 'Reaper', desc: 'Execute enemies under 12% HP', rarity: 'epic', icon: 'SKL', tone: PURPLE, maxStacks: 3,
    apply: (p) => { p.executeBelow = Math.min(0.4, p.executeBelow + 0.12); } },
  { id: 'lifesteal', name: 'Bloodlust', desc: '+8% lifesteal', rarity: 'rare', icon: 'LIFE', tone: GREEN, maxStacks: 5,
    apply: (p) => { p.lifesteal = Math.min(0.6, p.lifesteal + 0.08); } },
  { id: 'ambush', name: 'Ambush', desc: '+40% dmg vs full-HP foes', rarity: 'common', icon: 'AMB', tone: GOLD, maxStacks: 4,
    apply: (p) => { p.bonusVsFull += 0.4; } },
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

export function skillById(id: string): Skill | undefined {
  return SKILL_POOL.find((s) => s.id === id);
}
