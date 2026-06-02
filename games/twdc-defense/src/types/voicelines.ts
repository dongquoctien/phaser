// Random hero voice lines — short barks shown in a floating speech bubble above a
// hero on placement / (occasionally) on attack / on upgrade. Kept terse so they
// fit the small bubble and read fast. Vietnamese, playful, in-character.
//
// Lookup: VOICE[heroId]?.[event] ?? GENERIC[event]. Each is a pool; the Hero
// picks one at random. English; keep lines short so the bubble stays compact.

import type { HeroId } from './roster';

export type VoiceEvent = 'place' | 'attack' | 'upgrade';

type LinePool = Partial<Record<VoiceEvent, string[]>>;

// Shared fallback pools for any hero without a specific line for an event.
export const GENERIC: Record<VoiceEvent, string[]> = {
  place: ['Ready!', 'On it!', 'In position!', "Let's go!"],
  attack: ['Take that!', 'Gotcha!', 'Pow!', 'None shall pass!', 'Back off!'],
  upgrade: ['Stronger now!', 'Level up!', 'Awesome!', 'Feeling great!'],
};

// Per-hero flavor. Only override where a hero has personality worth voicing; the
// rest fall back to GENERIC. Reference their roster name/skill for the joke.
export const VOICE: Partial<Record<HeroId, LinePool>> = {
  evilcat: {
    place: ['Meow... darkness!', "You'll regret this."],
    attack: ['Begone!', 'Into the void!'],
  },
  mymy: {
    place: ['Blade drawn.', 'For the village!'],
    attack: ['One slash!', 'Clean cut!', 'Fewer zombies now.'],
  },
  oreo: {
    place: ['Homework done?', 'Time to strike!'],
    attack: ['Shuriken!', 'Bullseye!', 'Three targets!'],
  },
  rwah: {
    place: ['Try my brew.', 'Heh heh...'],
    attack: ['Poison!', 'Melt away!', '90% toxic sludge!'],
  },
  emso: { place: ["I'm ready!"], attack: ['Go go!', 'Hehe!'] },
  mimi: {
    place: ['Locked and loaded.', 'Target locked.'],
    attack: ['Bang!', 'Dead on!', 'Quick as lightning!'],
  },
  chippy: {
    place: ['Chilly~', 'Freeze time.'],
    attack: ['Frozen!', 'Slow down!', 'Cold yet?'],
  },
  gauem: { place: ['Lil bear here!'], attack: ['Splat!', 'Splash!'] },
  normal: {
    place: ['Just a "normal" cat.', "Don't pet me."],
    attack: ['Zap zap!', 'Shocking!', 'Chain it!'],
  },
  kenken: {
    place: ['A liquidation event.', 'Economics 101.'],
    upgrade: ['Compound interest!', 'Gold incoming!'],
  },
  oldbear: {
    place: ['Boba tea~', 'Easy now, kid.'],
    attack: ['Sticky!', 'Slow as a snail!'],
  },
  bluefoo: {
    place: ['Dual blades!'],
    attack: ['Tap-tap!', 'Two hits!', 'Too fast?'],
  },
  nixxx: { place: ['Everyone back!'], attack: ['Knockback!', 'Out!', 'Fly away!'] },
  gauchi: {
    place: ["It's hot!", 'Gau Chi charges!'],
    attack: ['Fire ring!', 'Burn it all!', 'Hot enough?'],
  },
  gei: {
    place: ['The ground shakes!'],
    attack: ['Slam!', 'Stunned yet?', 'Stay down!'],
  },
  yunseo: { place: ['Yunseo ready!'], attack: ['Poison arrow!', 'Hit!'] },
  dongdong: {
    place: ['Dong Dong here!'],
    attack: ['Rat-tat-tat!', 'Rapid fire!', 'Never miss!'],
  },
  midori: {
    place: ['Bow drawn.'],
    attack: ['Twin arrows!', 'Two shots!', 'Pinned!'],
  },
  anzu: { place: ['Anzu here!'], attack: ['Hyah!', 'Charge!'] },
  nini: {
    place: ['Aim for the weak.'],
    attack: ['Finish it!', 'Weak ones fall!', 'Execute!'],
  },
  hakj: { place: ['HAKJ joins in!'], attack: ['Frostbite!', 'Chills down your spine!'] },
};

/** Pick a random voice line for a hero+event, or null if none defined. */
export function pickLine(id: HeroId, ev: VoiceEvent): string | null {
  const pool = VOICE[id]?.[ev] ?? GENERIC[ev];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
