// Colour maths for the pixel-art skill — Phaser-free so it tree-shakes for any
// caller. Colours are 0xRRGGBB ints in and out.
//
// The core craft rule encoded here is HUE-SHIFTING: when you lighten a colour you
// also rotate its hue toward warm (yellow/orange); when you darken, toward cool
// (blue/purple). Single-hue lighten/darken looks flat and amateur — ramps must
// shift hue. (SLYNYRD Pixelblog #1, Lospec.)

function toRgb(c: number): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}
function fromRgb(r: number, g: number, b: number): number {
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (cl(r) << 16) | (cl(g) << 8) | cl(b);
}

/** Linear blend between two colours, t in [0,1]. */
export function lerpColor(a: number, b: number, t: number): number {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return fromRgb(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

export interface HueShiftOpts {
  /** lightness delta (−1..1); positive = lighter. Default sign drives warmth. */
  val?: number;
  /** saturation delta. */
  sat?: number;
}

/**
 * Rotate a colour's hue by `deg` (signed) and optionally nudge value/saturation.
 * Positive `deg` rotates toward warm; combine with val>0 for a lit step.
 */
export function hueShift(c: number, deg: number, opts: HueShiftOpts = {}): number {
  const [r, g, b] = toRgb(c);
  let [h, s, l] = rgbToHsl(r, g, b);
  h = (((h + deg) % 360) + 360) % 360;
  if (opts.sat) s = Math.max(0, Math.min(1, s + opts.sat));
  if (opts.val) l = Math.max(0, Math.min(1, l + opts.val));
  const [nr, ng, nb] = hslToRgb(h, s, l);
  return fromRgb(nr, ng, nb);
}

/** Lighter + warmer variant (highlight). `steps` scales the shift. */
export function lit(c: number, steps = 1): number {
  return hueShift(c, 18 * steps, { val: 0.12 * steps, sat: -0.04 * steps });
}

/** Darker + cooler variant (shadow). `steps` scales the shift. */
export function shade(c: number, steps = 1): number {
  return hueShift(c, -18 * steps, { val: -0.12 * steps, sat: -0.02 * steps });
}

export interface RampOpts {
  /** total hue rotation across the ramp, dark→light. Default 35°. */
  hueShiftDeg?: number;
  /** lightness spread dark→light. Default 0.6. */
  valueSpread?: number;
}

/**
 * Build a value ramp from a base colour: `steps` colours ordered dark→light,
 * hue-shifted warm toward the light end and cool toward the dark end.
 */
export function ramp(base: number, steps: number, opts: RampOpts = {}): number[] {
  const deg = opts.hueShiftDeg ?? 35;
  const spread = opts.valueSpread ?? 0.6;
  if (steps < 1) return [];
  if (steps === 1) return [base];
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1) - 0.5; // −0.5 (dark) .. +0.5 (light)
    out.push(hueShift(base, deg * t, { val: spread * t }));
  }
  return out; // index 0 = darkest, last = lightest
}
