// Pixel-art helpers for this monorepo (see .claude/skills/pixel-art/SKILL.md).
// Import from one place:
//   import { SWEETIE16, ramp, lit, shade, bakeSprite, BUILTINS } from '../../src/pixel';
export {
  SWEETIE16,
  SWEETIE16_HEX,
  SWEETIE16_ARRAY,
} from './palette';
export type { Sweetie16Name } from './palette';

export { lerpColor, hueShift, lit, shade, ramp } from './color';
export type { HueShiftOpts, RampOpts } from './color';

export { bakeSprite, BUILTINS } from './bake';
export type { PixelGrid, BakeOpts, BakeResult, BuiltinName } from './bake';
