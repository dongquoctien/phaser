import { TextureKeys, type TextureKey } from './keys';

// ── Heroes ───────────────────────────────────────────────────────────────────
// 25 chibi heroes from the user's reference images, each with a DISTINCT skill.
// Names are the user's own. The engine reads `attack` (how it delivers damage) +
// `skill` (the special effect), so behaviour is fully data-driven.

export type HeroId =
  // image 1 (9)
  | 'evilcat' | 'mymy' | 'oreo' | 'rwah' | 'emso' | 'mimi' | 'chippy' | 'gauem' | 'normal'
  // image 2 (6)
  | 'kenken' | 'oldbear' | 'bluefoo' | 'nixxx' | 'gauchi' | 'gei'
  // image 3 (6)
  | 'yunseo' | 'dongdong' | 'midori' | 'anzu' | 'nini' | 'hakj'
  // image 4 (4)
  | 'chuotchu' | 'meomeo' | 'doraemon' | 'shiba';

export type AttackKind = 'projectile' | 'melee' | 'aura' | 'nova';

export type SkillKind =
  | 'pierce' | 'cleave' | 'multishot' | 'poison' | 'heal' | 'crit' | 'slow'
  | 'splash' | 'chain' | 'goldaura' | 'sticky' | 'doublestrike' | 'knockback'
  | 'firenova' | 'stun'
  // image-3 additions:
  | 'bleed'      // stacking damage-over-time (heavier than poison)
  | 'rapidfire'  // very fast low-damage projectile
  | 'doubleshot' // two bolts at the front target
  | 'buffaura'   // aura: boosts damage of heroes in range
  | 'execute'    // bonus damage vs low-hp zombies
  | 'bounce'     // projectile splashes + slows (water bounce)
  // image-4 additions:
  | 'bounceball' // a ball that bounces between adjacent zombies (Shiba); bounces grow per tier
  | 'gnaw'       // each hit stacks vulnerability — the same zombie takes more each bite (Jibgor)
  | 'roar'       // shot lands + a fear-roar: AoE damage + brief stun (Lionyori)
  | 'aircannon'; // Doraemon's Air Cannon: a piercing air-blast that knocks a line back (Mr.Hoang)

export interface HeroTier {
  range: number; fireInterval: number; damage: number; cost: number;
  bounces?: number; // bounceball (Shiba): extra zombies the ball hops to — scales per tier
}

export interface HeroDef {
  id: HeroId;
  name: string;
  tex: TextureKey;
  proj: TextureKey | null;
  projSpeed: number;
  attack: AttackKind;
  skill: SkillKind;
  pierce?: number;
  shots?: number;
  dotDps?: number;
  dotDuration?: number;
  critChance?: number;
  critMul?: number;
  slowFactor?: number;
  slowDuration?: number;
  splashRadius?: number;
  chainJumps?: number;
  chainRange?: number;
  goldBonus?: number;
  knockback?: number;
  stunDuration?: number;
  healPerTick?: number;
  buffMul?: number;       // buffaura: damage multiplier for nearby heroes
  executeThreshold?: number; // execute: hp fraction below which bonus applies
  executeMul?: number;
  tint: string;
  blurb: string;
  lore: string; // short flavour bio shown in the hero-detail panel
}

// Hero max level. The three authored anchors map to levels 1, MID, and MAX; the
// engine interpolates the in-between levels so every hero has 10 upgrade steps.
export const MAX_LEVEL = 10;
const MID_LEVEL = 5; // 1-based level the middle anchor sits on

