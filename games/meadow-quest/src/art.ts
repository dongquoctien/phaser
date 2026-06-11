// ── Pixel art for Meadow Quest ───────────────────────────────────────────────
// Hand-authored 32×32 Sweetie-16 char-grids, baked once to cached textures via the
// shared src/pixel helper. Top-down chibi style (big head, small body, one light
// direction top-left, value ramps + hue-shift, selective dark outline) — drawn to
// match the reference battle screenshot, NOT reused from twdc-defense.
//
// Each character has an `idle` and an `attack` frame (a lunge/wind-up pose). Frames
// are full 32×32 grids so a pose can move limbs freely without drift.
import Phaser from 'phaser';
import { bakeSprite, SWEETIE16_HEX as H, type PixelGrid } from '../../../src/pixel';
import { CharKeys } from './types/keys';

// Shared palette characters. Keep this small + cohesive (Sweetie-16 ramps).
//   .  transparent      K  outline (near-black)     k  soft dark (shadow line)
//   s  skin              S  skin shadow
//   w  white             W  white shadow (grey)
//   e  eye (dark)        m  mouth/blush (red)
// per-character hair/cloth chars are added in each map.
const BASE: Record<string, string | null> = {
  '.': null,
  K: H.black,
  k: H.dark,
  s: H.yellow,   // skin (warm light)
  S: H.orange,   // skin shadow
  w: H.white,
  W: H.grey,
  e: H.black,
  m: H.red,
};

// ── REM — green-haired girl, white shirt + blue skirt (the screenshot's lead) ──
const REM_MAP: Record<string, string | null> = {
  ...BASE,
  g: H.green, G: H.lime,      // hair: shadow / light
  b: H.blue, B: H.darkblue,   // skirt: light / shadow
  r: H.red,                   // tie
};
const REM_IDLE: PixelGrid = {
  map: REM_MAP,
  grid: [
    '................................',
    '................................',
    '............KKKKKK..............',
    '..........KKggggggKK............',
    '.........KgggggggggGK...........',
    '........KggGGggggGGgGK..........',
    '........KgGGggggggGGgK..........',
    '.......KggsssssssssggK..........',
    '.......Kgsssssssssssgk..........',
    '.......Kgseseessesesgk..........',  // brow line / hair frame
    '.......KsseKsssssKessK..........',  // eyes
    '.......KssssssmssssssK..........',  // nose/mouth area
    '.......KsssSssmmsSsssK..........',  // blush + mouth
    '........KsssssssssssK...........',
    '.........KKsssssssKK............',
    '..........KgggggggK.............',  // hair under chin
    '..........KwwwwwwwK.............',  // collar
    '.........KwwwwrwwwwK............',  // shirt + tie
    '........KwwWwwrwwWwwK...........',
    '........KwwWwwrwwWwwK...........',
    '........KwwWwwwwwWwwK...........',
    '........KbbbBbbbbBbbK...........',  // skirt
    '........KbbBbbbbbBbbK...........',
    '........KBbbbbbbbbbBK...........',
    '.........KsssK.KsssK............',  // legs
    '.........KsssK.KsssK............',
    '.........KSSSK.KSSSK............',
    '.........KKKKK.KKKKK............',  // shoes
    '..........KKK...KKK.............',
    '................................',
    '................................',
    '................................',
  ],
};
// Attack: lean forward + arm raised (slight squash, head dips, body shifts right)
const REM_ATTACK: PixelGrid = {
  map: REM_MAP,
  grid: [
    '................................',
    '................................',
    '.............KKKKKK.............',
    '...........KKggggggKK...........',
    '..........KgggggggggGK..........',
    '.........KggGGggggGGgGK.........',
    '.........KgGGggggggGGgK.........',
    '........KggsssssssssggK.........',
    '........Kgsssssssssssgk.........',
    '........Kgseseessesesgk....KK...',  // raised arm (right) start
    '........KsseKsssssKessK...KssK..',
    '........KssssssmsssssK...KsssK..',
    '........KsssSsmmmsSssK..KssSK...',
    '.........KssssssssssK..KssK.....',
    '..........KKssssssKK.KssK.......',
    '..........Kgggggggk.KsK.........',
    '..........KwwwwwwwK.............',
    '.........KwwwwrwwwwK............',
    '.........KwwWwrwwWwwK...........',
    '.........KwwWwrwwWwwK...........',
    '.........KwwWwwwwWwwK...........',
    '.........KbbbBbbbBbbK...........',
    '.........KbbBbbbbbBbK...........',
    '.........KBbbbbbbbbBK...........',
    '........KsssK..KsssK............',  // legs spread (lunge)
    '.......KsssK....KsssK...........',
    '.......KSSSK....KSSSK...........',
    '.......KKKKK....KKKKK...........',
    '........KKK......KKK............',
    '................................',
    '................................',
    '................................',
  ],
};

