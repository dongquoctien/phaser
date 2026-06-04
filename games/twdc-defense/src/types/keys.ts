// Single source of truth for all string keys.

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  MapSelect: 'MapSelectScene',
  Game: 'GameScene',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

// Pixel-art (Sweetie-16, 32×32 sprites) baked via src/pixel. One key per art piece.
// 15 hero sprites come from the user's reference images (1/2/3.png) — chibi pets.
export const TextureKeys = {
  // Tiles / map — real art cut from the user's asset sheet (public/tiles/*.png),
  // loaded as images in PreloadScene. Grass/dirt are mirror-tiled in-engine for
  // a seamless field; pads + decor are detailed sprites with transparency.
  Grass: 'grass',       // = grass variant 0 (back-compat alias)
  Path: 'path',         // = dirt road body tile
  GrassFringe: 'grass-fringe', // ragged grass lip overhanging the road edge (real art)
  RoadStraight: 'road-straight', // real horizontal road tile (grass top+bottom)
  RoadCorner: 'road-corner',     // real corner tile (dirt South+East; rotate/flip for others)
  Tree: 'tree',
  Rock: 'rock',
  Pad: 'pad',           // empty hero pad (blue glow)
  PadOn: 'pad-on',      // occupied hero pad (green glow)
  // 5 grass variants — one chosen at random per cell so the field never repeats
  Grass0: 'grass0', Grass1: 'grass1', Grass2: 'grass2', Grass3: 'grass3', Grass4: 'grass4',
  // decor variants (picked at random per decor cell for variety)
  TreeRound: 'tree-round', TreePine: 'tree-pine', TreeBig: 'tree-big',
  TreeSmall1: 'tree-small1', TreeSmall2: 'tree-small2',
  RockBig1: 'rock-big1', RockBig2: 'rock-big2', RockMed1: 'rock-med1', RockMed2: 'rock-med2',
  Bush: 'bush', Flowers: 'flowers', Log: 'log', Mushroom: 'mushroom',

  // 25 heroes (user's named sprites; each id matches HEROES in roster.ts)
  // image 1
  HeroEvilCat: 'hero-evilcat',   // black cat w/ spellbook — arcane pierce
  HeroMymy: 'hero-mymy',         // samurai bear w/ katana — melee cleave
  HeroOreo: 'hero-oreo',         // schoolgirl — multishot shuriken
  HeroRwah: 'hero-rwah',         // green critter w/ potion — poison
  HeroEmso: 'hero-emso',         // capybara w/ tulips — heal aura
  HeroMimi: 'hero-mimi',         // pink cat w/ camera — crit sniper
  HeroChippy: 'hero-chippy',     // hamster in beanie — frost slow
  HeroGauEm: 'hero-gauem',       // alpaca — spit splash
  HeroNormal: 'hero-normal',     // orange chainsaw critter — chain lightning
  // image 2
  HeroKenken: 'hero-kenken',     // professor — gold aura
  HeroOldBear: 'hero-oldbear',   // bear w/ boba — sticky slow
  HeroBluefoo: 'hero-bluefoo',   // blue swordsman — double strike
  HeroNixxx: 'hero-nixxx',       // ragdoll cat — knockback
  HeroGauChi: 'hero-gauchi',     // bunny w/ candles — fire nova
  HeroGei: 'hero-gei',           // muscle bear — slam stun
  // image 3
  HeroYunseo: 'hero-yunseo',     // pink pig onesie — bleed DoT
  HeroDongDong: 'hero-dongdong', // yellow outfit — rapidfire
  HeroMidori: 'hero-midori',     // cat-ear green — doubleshot
  HeroAnzu: 'hero-anzu',         // blue wink — buff aura
  HeroNini: 'hero-nini',         // long hair — execute
  HeroHakj: 'hero-hakj',         // blue fish — water bounce
  // image 4
  HeroChuotChu: 'hero-chuotchu', // mouse in orange shirt — multishot
  HeroMeoMeo: 'hero-meomeo',     // long-fur tabby cat — frost slow
  HeroShiba: 'hero-shiba',       // shiba dog — splash + spreading damage
  // new heroes
  HeroHudong: 'hero-hudong',     // bearded man w/ golden urn — Midas (goldify instakill)
  HeroMorgan: 'hero-morgan',     // girl w/ ice penguin — Deep Freeze (hard-freeze + shatter)
  HeroYugitoh: 'hero-yugitoh',   // green cat sage w/ staff — Spirit Orbs (orbiting guardians)
  HeroXxking: 'hero-xxking',     // girl in black — Combo Strikes (stacking melee)
  HeroJoicy: 'hero-joicy',       // oni girl w/ iron club — Thunder Slam (expanding quake)
  HeroXxkong: 'hero-xxkong',     // flame samurai w/ katana — Flame Breathing (stacking burn)

  // Zombies (walker grid kept only for the HUD lives icon)
  ZombieWalker: 'zombie-walker', // grid, used for the HUD lives icon
  // animated zombie spritesheets (cut from reference sheets by scripts/cut-zombie-sheet.mjs)
  ZombieGirlStand: 'zombie-girl-stand',   // walker — idle/walk/attackA/attackB/takeDamage/victory
  ZombieGirlLie: 'zombie-girl-lie',       // walker — death/rise
  ZombieBossStand: 'zombie-boss-stand',   // boss — same anim set as girl
  ZombieBossLie: 'zombie-boss-lie',       // boss — death/rise
  ZombieSpeedStand: 'zombie-speed-stand', // slow (bucket-head) — idle/walk/attack/takeDamage/victory
  ZombieSpeedLie: 'zombie-speed-lie',     // slow — death
  ZombieBruteStand: 'zombie-brute-stand', // brute (satchel girl) — same anim set as girl
  ZombieBruteLie: 'zombie-brute-lie',     // brute — death/rise
  ZombieChainsawStand: 'zombie-chainsaw-stand', // chainsaw critter minion
  ZombieChainsawLie: 'zombie-chainsaw-lie',     // chainsaw — death/rise
  // per-map bosses: khoai (Normal map king), hakj (Hard map fish king)
  ZombieKhoaiStand: 'zombie-khoai-stand', ZombieKhoaiLie: 'zombie-khoai-lie',
  ZombieHakjStand: 'zombie-hakj-stand', ZombieHakjLie: 'zombie-hakj-lie',

  // FX / projectiles
  ProjArcane: 'proj-arcane',
  ProjArrow: 'proj-arrow',
  ProjBullet: 'proj-bullet',
  ProjPoison: 'proj-poison',
  ProjFrost: 'proj-frost',
  ProjSpit: 'proj-spit',
  ProjBolt: 'proj-bolt', // lightning
  Slash: 'slash',
  Explosion: 'explosion',
  Spark: 'spark',
  // animated FX spritesheets (cut from 0assets/effect by scripts/cut-effect-sheet.mjs)
  FxFireball: 'fx-fireball', // 64×64 ×7 — growing flame comet (xxKongxx burn impact)
  FxSlash: 'fx-slash',       // 80×80 ×6 — blue/orange sword-slash arc (xxKongxx hit, Oreo)
  FxIce: 'fx-ice',           // 72×72 ×5 — cyan ice-crystal burst (HAKJ splash)
  FxPotato: 'fx-potato',     // King Khoai's thrown potato projectile
  FxBoneSpear: 'fx-bonespear', // Hakj's thrown fish-bone spear projectile
} as const;
export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