// Build 10 interpolated tiers from 3 authored anchors. Numeric stats + skill params
// (damage/range/fireInterval and any bounces/splashRadius/chainJumps/shots/dot…)
// lerp between anchors; `cost` is the price to REACH that level and grows +10% per
// level over the previous (compounding), seeded from the base anchor cost.
function tiers(base: HeroTier, t1: Partial<HeroTier>, t2: Partial<HeroTier>): HeroTier[] {
  const a0 = { ...base } as Record<string, number>;
  const a1 = { ...base, ...t1 } as Record<string, number>;
  const a2 = { ...base, ...t2 } as Record<string, number>;
  const keys = new Set<string>([...Object.keys(a0), ...Object.keys(a1), ...Object.keys(a2)]);
  keys.delete('cost'); // cost handled separately

  const lerp = (p: number, lo: number, hi: number) => lo + (hi - lo) * p;
  const out: HeroTier[] = [];
  for (let lv = 0; lv < MAX_LEVEL; lv++) {
    const t: Record<string, number> = {};
    for (const k of keys) {
      // pick the anchor pair this level falls between (anchors at 0, MID-1, MAX-1)
      const midIdx = MID_LEVEL - 1, maxIdx = MAX_LEVEL - 1;
      let v: number;
      if (lv <= midIdx) {
        const p = midIdx === 0 ? 0 : lv / midIdx;
        v = lerp(p, a0[k] ?? 0, a1[k] ?? a0[k] ?? 0);
      } else {
        const p = (lv - midIdx) / (maxIdx - midIdx);
        v = lerp(p, a1[k] ?? 0, a2[k] ?? a1[k] ?? 0);
      }
      // integer-ish stats round; fractional skill params (slowFactor) keep 2 dp
      t[k] = Math.abs(v) < 3 && !Number.isInteger(v) ? Math.round(v * 100) / 100 : Math.round(v);
    }
    // cost: base for level 1; each subsequent level +10% compounding
    t.cost = Math.round((base.cost) * Math.pow(1.1, lv) / 5) * 5; // round to nearest 5
    out.push(t as unknown as HeroTier);
  }
  return out;
}

type Full = HeroDef & { tiers: HeroTier[] };

