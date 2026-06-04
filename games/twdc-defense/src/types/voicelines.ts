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
  place: ['Ready!', 'On it!', 'In position!', "Let's go!", 'Reporting in!', 'Standing guard.'],
  attack: ['Take that!', 'Gotcha!', 'Pow!', 'None shall pass!', 'Back off!', 'Eat this!', 'Down you go!'],
  upgrade: ['Stronger now!', 'Level up!', 'Awesome!', 'Feeling great!', 'I can feel the power!', 'New trick unlocked!'],
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
  emso: {
    place: ['Rest easy~', "I'll keep you safe.", 'Breathe...'],
    attack: ['Be well~', 'Mending you.', 'Stay strong.', 'Soothe...'],
    upgrade: ['Warmer care!', 'Stronger healing!'],
  },
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
    place: ['A liquidation event.', 'Economics 101.', 'Invest in victory.'],
    attack: ['Dividends!', 'Profit margin!', 'Returns incoming!'],
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
  anzu: {
    place: ['Anzu here!', "Let's rally!", "I've got your back!"],
    attack: ['You can do it!', 'Fight on!', "Don't give up!", 'Push harder!'],
    upgrade: ['Spirits high!', 'Morale boosted!'],
  },
  nini: {
    place: ['Aim for the weak.'],
    attack: ['Finish it!', 'Weak ones fall!', 'Execute!'],
  },
  hakj: { place: ['HAKJ joins in!'], attack: ['Frostbite!', 'Chills down your spine!'] },
  // ── image 4 ──
  chuotchu: {
    place: ['Squeak!', 'Survived three cats.', 'Jibgor reporting!'],
    attack: ['Nibble nibble!', 'One more bite!', 'And again!', 'Chomp chomp!'],
    upgrade: ['Sharper teeth!', 'Bite harder now!'],
  },
  meomeo: {
    place: ['*soft meow*', 'Lionyori is here.', 'Remember your place.'],
    attack: ['ROAR!', 'Fear me!', 'Freeze, prey!', 'Hear me roar!'],
    upgrade: ['My roar grows!', 'Louder now!'],
  },
  shiba: {
    place: ['Bork bork!', 'Wanna play fetch?', 'Such ready. Much doom.'],
    attack: ['Fetch!', 'Bounce bounce!', 'Get it!', 'Good throw!'],
    upgrade: ['More bounce!', 'So strong, very wow!'],
  },
  // ── new heroes ──
  hudong: {
    place: ['Fortune favors us!', 'Feel the lucky glow.', 'Stand close, friends.'],
    attack: ['Strike true!', 'My fortune is yours!', 'Hit harder!', 'Blessed aim!'],
    upgrade: ['Luckier still!', 'Greater fortune!'],
  },
  morgan: {
    place: ['Feel the chill.', 'Winter has come.', 'My penguin is ready.'],
    attack: ['Freeze solid!', 'Deep freeze!', 'Shatter!', 'Stay frozen!'],
    upgrade: ['Colder still!', 'The ice deepens!'],
  },
  yugitoh: {
    place: ['*yawn* ...ready.', 'The spirits circle.', 'Hmm. A riddle.'],
    attack: ['Spirits, defend!', 'Come no closer.', 'Round and round.', 'Begone, fool.'],
    upgrade: ['More spirits heed me.', 'The circle widens.'],
  },
  xxking: {
    place: ['Never lost a match.', 'Step up then.', 'Who is next?'],
    attack: ['Combo!', 'Again! Again!', 'Stay on target!', 'Finish him!'],
    upgrade: ['Faster fists!', 'Bigger combos!'],
  },
  xxkong: {
    place: ['Set your heart ablaze!', 'The flame never dies.', 'Stand and fight!'],
    attack: ['Burn!', 'Flame Breathing!', 'Turn to ash!', 'Feel the fire!'],
    upgrade: ['Hotter flames!', 'My fire grows!'],
  },
  joicy: {
    place: ['*horns gleam*', 'An oni joins the fray.', 'Brace yourselves.'],
    attack: ['THUNDER SLAM!', 'Crash!', 'Back, all of you!', 'Feel the quake!'],
    upgrade: ['The earth obeys!', 'Mightier blows!'],
  },
};

/** Pick a random voice line for a hero+event, or null if none defined. */
export function pickLine(id: HeroId, ev: VoiceEvent): string | null {
  const pool = VOICE[id]?.[ev] ?? GENERIC[ev];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