// ── HOLLIS — blond boy, blue beanie + teal vest (the screenshot's 2nd hero) ────
const HOLLIS_MAP: Record<string, string | null> = {
  ...BASE,
  y: H.yellow, Y: H.orange,   // hair: light / shadow (blond)
  c: H.cyan, C: H.blue,       // beanie: light / shadow
  v: H.teal, V: H.darkblue,   // vest: light / shadow
  p: H.slate, P: H.dark,      // trousers: light / shadow
};
const HOLLIS_IDLE: PixelGrid = {
  map: HOLLIS_MAP,
  grid: [
    '................................',
    '................................',
    '............KKKKKK..............',
    '..........KKccccccKK............',  // beanie
    '.........KccccccccccK...........',
    '.........KcCccccccCcK...........',
    '........KKccccccccccKK..........',  // beanie brim
    '........KyysssssssyyK...........',  // hair fringe + face
    '.......Kyssssssssssyk...........',
    '.......Kysssssssssssk...........',
    '.......KsseKsssssKessK..........',  // eyes
    '.......KssssssmssssssK..........',
    '.......KsssSsmmmsSsssK..........',  // mouth + blush
    '........KsssssssssssK...........',
    '.........KKsssssssKK............',
    '..........KyyyyyyyK.............',  // hair under chin
    '..........KvvvvvvvK.............',  // vest collar
    '.........KvvvVvvvVvvK...........',
    '.........KvvVwwwwwVvK...........',  // shirt under vest
    '.........KvvVwwwwwVvK...........',
    '.........KvvVwwwwwVvK...........',
    '.........KpppPpppPppK...........',  // trousers
    '.........KppPpppppPpK...........',
    '.........KPppppppppPK...........',
    '.........KsssK.KsssK............',
    '.........KsssK.KsssK............',
    '.........KSSSK.KSSSK............',
    '.........KKKKK.KKKKK............',
    '..........KKK...KKK.............',
    '................................',
    '................................',
    '................................',
  ],
};
const HOLLIS_ATTACK: PixelGrid = {
  map: HOLLIS_MAP,
  grid: [
    '................................',
    '................................',
    '.............KKKKKK.............',
    '...........KKccccccKK...........',
    '..........KccccccccccK..........',
    '..........KcCccccccCcK..........',
    '.........KKccccccccccKK.........',
    '.........KyysssssssyyK..........',
    '........Kyssssssssssyk..........',
    '........Kysssssssssssk....KK....',  // raised fist
    '........KsseKsssssKessK..KssK...',
    '........KssssssmsssssK..KsssK...',
    '........KsssSmmmmsSssK.KssSK....',
    '.........KsssssssssK..KssK......',
    '..........KKsssssKK.KssK........',
    '..........Kyyyyyyk.KsK..........',
    '..........KvvvvvvvK.............',
    '.........KvvvVvvvVvK............',
    '.........KvvVwwwwwVvK...........',
    '.........KvvVwwwwwVvK...........',
    '.........KvvVwwwwwVvK...........',
    '.........KpppPpppPppK...........',
    '.........KppPpppppPpK...........',
    '.........KPppppppppPK...........',
    '........KsssK..KsssK............',
    '.......KsssK....KsssK...........',
    '.......KSSSK....KSSSK...........',
    '.......KKKKK....KKKKK...........',
    '........KKK......KKK............',
    '................................',
    '................................',
    '................................',
  ],
};