export const HEROES: Record<HeroId, Full> = {
  // ── image 1 ──
  evilcat: {
    id: 'evilcat', name: 'Evil Cat', tex: TextureKeys.HeroEvilCat, proj: TextureKeys.ProjArcane, projSpeed: 360,
    attack: 'projectile', skill: 'pierce', pierce: 2, tint: '#a86fff',
    blurb: 'Arcane bolt pierces through 2 extra zombies in a line.',
    lore: 'A grumpy library cat who learned forbidden spells from a chewed-up grimoire. Hates noise, loves naps — and incinerating the undead.',
    tiers: tiers({ range: 130, fireInterval: 520, damage: 22, cost: 90 }, { damage: 34, cost: 110, range: 145 }, { damage: 54, cost: 180 }),
  },
  mymy: {
    id: 'mymy', name: 'Mymy', tex: TextureKeys.HeroMymy, proj: null, projSpeed: 0,
    attack: 'melee', skill: 'cleave', tint: '#e0533d',
    blurb: 'Katana cleaves EVERY zombie in melee range at once.',
    lore: 'Last bear of the Honey Blossom dojo. Vowed to protect the village after the outbreak took his master. One swing, many fewer zombies.',
    tiers: tiers({ range: 72, fireInterval: 700, damage: 28, cost: 110 }, { damage: 44, cost: 140, range: 80 }, { damage: 72, cost: 230, range: 92 }),
  },
  oreo: {
    id: 'oreo', name: 'Oreo', tex: TextureKeys.HeroOreo, proj: TextureKeys.ProjArrow, projSpeed: 420,
    attack: 'projectile', skill: 'multishot', shots: 3, tint: '#ff7da8',
    blurb: 'Throws shuriken at the 3 nearest zombies each volley.',
    lore: 'Top of her class in the ninja club — right before class got cancelled forever. Now her homework is survival, and she always hits the deadline.',
    tiers: tiers({ range: 135, fireInterval: 620, damage: 9, cost: 100 }, { damage: 14, cost: 130 }, { damage: 22, cost: 200, shots: 4 } as Partial<HeroTier>),
  },
  rwah: {
    id: 'rwah', name: 'Rwah', tex: TextureKeys.HeroRwah, proj: TextureKeys.ProjPoison, projSpeed: 320,
    attack: 'projectile', skill: 'poison', dotDps: 12, dotDuration: 3, tint: '#73c736',
    blurb: 'Potion shot poisons zombies — damage ticks over time.',
    lore: 'A swamp goblin who brews "energy drinks" that are 90% toxic sludge. Zombies that taste one regret it for a long, melting while.',
    tiers: tiers({ range: 125, fireInterval: 800, damage: 8, cost: 95 }, { damage: 12, cost: 120 }, { damage: 18, cost: 190 }),
  },
  emso: {
    id: 'emso', name: 'Emso', tex: TextureKeys.HeroEmso, proj: null, projSpeed: 0,
    attack: 'aura', skill: 'heal', healPerTick: 1, tint: '#ffd23f',
    blurb: 'Calm aura: slowly restores a life and trickles gold.',
    lore: 'The most unbothered capybara alive. Apocalypse or not, she tends her tulips. Standing near her, somehow, makes everything feel survivable.',
    tiers: tiers({ range: 120, fireInterval: 5000, damage: 0, cost: 130 }, { fireInterval: 4000, cost: 150, range: 140 }, { fireInterval: 3000, cost: 240, range: 160 }),
  },
  mimi: {
    id: 'mimi', name: 'Mimi', tex: TextureKeys.HeroMimi, proj: TextureKeys.ProjBullet, projSpeed: 720,
    attack: 'projectile', skill: 'crit', critChance: 0.3, critMul: 3, tint: '#ff5d8f',
    blurb: 'Long-range camera-shot with a chance for a 3× critical.',
    lore: 'A fashion-blogger cat who refused to let the end of the world ruin her aesthetic. Her "camera" fires real rounds. Say cheese.',
    tiers: tiers({ range: 230, fireInterval: 1100, damage: 30, cost: 120 }, { damage: 48, cost: 160, range: 255 }, { damage: 78, cost: 260 }),
  },
  chippy: {
    id: 'chippy', name: 'Chippy', tex: TextureKeys.HeroChippy, proj: TextureKeys.ProjFrost, projSpeed: 340,
    attack: 'projectile', skill: 'slow', slowFactor: 0.5, slowDuration: 2, tint: '#73eff7',
    blurb: 'Frost shot chills zombies to half speed for 2s.',
    lore: 'A tiny hamster who never took off his winter beanie — turns out it is enchanted with eternal frost. Cute, cold, and very effective.',
    tiers: tiers({ range: 130, fireInterval: 700, damage: 10, cost: 100 }, { damage: 16, cost: 130 }, { damage: 24, cost: 210 }),
  },
  gauem: {
    id: 'gauem', name: 'Gau Em', tex: TextureKeys.HeroGauEm, proj: TextureKeys.ProjSpit, projSpeed: 300,
    attack: 'projectile', skill: 'splash', splashRadius: 44, tint: '#c9a96a',
    blurb: 'Spits a glob that splashes damage to nearby zombies.',
    lore: 'Looks adorable, spits like a cannon. This alpaca was kicked out of three petting zoos before the outbreak — now that talent finally pays off.',
    tiers: tiers({ range: 120, fireInterval: 950, damage: 24, cost: 110 }, { damage: 38, cost: 150 }, { damage: 60, cost: 240, splashRadius: 56 } as Partial<HeroTier>),
  },
  normal: {
    id: 'normal', name: 'Normal', tex: TextureKeys.HeroNormal, proj: TextureKeys.ProjBolt, projSpeed: 600,
    attack: 'projectile', skill: 'chain', chainJumps: 3, chainRange: 70, tint: '#7df9ff',
    blurb: 'Lightning leaps from zombie to zombie (3 jumps).',
    lore: 'Just a "normal" tuxedo cat — except for the static electricity that follows him everywhere. Pet him at your own risk; zombies certainly do not survive it.',
    tiers: tiers({ range: 140, fireInterval: 850, damage: 20, cost: 115 }, { damage: 32, cost: 150 }, { damage: 50, cost: 250, chainJumps: 4 } as Partial<HeroTier>),
  },
  // ── image 2 ──
  kenken: {
    id: 'kenken', name: 'Kenken', tex: TextureKeys.HeroKenken, proj: null, projSpeed: 0,
    attack: 'aura', skill: 'goldaura', goldBonus: 3, tint: '#ffe066',
    blurb: 'Gold aura: zombies dying nearby drop bonus gold.',
    lore: 'A retired economics professor who insists every fallen zombie is a "liquidation event." Somehow he is always right, and the gold keeps coming.',
    tiers: tiers({ range: 130, fireInterval: 1000, damage: 0, cost: 140 }, { cost: 160, goldBonus: 5, range: 150 } as Partial<HeroTier>, { cost: 250, goldBonus: 8, range: 170 } as Partial<HeroTier>),
  },
  oldbear: {
    id: 'oldbear', name: 'Kho Chiu Vo Cung', tex: TextureKeys.HeroOldBear, proj: TextureKeys.ProjSpit, projSpeed: 280,
    attack: 'projectile', skill: 'sticky', slowFactor: 0.35, slowDuration: 2.5, tint: '#b98a5e',
    blurb: 'Sticky boba shot greatly slows zombies (low damage).',
    lore: 'Ran the last surviving boba shop on the block. His tapioca recipe is so thick it can glue a brute to the pavement. Extra pearls, no mercy.',
    tiers: tiers({ range: 120, fireInterval: 800, damage: 6, cost: 95 }, { cost: 120, slowFactor: 0.3, damage: 9 } as Partial<HeroTier>, { cost: 190, slowFactor: 0.25, damage: 14 } as Partial<HeroTier>),
  },
  bluefoo: {
    id: 'bluefoo', name: 'Bluefoo', tex: TextureKeys.HeroBluefoo, proj: null, projSpeed: 0,
    attack: 'melee', skill: 'doublestrike', tint: '#5b8cff',
    blurb: 'Lightning-fast dual strikes on a single nearby zombie.',
    lore: 'A wandering swordsman with blue hair and a colder stare. Speaks little, strikes twice before you blink. Nobody has seen his second blade move.',
    tiers: tiers({ range: 64, fireInterval: 260, damage: 12, cost: 120 }, { damage: 18, cost: 150, fireInterval: 220 }, { damage: 28, cost: 240, fireInterval: 180 }),
  },
  nixxx: {
    id: 'nixxx', name: 'Nixxx', tex: TextureKeys.HeroNixxx, proj: TextureKeys.ProjBullet, projSpeed: 380,
    attack: 'projectile', skill: 'knockback', knockback: 26, tint: '#cdd6e6',
    blurb: 'Hits knock zombies back down the road.',
    lore: 'A fluffy ragdoll cat who looks soft but hits like a truck. Pampered her whole life — now she shoves the undead back where they came from, unbothered.',
    tiers: tiers({ range: 120, fireInterval: 750, damage: 16, cost: 105 }, { damage: 26, cost: 140, knockback: 34 } as Partial<HeroTier>, { damage: 42, cost: 230, knockback: 44 } as Partial<HeroTier>),
  },
  gauchi: {
    id: 'gauchi', name: 'Gau Chi', tex: TextureKeys.HeroGauChi, proj: null, projSpeed: 0,
    attack: 'nova', skill: 'firenova', tint: '#ff9924',
    blurb: 'Erupts a fire ring, scorching every zombie around it.',
    lore: 'A sweet bunny who really, really likes scented candles. A little too much. The ring of flame around her is both decor and a death sentence.',
    tiers: tiers({ range: 95, fireInterval: 1400, damage: 22, cost: 130 }, { damage: 36, cost: 170, range: 108 }, { damage: 58, cost: 270, range: 120 }),
  },
  gei: {
    id: 'gei', name: 'Gei', tex: TextureKeys.HeroGei, proj: null, projSpeed: 0,
    attack: 'nova', skill: 'stun', stunDuration: 1, tint: '#d98a3a',
    blurb: 'Ground slam damages and stuns zombies in range.',
    lore: 'Never skips leg day, or arm day, or any day. This overall-wearing bear bench-presses tractors for fun. His ground slam rattles teeth two lanes over.',
    tiers: tiers({ range: 88, fireInterval: 2000, damage: 18, cost: 135 }, { damage: 30, cost: 175, stunDuration: 1.2 } as Partial<HeroTier>, { damage: 50, cost: 280, stunDuration: 1.5 } as Partial<HeroTier>),
  },
  // ── image 3 (new skills) ──
  yunseo: {
    id: 'yunseo', name: 'Yunseo', tex: TextureKeys.HeroYunseo, proj: TextureKeys.ProjPoison, projSpeed: 360,
    attack: 'projectile', skill: 'bleed', dotDps: 22, dotDuration: 2.5, tint: '#ff9fce',
    blurb: 'Bleed shot: heavy stacking damage-over-time.',
    lore: 'A cheerful girl in a pink piggy onesie — do not let it fool you. Her darts leave wounds that just will not close. Sweetest face on the wall.',
    tiers: tiers({ range: 130, fireInterval: 900, damage: 10, cost: 105 }, { damage: 16, cost: 135, dotDps: 32 } as Partial<HeroTier>, { damage: 24, cost: 210, dotDps: 46 } as Partial<HeroTier>),
  },
  dongdong: {
    id: 'dongdong', name: 'Dong Dong', tex: TextureKeys.HeroDongDong, proj: TextureKeys.ProjBullet, projSpeed: 560,
    attack: 'projectile', skill: 'rapidfire', tint: '#ffd23f',
    blurb: 'Fires extremely fast, low-damage shots.',
    lore: 'Caffeine incarnate. Dong Dong has never stood still in her life, and her trigger finger is no exception. Blink and she has fired twelve times.',
    tiers: tiers({ range: 120, fireInterval: 200, damage: 6, cost: 110 }, { damage: 9, cost: 140, fireInterval: 170 }, { damage: 14, cost: 230, fireInterval: 140 }),
  },
  midori: {
    id: 'midori', name: 'Midori', tex: TextureKeys.HeroMidori, proj: TextureKeys.ProjArrow, projSpeed: 440,
    attack: 'projectile', skill: 'doubleshot', shots: 2, tint: '#73c736',
    blurb: 'Looses two arrows at the front zombie every shot.',
    lore: 'A quiet girl with cat-ear clips and uncanny aim. She fires two arrows so close together they sound like one. Midori means "green" — and she never misses.',
    tiers: tiers({ range: 140, fireInterval: 640, damage: 12, cost: 110 }, { damage: 19, cost: 145 }, { damage: 30, cost: 235 }),
  },
  anzu: {
    id: 'anzu', name: 'Anzu', tex: TextureKeys.HeroAnzu, proj: null, projSpeed: 0,
    attack: 'aura', skill: 'buffaura', buffMul: 1.25, tint: '#5b8cff',
    blurb: 'Rally aura: boosts the damage of nearby heroes.',
    lore: 'The team cheerleader who refuses to let anyone give up. One wink from Anzu and the whole squad fights twice as hard. Morale is a weapon.',
    tiers: tiers({ range: 120, fireInterval: 1000, damage: 0, cost: 150 }, { cost: 180, buffMul: 1.4, range: 140 } as Partial<HeroTier>, { cost: 280, buffMul: 1.6, range: 160 } as Partial<HeroTier>),
  },
  nini: {
    id: 'nini', name: 'Nini', tex: TextureKeys.HeroNini, proj: TextureKeys.ProjBullet, projSpeed: 600,
    attack: 'projectile', skill: 'execute', executeThreshold: 0.3, executeMul: 2.5, tint: '#b13e53',
    blurb: 'Deals bonus damage to wounded (low-hp) zombies.',
    lore: 'A long-haired huntress who lets others soften the target, then ends it. Cold, precise, merciless — she finishes what the squad starts.',
    tiers: tiers({ range: 150, fireInterval: 900, damage: 22, cost: 125 }, { damage: 34, cost: 160 }, { damage: 54, cost: 260, executeMul: 3 } as Partial<HeroTier>),
  },
  hakj: {
    id: 'hakj', name: 'HAKJ', tex: TextureKeys.HeroHakj, proj: TextureKeys.ProjFrost, projSpeed: 320,
    attack: 'projectile', skill: 'bounce', splashRadius: 40, slowFactor: 0.6, slowDuration: 1.5, tint: '#41a6f6',
    blurb: 'Water splash damages + slows a small cluster.',
    lore: 'A little water spirit who washed up during the floods. Bubbly and round and weirdly happy, HAKJ launches splashes that drench whole clusters of undead.',
    tiers: tiers({ range: 125, fireInterval: 850, damage: 18, cost: 115 }, { damage: 28, cost: 150, splashRadius: 46 } as Partial<HeroTier>, { damage: 44, cost: 250, splashRadius: 54 } as Partial<HeroTier>),
  },
  // ── image 4 (new sprites) ──
  chuotchu: {
    id: 'chuotchu', name: 'Jibgor', tex: TextureKeys.HeroChuotChu, proj: TextureKeys.ProjArrow, projSpeed: 480,
    attack: 'projectile', skill: 'gnaw', tint: '#e08a3a',
    blurb: 'Relentless gnaw: every bite makes the target take MORE damage (stacks).',
    lore: 'A street-smart sewer mouse who survived three cats and one apocalypse. He never bites once — he bites, and bites, and bites, until there is nothing left to bite.',
    tiers: tiers({ range: 125, fireInterval: 340, damage: 7, cost: 100 }, { damage: 11, cost: 130, fireInterval: 300 }, { damage: 17, cost: 215, fireInterval: 260 }),
  },
  meomeo: {
    id: 'meomeo', name: 'Lionyori', tex: TextureKeys.HeroMeoMeo, proj: TextureKeys.ProjArcane, projSpeed: 400,
    attack: 'projectile', skill: 'roar', splashRadius: 56, stunDuration: 0.8, tint: '#b8a888',
    blurb: 'Her shot lands with a lion-roar: damages and FREEZES nearby zombies in fear.',
    lore: 'A long-haired tabby with a mane like a lion and a meow that became a roar somewhere along the way. The undead remember they are prey the instant they hear it.',
    tiers: tiers({ range: 130, fireInterval: 1150, damage: 18, cost: 125 }, { damage: 29, cost: 165, stunDuration: 1.0 } as Partial<HeroTier>, { damage: 46, cost: 265, splashRadius: 66, stunDuration: 1.3 } as Partial<HeroTier>),
  },
  doraemon: {
    id: 'doraemon', name: 'Mr.Hoang', tex: TextureKeys.HeroDoraemon, proj: TextureKeys.ProjBullet, projSpeed: 620,
    attack: 'projectile', skill: 'aircannon', pierce: 3, knockback: 30, tint: '#41a6f6',
    blurb: 'Air Cannon: a compressed-air blast that pierces a line and knocks them all back.',
    lore: 'A robotic cat from the 22nd century with a four-dimensional pocket full of impossible gadgets. His favourite against a horde? The Air Cannon. "Bang!" — and the whole row goes flying.',
    tiers: tiers({ range: 145, fireInterval: 900, damage: 20, cost: 120 }, { damage: 32, cost: 160, knockback: 38 } as Partial<HeroTier>, { damage: 52, cost: 260, pierce: 5, knockback: 48 } as Partial<HeroTier>),
  },
  shiba: {
    id: 'shiba', name: 'Shiba', tex: TextureKeys.HeroShiba, proj: TextureKeys.ProjSpit, projSpeed: 360,
    attack: 'projectile', skill: 'bounceball', chainRange: 92, tint: '#e8932e',
    blurb: 'Throws a ball that bounces between adjacent zombies — more bounces per level.',
    lore: 'A very good boy with a very loud bork and an even better fetch. He hurls his favourite ball into the horde and it just... keeps bouncing. Such physics. Much doom.',
    tiers: tiers({ range: 130, fireInterval: 820, damage: 22, cost: 120, bounces: 2 }, { damage: 35, cost: 160, bounces: 3 }, { damage: 56, cost: 255, bounces: 4 }),
  },
};

