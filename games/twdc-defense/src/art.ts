import Phaser from 'phaser';
import { bakeSprite, type PixelGrid } from '../../../src/pixel';
import { TextureKeys } from './types/keys';
import baseArt from './baseArt.json';

// Tiles, zombies and FX are hand-drawn 32×32 Sweetie-16 pixel grids (authored +
// Playwright-verified), baked once here. The 15 HEROES are NOT baked — they are
// the user's own reference sprites, loaded as PNGs in PreloadScene (see
// HERO_TEXTURES) so they keep their full original detail.

const data = baseArt as { map: Record<string, string | null>; art: Record<string, string[]> };

// art.json key → TextureKey (zombies/FX use the same string ids as the keys).
const BAKE_MAP: Record<string, string> = {
  // grass/path/tree/rock/pad are no longer baked — they load as real art from
  // public/tiles/ (see PreloadScene). Only FX, projectiles and the HUD zombie
  // icon are still hand-baked pixel grids.
  // walker grid kept ONLY for the HUD lives icon. All 4 zombie types now use
  // animated spritesheets (see PreloadScene); runner removed.
  'zombie-walker': TextureKeys.ZombieWalker,
  'proj-arcane': TextureKeys.ProjArcane, 'proj-arrow': TextureKeys.ProjArrow, 'proj-bullet': TextureKeys.ProjBullet,
  'proj-poison': TextureKeys.ProjPoison, 'proj-frost': TextureKeys.ProjFrost, 'proj-spit': TextureKeys.ProjSpit,
  'proj-bolt': TextureKeys.ProjBolt, slash: TextureKeys.Slash, explosion: TextureKeys.Explosion, spark: TextureKeys.Spark,
};

export function bakeArt(scene: Phaser.Scene): void {
  for (const [srcKey, texKey] of Object.entries(BAKE_MAP)) {
    const grid = data.art[srcKey];
    if (!grid) continue;
    const sprite: PixelGrid = { grid, map: data.map };
    // tiles render 1:1 at CELL=40 (32px grid × ~1.25 on-screen); FX/zombies px=2
    const px = (srcKey === 'grass' || srcKey === 'path') ? 1 : 2;
    bakeSprite(scene, texKey, sprite, { px });
  }
}