// ── MOZ — brown-haired guy, red jacket (the screenshot's 3rd hero) ─────────────
const MOZ_MAP: Record<string, string | null> = {
  ...BASE,
  h: H.orange, H: H.red,      // hair: light / shadow (auburn)
  j: H.red, J: H.purple,      // jacket: light / shadow
  p: H.darkblue,              // jeans
};
const MOZ_IDLE: PixelGrid = {
  map: MOZ_MAP,
  grid: [
    '................................',
    '................................',
    '............KKKKKK..............',
    '..........KKhhhhhhKK............',
    '.........KhhhhhhhhhhK...........',
    '.........KhHhhhhhhHhK...........',
    '........KhhhhhhhhhhhhK..........',
    '.......KhhsssssssssHhK..........',  // hair fringe + face
    '.......Khssssssssssshk..........',
    '.......Khsssssssssssk...........',
    '.......KsseKsssssKessK..........',  // eyes
    '.......KssssssmssssssK..........',
    '.......KsssSsmmmsSsssK..........',
    '........KssssssssssK............',
    '.........KKsssssssKK............',
    '..........KhhhhhhhK.............',
    '.........KjjjjjjjjjK............',  // jacket collar
    '.........KjjJjjjjJjjK...........',
    '.........KjJjwwwjJjjK...........',  // shirt gap
    '.........KjJjwwwjJjjK...........',
    '.........KjjJjjjjJjjK...........',
    '.........KpppppppppK............',  // jeans
    '.........KppppppppppK...........',
    '.........KppppppppppK...........',
    '.........KsssK.KsssK............',
    '.........KsssK.KsssK............',
    '.........KSSSK.KSSSK............',
    '.........KKKKK.KKKKK............',
    '..........KKK...KKK.............',
    '................................',
    '................................',
    '................................',
  ],
};
const MOZ_ATTACK: PixelGrid = {
  map: MOZ_MAP,
  grid: [
    '................................',
    '................................',
    '.............KKKKKK.............',
    '...........KKhhhhhhKK...........',
    '..........KhhhhhhhhhhK..........',
    '..........KhHhhhhhhHhK..........',
    '.........KhhhhhhhhhhhhK.........',
    '........KhhsssssssssHhK.........',
    '........Khssssssssssshk.........',
    '........Khsssssssssssk....KK....',
    '........KsseKsssssKessK..KssK...',
    '........KssssssmsssssK..KsssK...',
    '........KsssSmmmmsSssK.KssSK....',
    '.........KssssssssssK.KssK......',
    '..........KKsssssKK.KssK........',
    '..........Khhhhhhk.KsK..........',
    '..........KjjjjjjjjK............',
    '.........KjjJjjjjJjjK...........',
    '.........KjJjwwwjJjjK...........',
    '.........KjJjwwwjJjjK...........',
    '.........KjjJjjjjJjjK...........',
    '.........KppppppppppK...........',
    '.........KppppppppppK...........',
    '.........KppppppppppK...........',
    '........KsssK..KsssK............',
    '.......KsssK....KsssK...........',
    '.......KSSSK....KSSSK...........',
    '.......KKKKK....KKKKK...........',
    '........KKK......KKK............',
    '................................',
    '................................',
    '................................',
  ],
};

/** Bake every character sprite into the scene's texture cache. Call in create(). */
export function bakeMeadowArt(scene: Phaser.Scene, px = 1): void {
  bakeSprite(scene, CharKeys.RemIdle, REM_IDLE, { px });
  bakeSprite(scene, CharKeys.RemAttack, REM_ATTACK, { px });
  bakeSprite(scene, CharKeys.HollisIdle, HOLLIS_IDLE, { px });
  bakeSprite(scene, CharKeys.HollisAttack, HOLLIS_ATTACK, { px });
  bakeSprite(scene, CharKeys.MozIdle, MOZ_IDLE, { px });
  bakeSprite(scene, CharKeys.MozAttack, MOZ_ATTACK, { px });
  bakeMonsters(scene, px);
}