export const HERO_IDS: HeroId[] = [
  'evilcat', 'mymy', 'oreo', 'rwah', 'emso', 'mimi', 'chippy', 'gauem', 'normal',
  'kenken', 'oldbear', 'bluefoo', 'nixxx', 'gauchi', 'gei',
  'yunseo', 'dongdong', 'midori', 'anzu', 'nini', 'hakj',
  'chuotchu', 'meomeo', 'doraemon', 'shiba',
];

// ── Derived rating (for the hero-detail panel) ───────────────────────────────
// "Power" is a rough overall-strength score from a hero's tier-0 stats: sustained
// DPS (damage × shots / fireInterval) scaled by range. Support heroes (no damage)
// get a flat support score so they still read as useful. Stars are Power bucketed.

/** Overall strength score for a hero (uses tier 0). Higher = stronger. */
export function heroPower(def: HeroDef & { tiers: HeroTier[] }): number {
  const t = def.tiers[0];
  const shots = def.shots ?? 1;
  if (t.damage <= 0) {
    // support: value by range + skill kind
    return Math.round(140 + t.range * 0.8);
  }
  const dps = (t.damage * shots) / (t.fireInterval / 1000);
  const rangeFactor = 0.7 + t.range / 300;
  return Math.round(dps * rangeFactor * 4);
}

