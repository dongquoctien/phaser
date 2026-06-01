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
  // Tiles / map
  Grass: 'grass',
  Path: 'path',
  Tree: 'tree',
  Rock: 'rock',
  Pad: 'pad', // empty hero pad (build slot)

  // 21 heroes (user's named sprites; each id matches HEROES in roster.ts)
  // image 1
  HeroEvilCat: 'hero-evilcat',   // black cat w/ spellbook — arcane pierce
  HeroMymy: 'hero-mymy',         // samurai bear w/ katana — melee cleave
  HeroOreo: 'hero-oreo',         // schoolgirl — multishot shuriken
  HeroRwah: 'hero-rwah',         // green critter w/ potion — poison
  HeroEmso: 'hero-emso',         // capybara w/ tulips — heal aura
  HeroMimi: 'hero-mimi',         // pink cat w/ camera — crit sniper
  HeroChippy: 'hero-chippy',     // hamster in beanie — frost slow
  HeroGauEm: 'hero-gauem',       // alpaca — spit splash
  HeroNormal: 'hero-normal',     // tuxedo cat — chain lightning
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

  // Zombies
  ZombieWalker: 'zombie-walker',
  ZombieRunner: 'zombie-runner',
  ZombieBrute: 'zombie-brute',
  ZombieBoss: 'zombie-boss',

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
} as const;
export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

export const AudioKeys = {
  Shoot: 'shoot',
  Hit: 'hit',
  Explode: 'explode',
  Place: 'place',
  Lose: 'lose',
  Click: 'click',
} as const;
export type AudioKey = (typeof AudioKeys)[keyof typeof AudioKeys];

export const RegistryKeys = {
  BestWave: 'bestWave',
  Muted: 'muted',
} as const;

// Per-map progress keys (persisted in the Phaser registry).
export const mapBestKey = (mapIndex: number): string => `twdc.map${mapIndex}.best`;
export const mapClearedKey = (mapIndex: number): string => `twdc.map${mapIndex}.cleared`;