// ── MONSTERS ─────────────────────────────────────────────────────────────────
// Snake (coiled cobra — matches the reference), Raven (red-brown bird), Slime
// (green blob), Beetle (purple bug). Same craft gates: top-left light, ramps,
// hue-shift, dark selout, readable silhouette, contact shadow.

// SNAKE — a reared cobra, tan body with a hood, like the screenshot's snakes.
const SNAKE_MAP: Record<string, string | null> = {
  '.': null, K: H.black, k: H.dark,
  o: H.orange, n: H.yellow, d: H.red, // body light / belly / dark band
  e: H.black, t: H.skyblue,           // eye / tongue
  S: H.dark,                          // ground shadow
};
const SNAKE_IDLE: PixelGrid = {
  map: SNAKE_MAP,
  grid: [
    '................................',
    '..............KKKK..............',
    '.............KooooK.............',  // head
    '............KonnnnoK............',
    '............KoneeneoK...........',  // eyes
    '............KonnnnnoK...........',
    '............KKonnnoKK...........',
    '..............KoooK.............',
    '.............Konndt.............',  // tongue flick
    '.............KonnoK.............',  // neck (hood)
    '............KonnnnoK............',
    '...........KonndddnoK...........',  // hood band
    '...........KonnnnnnnoK..........',
    '..........KonnoKKKonnoK.........',
    '..........KonoK...KonoK.........',
    '.........KonoK.....KonoK........',  // coil
    '.........KonoK.....KonoK........',
    '.........KonnoK...KonnoK........',
    '..........KonnoKKKonnoK.........',
    '...........KonnnnnnnoK..........',
    '............KonnnnnnoK..........',
    '...........KonnoooonnoK.........',
    '..........Konnoddddonno.K.......',
    '..........Konnnnnnnnnno.K.......',
    '...........KonnnnnnnnoK.........',
    '............KooooooooK..........',
    '.............KKKKKKKK...........',
    '...........SSSSSSSSSSSS.........',  // contact shadow
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};
const SNAKE_ATTACK: PixelGrid = {
  map: SNAKE_MAP,
  grid: [
    '................................',
    '.........KKKK...................',
    '........KooooK..................',  // head lunged forward + down
    '.......KonnnnoK.................',
    '.......Koneeneo.K...............',
    '.......KonnnnnoKtt..............',  // fangs/tongue out
    '.......KKonnnoKK................',
    '.........KoooK..................',
    '........KonnoK..................',
    '........KonnoK..................',
    '.......KonnnnoK.................',
    '......KonndddnoK................',
    '......KonnnnnnnoK...............',
    '.....KonnoKKKonnoK..............',
    '.....KonoK...KonoK..............',
    '....KonoK.....KonoK.............',
    '....KonoK.....KonoK.............',
    '....KonnoK...KonnoK.............',
    '.....KonnoKKKonnoK..............',
    '......KonnnnnnnoK...............',
    '.......KonnnnnoK................',
    '......KonnoooonnoK..............',
    '.....Konnoddddonno.K............',
    '.....KonnnnnnnnnnoK.............',
    '......KonnnnnnnnoK..............',
    '.......KooooooooK...............',
    '........KKKKKKKK................',
    '......SSSSSSSSSSSS..............',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// RAVEN — a dark-red bird with spread wings (the screenshot's flying enemies).
const BIRD_MAP: Record<string, string | null> = {
  '.': null, K: H.black, k: H.dark,
  d: H.red, p: H.purple, o: H.orange, // feather light / dark / beak+legs
  e: H.yellow, S: H.dark,
};
const BIRD_IDLE: PixelGrid = {
  map: BIRD_MAP,
  grid: [
    '................................',
    '................................',
    '.....KK....................KK...',
    '....KppK..................KppK..',  // wingtips up
    '...KpddK..................KddpK.',
    '...KpddK....KKKKKK........KddpK.',
    '..KpddK...KKddddddKK.....KddpK..',  // wings + head
    '..KpddK..KdddddddddK....KddpK...',
    '..KpddKKKdddeKKeddddKKKKKddpK...',  // eyes
    '...KpdddddddoooddddddddddpK.....',  // beak (orange)
    '...KpddddddooooddddddddddpK.....',
    '....KpddddddddddddddddddpK......',
    '.....KKpddddddddddddddpKK.......',
    '.......KKddddddddddddKK.........',  // body
    '.........KdddddddddK............',
    '..........KddddddK..............',
    '...........KddddK...............',
    '...........KooKooK..............',  // legs/talons
    '..........KoK..KoK..............',
    '.........KKK....KKK.............',
    '................................',
    '..........SSSSSSSS..............',  // shadow on ground
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};
const BIRD_ATTACK: PixelGrid = {
  map: BIRD_MAP,
  grid: [
    '................................',
    '......KK..................KK....',
    '.....KppK................KppK...',
    '....KpddK................KddpK..',  // wings swept down (dive)
    '....KpddK................KddpK..',
    '....KpddKK....KKKKKK....KKddpK..',
    '.....KpddK..KKddddddKK..KddpK...',
    '......KpddKKdddddddddKKKKddpK...',
    '.......KpddddeKKeddddddddpK.....',
    '........KpdddoooooddddddpK......',  // beak open (orange)
    '.......KKpdddoooooddddddpKK.....',
    '......KpddddddddddddddddddpK....',
    '.....KpdddddddddddddddddddddpK..',  // wings wide
    '......KKddddddddddddddddddKK....',
    '.........KdddddddddddddK........',
    '...........KddddddddK...........',
    '............KooKKooK............',  // talons forward
    '...........KoK...KoK............',
    '..........KoK.....KoK...........',
    '.........KKK.......KKK..........',
    '................................',
    '..........SSSSSSSS..............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// SLIME — a classic green blob with a glossy highlight + two eyes.
const SLIME_MAP: Record<string, string | null> = {
  '.': null, K: H.black, k: H.dark,
  g: H.green, G: H.lime, t: H.teal,  // body light / highlight / shadow
  e: H.black, w: H.white, S: H.dark,
};
const SLIME_IDLE: PixelGrid = {
  map: SLIME_MAP,
  grid: [
    '................................',
    '................................',
    '................................',
    '................................',
    '.............KKKKKK.............',
    '...........KKgggggggKK..........',
    '..........KgGGgggggggK..........',  // top highlight
    '.........KgGGgggggggggK.........',
    '.........KgGgggggggggggK........',
    '........KggggggggggggggK........',
    '........Kgggggggggggggg.K.......',
    '........Kggwwggggggwwgg.K.......',  // eye whites
    '........KggweKgggggweKgg........',  // eyes
    '........Kggwwggggggwwgg.K.......',
    '........Kggggggggggggg.gK.......',
    '........KgggggggggggggggK.......',
    '.......KtgggggggggggggggtK......',
    '.......Ktggggggggggggggg.tK.....',
    '.......KttgggggggggggggttK......',
    '........KttttgggggggttttK.......',
    '.........KKttttttttttKK.........',
    '...........KKKKKKKKKK...........',
    '..........SSSSSSSSSSSS..........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};
const SLIME_ATTACK: PixelGrid = {
  map: SLIME_MAP,
  grid: [
    '................................',
    '................................',
    '..............KKKK..............',
    '............KKggggKK............',  // squashed tall (jump)
    '...........KgGGggggK............',
    '..........KgGGgggggK............',
    '..........KgGgggggggK...........',
    '.........KggggggggggK...........',
    '.........KgggggggggggK..........',
    '.........Kggwwgggwwgg.K.........',
    '.........KggweKgweKgg.K.........',  // eyes
    '.........Kggwwgggwwgg.K.........',
    '.........KgggggggggggK..........',
    '........KtgggggggggggtK.........',
    '........KtgggggggggggtK.........',
    '.......KttgggggggggggttK........',
    '......KttttgggggggggttttK.......',
    '.....KtttttgggggggggtttttK......',  // wide base (splat)
    '....KttttttttttttttttttttK......',
    '...KttttttttttttttttttttttK.....',
    '....KKttttttttttttttttttKK......',
    '......KKKKKKKKKKKKKKKKKK........',
    '.....SSSSSSSSSSSSSSSSSSSS.......',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// BEETLE — a purple armored bug with horn + 6 legs.
const BEETLE_MAP: Record<string, string | null> = {
  '.': null, K: H.black, k: H.dark,
  p: H.purple, P: H.red, o: H.orange, // shell light / dark / horn+legs
  c: H.cyan, S: H.dark,               // shell glint
};
const BEETLE_IDLE: PixelGrid = {
  map: BEETLE_MAP,
  grid: [
    '................................',
    '................................',
    '...............oo...............',  // horn
    '..............KooK..............',
    '..............KooK..............',
    '.............KKppKK.............',  // head
    '............KppppppK............',
    '...........KpPppppPpK...........',
    '..........KKppppppppKK..........',  // shell top
    '.........KpPpccppccpPpK.........',  // glint
    '........KppppppppppppppK........',
    '........KpPpppppppppppPK........',
    '.......KppppppPPPPppppppK.......',  // wing seam
    '.......KppppppppppppppppK.......',
    '......KKpPppppppppppppPpKK......',
    '.....oKppppppppppppppppppKo.....',  // mid legs
    '....ooKKpPpppppppppppPpKKoo.....',
    '...oo...KppppppppppppppK...oo...',
    '........KKpPpppppppPpKK.........',
    '.....oo...KppppppppppK...oo.....',  // back legs
    '....oo.....KKpppppKK.....oo.....',
    '...........oKKKKKKo.............',
    '..........oo......oo............',  // front legs
    '..........SSSSSSSSSS............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};
const BEETLE_ATTACK: PixelGrid = {
  map: BEETLE_MAP,
  grid: [
    '................................',
    '...............oo...............',
    '..............KooK..............',  // horn thrust up + body reared
    '..............KooK..............',
    '..............KooK..............',
    '.............KKppKK.............',
    '............KppppppK............',
    '...........KpPppppPpK...........',
    '..........KKppppppppKK..........',
    '.........KpPpccppccpPpK.........',
    '........KppppppppppppppK........',
    '.......KpPppppppppppppPpK.......',
    '......KpppppppPPPPpppppppK......',
    '......KppppppppppppppppppK......',
    '.....KKpPppppppppppppppPpKK.....',
    '...ooKppppppppppppppppppppKoo...',  // legs splayed (rear up)
    '..ooKKpPpppppppppppppppPpKKoo...',
    '.oo....KppppppppppppppppK....oo.',
    '.......KKpPppppppppppPpKK.......',
    '....oo...KpppppppppppppK...oo...',
    '...oo.....KKppppppppKK.....oo...',
    '...........oKKKKKKKKo...........',
    '..........oo........oo..........',
    '.........SSSSSSSSSSSSSS.........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

function bakeMonsters(scene: Phaser.Scene, px: number): void {
  bakeSprite(scene, CharKeys.SnakeIdle, SNAKE_IDLE, { px });
  bakeSprite(scene, CharKeys.SnakeAttack, SNAKE_ATTACK, { px });
  bakeSprite(scene, CharKeys.BirdIdle, BIRD_IDLE, { px });
  bakeSprite(scene, CharKeys.BirdAttack, BIRD_ATTACK, { px });
  bakeSprite(scene, CharKeys.SlimeIdle, SLIME_IDLE, { px });
  bakeSprite(scene, CharKeys.SlimeAttack, SLIME_ATTACK, { px });
  bakeSprite(scene, CharKeys.BeetleIdle, BEETLE_IDLE, { px });
  bakeSprite(scene, CharKeys.BeetleAttack, BEETLE_ATTACK, { px });
}