/** 1–5 stars from Power, calibrated to this roster's spread (≈30–245). */
export function heroStars(def: HeroDef & { tiers: HeroTier[] }): number {
  const p = heroPower(def);
  if (p >= 200) return 5;
  if (p >= 160) return 4;
  if (p >= 115) return 3;
  if (p >= 70) return 2;
  return 1;
}

// ── Zombies ──────────────────────────────────────────────────────────────────
// 3 minion types + 3 per-map bosses (queen=Easy, khoai=Normal, hakj=Hard).
export type ZombieId = 'walker' | 'slow' | 'brute' | 'boss' | 'khoai' | 'hakj';

export interface ZombieDef {
  id: ZombieId; tex: TextureKey; hp: number; speedMul: number; bounty: number; scale: number;
  /** when set, use animated spritesheets instead of a static baked grid; the
   *  value is the sheet-set prefix (e.g. 'girl' → zombie-girl-stand/lie). `scale`
   *  is then applied to that sheet's cell. */
  sheet?: string;
  /** boss-only: shown in the intro popup + drives the hero-kill skill.
   *  `fill`/`outline`/`glow` colour the intro title + glow to match the boss theme. */
  boss?: { name: string; skillCdMs: number; fill: string; outline: string; glow: number };
}

export const ZOMBIES: Record<ZombieId, ZombieDef> = {
  // walker = the zombie-girl sheet; slow = bucket-head (tanky, slow).
  walker: { id: 'walker', tex: TextureKeys.ZombieGirlStand, hp: 55, speedMul: 1.0, bounty: 1, scale: 0.4, sheet: 'girl' },
  slow: { id: 'slow', tex: TextureKeys.ZombieSpeedStand, hp: 162, speedMul: 0.55, bounty: 1.8, scale: 0.34, sheet: 'speed' },
  brute: { id: 'brute', tex: TextureKeys.ZombieBruteStand, hp: 188, speedMul: 0.7, bounty: 2.2, scale: 0.46, sheet: 'brute' },
  // ── bosses (one per map). skillCdMs = how often it destroys a hero (Easy slow → Hard fast).
  //    Title colours are themed per boss (toxic-green queen / blood-red king / drowned-cyan).
  // HP from this PR (boss +20%); cooldown from main (PR #21 -5s).
  boss: { id: 'boss', tex: TextureKeys.ZombieBossStand, hp: 840, speedMul: 0.5, bounty: 8, scale: 0.5, sheet: 'boss',
    boss: { name: 'Dark Princess Oreo', skillCdMs: 9000, fill: '#5ee62e', outline: '#0a2a0c', glow: 0x2a5a1d } },
  khoai: { id: 'khoai', tex: TextureKeys.ZombieKhoaiStand, hp: 1320, speedMul: 0.5, bounty: 12, scale: 0.5, sheet: 'khoai',
    boss: { name: 'King Khoai', skillCdMs: 6500, fill: '#ff3b3b', outline: '#3a0606', glow: 0x5a1d1d } },
  hakj: { id: 'hakj', tex: TextureKeys.ZombieHakjStand, hp: 1920, speedMul: 0.55, bounty: 16, scale: 0.5, sheet: 'hakj',
    boss: { name: 'Hakj the Drowned', skillCdMs: 4500, fill: '#3be0ff', outline: '#06303a', glow: 0x1d4a5a } },
};

/** The boss that headlines each map (by map.id). */
export const MAP_BOSS: Record<number, ZombieId> = { 0: 'boss', 1: 'khoai', 2: 'hakj' };

/** Which minion types each map's regular waves can roll (used for cross-difficulty
 *  mixing: Normal can sprinkle Easy-map bosses-as-minions, Hard can sprinkle both). */
export const MAP_MINIONS: Record<number, ZombieId[]> = {
  0: ['walker', 'slow', 'brute'],
  1: ['walker', 'slow', 'brute', 'boss'],          // Normal: Easy boss may appear as a minion
  2: ['walker', 'slow', 'brute', 'boss', 'khoai'], // Hard: Easy + Normal bosses as minions
};
