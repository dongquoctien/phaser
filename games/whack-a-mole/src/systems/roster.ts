// The character roster. Frame names match the keys baked by
// scripts/pack-atlas.mjs. Source art is user-provided (their own pixel art).
//
// Roles (enemy / friendly) are RE-ROLLED every fresh round via rollRoster() so
// the cast changes each game — capybara might be a "spare" this round and a
// "bonk" the next. That's only fair because the in-game red/green ground halo
// telegraphs each character's role, so the player reads the colour, not memory.
// The mole-bear stays the BOSS every round (it simply looks the part).
import type Phaser from 'phaser';

export type CharKind = 'enemy' | 'friendly' | 'boss';

export interface CharDef {
  frame: string; // atlas frame key
  kind: CharKind;
  weight: number; // relative spawn probability
}

// Every character frame in the atlas (29). mole-boss is reserved as the boss.
const BOSS_FRAME = 'mole-boss';
const ALL_FRAMES = [
  'cat-black', 'bear-samurai', 'schoolgirl', 'monster-green', 'cat-pink',
  'hamster', 'cat-tuxedo', 'man-glasses', 'boy-blue', 'cat-ragdoll',
  'kid-pig', 'kid-panda', 'kid-cat', 'kid-blue', 'woman',
  'capybara', 'alpaca', 'teddy', 'blob', 'rabbit',
  'rat-man', 'cat-fluffy', 'doraemon', 'shiba', // sheet 4
  'hudong', 'morgan', 'yugi-cat', 'king-girl', 'chainsaw-dog', // new-heros
  // (mole-boss handled separately)
];

// How many of the non-boss characters become "friendly" (don't-hit) per round.
const FRIENDLY_COUNT = 5;

export interface Roster {
  enemies: CharDef[];
  friendlies: CharDef[];
  boss: CharDef;
}

// Fisher–Yates shuffle using the seeded RNG (so a round is reproducible from
// its seed, and stable across a scene's lifetime).
function shuffle<T>(arr: T[], rng: Phaser.Math.RandomDataGenerator): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.between(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Roll a fresh cast for a round: pick FRIENDLY_COUNT random frames to be
// friendlies, the rest are enemies, mole-boss is the boss.
export function rollRoster(rng: Phaser.Math.RandomDataGenerator): Roster {
  const shuffled = shuffle(ALL_FRAMES, rng);
  const friendlyFrames = new Set(shuffled.slice(0, FRIENDLY_COUNT));
  const enemies: CharDef[] = [];
  const friendlies: CharDef[] = [];
  for (const frame of ALL_FRAMES) {
    if (friendlyFrames.has(frame)) friendlies.push({ frame, kind: 'friendly', weight: 7 });
    else enemies.push({ frame, kind: 'enemy', weight: 10 });
  }
  return {
    enemies,
    friendlies,
    boss: { frame: BOSS_FRAME, kind: 'boss', weight: 4 },
  };
}

// Weighted pick from a rolled roster, honoring a target friendly-ratio and a
// small boss chance. `friendlyChance` ramps down with difficulty (set by the
// caller); the boss is a rare treat. Avoids returning `avoidFrame` (the
// previously-spawned character) so the same face doesn't repeat back-to-back.
export function pickChar(
  rng: Phaser.Math.RandomDataGenerator,
  roster: Roster,
  friendlyChance: number,
  bossChance: number,
  avoidFrame?: string,
): CharDef {
  let pool: CharDef[];
  if (rng.frac() < bossChance) {
    return roster.boss;
  } else if (rng.frac() < friendlyChance) {
    pool = roster.friendlies;
  } else {
    pool = roster.enemies;
  }
  // try a few times to avoid an immediate repeat (cheap; pools are large)
  for (let attempt = 0; attempt < 4; attempt++) {
    const pick = weightedPick(pool, rng);
    if (pick.frame !== avoidFrame) return pick;
  }
  return weightedPick(pool, rng);
}

function weightedPick(pool: CharDef[], rng: Phaser.Math.RandomDataGenerator): CharDef {
  const total = pool.reduce((a, c) => a + c.weight, 0);
  let r = rng.frac() * total;
  for (const c of pool) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return pool[pool.length - 1];
}
