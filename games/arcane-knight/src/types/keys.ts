// Single source of truth for all string keys.

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  HeroSelect: 'HeroSelectScene',
  Game: 'GameScene',
  UI: 'UIScene', // HUD overlay launched on top of GameScene
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

// Baked pixel textures (src/art.ts). Heroes have multi-frame anims; the rest are
// single sprites. Side-view, 32×32, Sweetie-16.
export const Tex = {
  // Warrior frames
  WarIdle0: 'war-idle0', WarIdle1: 'war-idle1',
  WarWalk0: 'war-walk0', WarWalk1: 'war-walk1', WarWalk2: 'war-walk2', WarWalk3: 'war-walk3',
  WarJump: 'war-jump', WarAtk0: 'war-atk0', WarAtk1: 'war-atk1',
  // Magician frames
  MagIdle0: 'mag-idle0', MagIdle1: 'mag-idle1',
  MagWalk0: 'mag-walk0', MagWalk1: 'mag-walk1', MagWalk2: 'mag-walk2', MagWalk3: 'mag-walk3',
  MagJump: 'mag-jump', MagCast0: 'mag-cast0', MagCast1: 'mag-cast1',
  // enemies + boss
  Slime0: 'slime0', Slime1: 'slime1',
  Bat0: 'bat0', Bat1: 'bat1',
  Skeleton0: 'skeleton0', Skeleton1: 'skeleton1',
  Boss0: 'boss0', Boss1: 'boss1',
  // tiles + props
  Ground: 'ground', Platform: 'platform', Spike: 'spike', Flag: 'flag', Crystal: 'crystal',
  // FX
  Slash: 'slash', Fireball: 'fireball', Hit: 'hit', Heart: 'heart',
} as const;
export type TexKey = (typeof Tex)[keyof typeof Tex];

export const Anim = {
  WarIdle: 'war-idle', WarWalk: 'war-walk', WarAtk: 'war-atk',
  MagIdle: 'mag-idle', MagWalk: 'mag-walk', MagCast: 'mag-cast',
  SlimeMove: 'slime-move', BatFly: 'bat-fly', SkelWalk: 'skel-walk', BossMove: 'boss-move',
} as const;

export type HeroId = 'warrior' | 'magician';

export const RegistryKeys = {
  Hero: 'ak.hero',      // selected HeroId
  Level: 'ak.level',    // current level index
  Hp: 'ak.hp',          // carried HP between levels
} as const;

export const AudioKeys = {} as const;