export const AudioKeys = {
  Shoot: 'shoot',
  Hit: 'hit',
  Explode: 'explode',
  Place: 'place',
  Lose: 'lose',
  Click: 'click',
  // zombie sfx
  ZombieGrrr: 'zombie-grrr',
  ZombieGrrr1: 'zombie-grrr1',
  ZombieBossSfx: 'zombie-boss',
  ZombieDie: 'zombie-die',
  ZombieDie2: 'zombie-die2',
  BossKillSlow: 'boss-kill-slow', // tense sting during the slow-mo hero-execution
  Push: 'push',                   // the actual hero-kill blow
  GameOver: 'game-over',          // played once on defeat (full volume)
  Merge: 'merge',                 // fusion "ping" when two heroes merge
} as const;
export type AudioKey = (typeof AudioKeys)[keyof typeof AudioKeys];

// Looping music tracks (handled separately from one-shot SFX in the Audio helper).
export const MusicKeys = {
  Bg: 'bg-music',
  Boss: 'boss-music',
} as const;
export type MusicKey = (typeof MusicKeys)[keyof typeof MusicKeys];

// Font families. Bangers = bold impact display font (OFL) for titles + banners;
// monospace stays for small HUD numbers where legibility beats style.
export const Fonts = {
  Display: 'Bangers, Impact, sans-serif',
  Zombie: 'Creepster, Bangers, Impact, sans-serif', // dripping horror font for boss titles
  Mono: 'monospace',
} as const;

export const RegistryKeys = {
  BestWave: 'bestWave',
  Muted: 'muted',
  TipsSeen: 'twdc.tipsSeen',     // once the first-time tutorial has been dismissed
  HintPadSeen: 'twdc.hintPad',   // one-time "tap a pad" contextual hint shown
  HintMergeSeen: 'twdc.hintMerge', // one-time "drag to merge" contextual hint shown
  PlayerId: 'twdc.playerId',     // anonymous guest UUID (persisted in localStorage)
  Nickname: 'twdc.nickname',     // player display name for the leaderboard
} as const;

// Per-map progress keys (persisted in the Phaser registry).
export const mapBestKey = (mapIndex: number): string => `twdc.map${mapIndex}.best`;
export const mapClearedKey = (mapIndex: number): string => `twdc.map${mapIndex}.cleared`;
