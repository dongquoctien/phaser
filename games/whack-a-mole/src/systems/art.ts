import Phaser from 'phaser';
import { TexKeys } from '../types/keys';

// Procedurally bakes the non-character art (holes, dirt mounds, particles, the
// mallet) into textures once at preload. Drawing them in code keeps everything
// CC0-clean and style-cohesive with the pixel characters. Pixel-art friendly:
// flat shapes + a hand-placed highlight/shadow ramp, no anti-aliasing reliance.

export const HOLE_W = 132;
export const HOLE_H = 58; // the opening ellipse
export const MOUND_W = 156;
export const MOUND_H = 60; // the front dirt rim (opaque crescent in FRONT of char)

// dirt palette (value ramp, warm) — reused across hole/mound/particles
const DIRT_DARK = 0x2a1a10;
const DIRT_HOLE = 0x18100a;
const DIRT_CORE = 0x0d0805;
const DIRT_RIM = 0x6b4a30;
const DIRT_RIM_LO = 0x533826;
const DIRT_RIM_HI = 0x8a6440;
const DIRT_TOP = 0xa07a4e;
const GRASS = 0x6cb83e;
const GRASS_DK = 0x4f9a31;
const GRASS_LT = 0x8fd457;

export function bakeArt(scene: Phaser.Scene): void {
  bakeHole(scene);
  bakeMound(scene);
  bakeDirt(scene);
  bakeStar(scene);
  bakeRing(scene);
  bakeMarker(scene);
  bakeWeapons(scene);
}

// A flat glowing ground marker (an ellipse halo) placed under a popped
// character's feet. Baked in WHITE so the scene can tint it red (enemy) or
// green (friendly) — one texture, two meanings. Telegraphs which characters are
// safe to bonk so the player doesn't have to memorise the roster.
export const MARKER_W = 120;
export const MARKER_H = 40;
function bakeMarker(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const cx = MARKER_W / 2,
    cy = MARKER_H / 2;
  // soft outer glow ring (filled ellipse, lower alpha) + a brighter inner ring
  g.fillStyle(0xffffff, 0.28).fillEllipse(cx, cy, MARKER_W, MARKER_H);
  g.fillStyle(0xffffff, 0.0); // punch a hole to make it a ring
  // draw as two stroked ellipses instead (crisper at pixel scale)
  g.clear();
  g.lineStyle(6, 0xffffff, 0.85).strokeEllipse(cx, cy, MARKER_W - 10, MARKER_H - 8);
  g.lineStyle(3, 0xffffff, 0.45).strokeEllipse(cx, cy, MARKER_W - 2, MARKER_H - 2);
  g.generateTexture(TexKeys.Marker, MARKER_W, MARKER_H);
  g.destroy();
}

// The dark hole the character rises out of — drawn BEHIND the character.
// A sunken ellipse: outer dirt ring -> inner shadow -> black core, with a thin
// rim-light arc on the upper edge so it reads as a 3D pit, not a flat blob.
function bakeHole(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const cx = HOLE_W / 2,
    cy = HOLE_H / 2;
  // outer ring of disturbed dirt (slightly bigger, darker)
  g.fillStyle(DIRT_RIM_LO, 1).fillEllipse(cx, cy + 2, HOLE_W, HOLE_H);
  g.fillStyle(DIRT_DARK, 1).fillEllipse(cx, cy + 1, HOLE_W - 12, HOLE_H - 8);
  // the opening
  g.fillStyle(DIRT_HOLE, 1).fillEllipse(cx, cy + 2, HOLE_W - 30, HOLE_H - 18);
  // deepest core, pushed down so the bottom is darkest (light from above)
  g.fillStyle(DIRT_CORE, 1).fillEllipse(cx, cy + 6, HOLE_W - 52, HOLE_H - 30);
  // rim light on the TOP inner edge (thin warm arc)
  g.fillStyle(DIRT_TOP, 0.5).fillEllipse(cx, cy - 6, HOLE_W - 34, 10);
  g.generateTexture(TexKeys.Hole, HOLE_W, HOLE_H);
  g.destroy();
}

// The front dirt rim — an OPAQUE mound drawn IN FRONT of (higher depth than) the
// character, so whatever part of the body is still "in the hole" is hidden
// behind it. No WebGL mask needed (Phaser 4 dropped geometry masks on sprites).
// Built as a stack of ellipses (shadow base -> rim -> lit top) for a raised,
// rounded read, topped with irregular grass tufts.
function bakeMound(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const cx = MOUND_W / 2;
  const lip = 20; // y of the rim's top edge inside the texture
  // base shadow under the mound
  g.fillStyle(DIRT_RIM_LO, 1).fillEllipse(cx, lip + 18, MOUND_W, 60);
  // main rim body
  g.fillStyle(DIRT_RIM, 1).fillEllipse(cx, lip + 14, MOUND_W - 8, 50);
  // lit top band (front face catches light)
  g.fillStyle(DIRT_RIM_HI, 1).fillEllipse(cx, lip + 10, MOUND_W - 30, 36);
  g.fillStyle(DIRT_TOP, 1).fillEllipse(cx, lip + 8, MOUND_W - 64, 22);
  // scattered pebbles for texture
  g.fillStyle(DIRT_RIM_LO, 1);
  for (const [dx, dy] of [[-50, 22], [-20, 30], [28, 26], [54, 20], [10, 18]]) {
    g.fillRect(cx + dx, lip + dy, 4, 3);
  }
  // grass tufts along the rim — varied height/width, two greens for depth
  for (let i = 0; i < 14; i++) {
    const dx = -MOUND_W / 2 + 8 + i * ((MOUND_W - 16) / 13);
    const h = 8 + ((i * 7) % 9); // pseudo-random height
    const base = lip + 6 + ((i * 5) % 5);
    g.fillStyle(i % 2 ? GRASS : GRASS_DK, 1);
    g.fillTriangle(cx + dx - 3, base, cx + dx, base - h, cx + dx + 3, base);
  }
  // a few bright grass highlights
  g.fillStyle(GRASS_LT, 1);
  for (const dx of [-40, -8, 30, 58]) {
    g.fillTriangle(cx + dx - 1, lip + 8, cx + dx, lip + 0, cx + dx + 1, lip + 8);
  }
  g.generateTexture(TexKeys.Mound, MOUND_W, MOUND_H);
  g.destroy();
}

// A small flying dirt clod (hit particle).
function bakeDirt(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(DIRT_RIM_LO, 1).fillRect(0, 0, 8, 8);
  g.fillStyle(DIRT_RIM, 1).fillRect(0, 0, 5, 5);
  g.fillStyle(DIRT_TOP, 1).fillRect(0, 0, 2, 2);
  g.generateTexture(TexKeys.Dirt, 8, 8);
  g.destroy();
}

// A 4-point sparkle star (good-hit particle).
function bakeStar(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const s = 16,
    c = s / 2;
  g.fillStyle(0xfff8c4, 1);
  g.fillTriangle(c, 0, c - 3, c, c + 3, c); // top
  g.fillTriangle(c, s, c - 3, c, c + 3, c); // bottom
  g.fillTriangle(0, c, c, c - 3, c, c + 3); // left
  g.fillTriangle(s, c, c, c - 3, c, c + 3); // right
  g.fillStyle(0xffffff, 1).fillRect(c - 2, c - 2, 4, 4);
  g.generateTexture(TexKeys.Star, s, s);
  g.destroy();
}

// A hollow white impact ring (expands + fades on a successful bonk).
function bakeRing(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const s = 64,
    c = s / 2;
  g.lineStyle(6, 0xffffff, 1).strokeCircle(c, c, c - 6);
  g.generateTexture(TexKeys.Ring, s, s);
  g.destroy();
}

// ===== Weapons (the cursor / striker) =====================================
// Three pickable weapons, NO hand — just the head + a short shaft. Each is drawn
// upright in its own texture; the striking head sits at the top so the swing
// tween (raise → slam) reads naturally. Each weapon exports an ORIGIN (fraction
// of its texture) at the centre of the striking head so it lands on the tap.
//
// All three share one texture size + head centre so the in-scene origin/scale
// logic is uniform.
const WPN_W = 112;
const WPN_H = 150;
const WPN_CX = 56; // head centre x
const WPN_HEAD_CY = 44; // head centre y
export const WEAPON_ORIGIN = { x: WPN_CX / WPN_W, y: WPN_HEAD_CY / WPN_H };

// wood shaft shared by all three
function drawShaft(g: Phaser.GameObjects.Graphics, topY: number): void {
  const cx = WPN_CX;
  g.fillStyle(0x6f4318, 1).fillRoundedRect(cx - 8, topY, 16, WPN_H - topY - 6, 7);
  g.fillStyle(0xa9712f, 1).fillRect(cx - 5, topY + 2, 10, WPN_H - topY - 12);
  g.fillStyle(0xc9954a, 1).fillRect(cx - 3, topY + 4, 4, WPN_H - topY - 16);
}

function bakeWeapons(scene: Phaser.Scene): void {
  bakePan(scene);
  bakeMace(scene);
  bakeSwatter(scene);
}

// --- SWATTER: a RED flyswatter (Oggy-style) — a perforated red pad on a thin
// light handle, the holes punched right through. ---
function bakeSwatter(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const cx = WPN_CX,
    cy = WPN_HEAD_CY;
  // thin light-grey/blue plastic handle (like the reference)
  g.fillStyle(0x7d8a93, 1).fillRoundedRect(cx - 5, cy + 10, 10, WPN_H - (cy + 10) - 6, 5);
  g.fillStyle(0xa8b4bc, 1).fillRect(cx - 3, cy + 12, 4, WPN_H - (cy + 12) - 12);
  // the swat pad — a rounded square, bright RED plastic, with a dark outline
  const pw = 88,
    ph = 66;
  const px = cx - pw / 2,
    py = cy - ph / 2;
  g.fillStyle(0x7a0f12, 1).fillRoundedRect(px - 3, py - 3, pw + 6, ph + 6, 20); // outline
  g.fillStyle(0xe23c33, 1).fillRoundedRect(px, py, pw, ph, 18); // red pad
  g.fillStyle(0xf26a5e, 1).fillRoundedRect(px + 5, py + 4, pw - 10, 12, 8); // top sheen
  g.fillStyle(0xb71f1f, 0.8).fillRoundedRect(px + 5, py + ph - 14, pw - 10, 9, 6); // bottom shade
  // the punched holes (grid of dark dots) — the signature swatter look
  g.fillStyle(0x6e0c0e, 1);
  const cols = 6,
    rows = 4;
  const gx = (pw - 18) / (cols - 1),
    gy = (ph - 22) / (rows - 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      g.fillCircle(px + 9 + c * gx, py + 11 + r * gy, 3.4);
    }
  }
  // a little ferrule where the handle meets the pad
  g.fillStyle(0x5a6670, 1).fillRoundedRect(cx - 7, cy + ph / 2 - 6, 14, 14, 4);
  g.generateTexture(TexKeys.WeaponSwatter, WPN_W, WPN_H);
  g.destroy();
}

// --- MACE: grey spiked ball on a shaft ---
function bakeMace(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const cx = WPN_CX,
    cy = WPN_HEAD_CY;
  drawShaft(g, cy + 8);
  const r = 30;
  // spikes radiating from the ball (drawn under the ball so bases are hidden)
  g.fillStyle(0x6b7079, 1);
  const spikes = 10;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const bx = cx + Math.cos(a) * (r - 4);
    const by = cy + Math.sin(a) * (r - 4);
    const tx = cx + Math.cos(a) * (r + 16);
    const ty = cy + Math.sin(a) * (r + 16);
    // a triangle spike
    const pa = a + 0.22,
      pb = a - 0.22;
    g.fillTriangle(
      cx + Math.cos(pa) * (r - 2),
      cy + Math.sin(pa) * (r - 2),
      cx + Math.cos(pb) * (r - 2),
      cy + Math.sin(pb) * (r - 2),
      tx,
      ty,
    );
    g.fillStyle(0x8b93a2, 1).fillCircle(tx, ty, 2.5); // bright spike tip
    g.fillStyle(0x6b7079, 1);
    void bx;
    void by;
  }
  // the iron ball
  g.fillStyle(0x3f4147, 1).fillCircle(cx, cy, r + 3); // outline
  g.fillStyle(0x7c828c, 1).fillCircle(cx, cy, r);
  g.fillStyle(0xa3a9b2, 1).fillCircle(cx - 9, cy - 9, r * 0.5); // top-left light
  g.fillStyle(0x565b63, 0.7).fillCircle(cx + 10, cy + 10, r * 0.45); // shade
  // a few rivets
  g.fillStyle(0x565b63, 1).fillCircle(cx, cy - 12, 2.5);
  g.fillStyle(0x565b63, 1).fillCircle(cx - 12, cy + 6, 2);
  g.generateTexture(TexKeys.WeaponMace, WPN_W, WPN_H);
  g.destroy();
}

// --- PAN: black frying pan seen face-on, with a short handle stub up top ---
function bakePan(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const cx = WPN_CX,
    cy = WPN_HEAD_CY;
  drawShaft(g, cy + 14);
  // pan handle stub poking up-right from the rim (so it reads as a pan)
  g.fillStyle(0x2a2d33, 1).fillRoundedRect(cx + 30, cy - 30, 14, 34, 6);
  g.fillStyle(0x44484f, 1).fillRect(cx + 33, cy - 28, 4, 28);
  // the round pan body (face-on ellipse, slightly squashed)
  const rx = 46,
    ry = 40;
  g.fillStyle(0x141518, 1).fillEllipse(cx, cy, rx * 2 + 6, ry * 2 + 6); // outline
  g.fillStyle(0x33373d, 1).fillEllipse(cx, cy, rx * 2, ry * 2); // outer rim
  g.fillStyle(0x1d1f23, 1).fillEllipse(cx, cy, rx * 2 - 14, ry * 2 - 14); // cooking surface
  g.fillStyle(0x40454d, 0.8).fillEllipse(cx - 12, cy - 12, rx * 0.7, ry * 0.6); // sheen
  g.lineStyle(3, 0x0c0d0f, 1).strokeEllipse(cx, cy, rx * 2 - 14, ry * 2 - 14); // inner ring
  g.generateTexture(TexKeys.WeaponPan, WPN_W, WPN_H);
  g.destroy();
}

// Map weapon id -> its baked texture key.
export const WEAPON_TEX: Record<string, string> = {
  pan: TexKeys.WeaponPan,
  mace: TexKeys.WeaponMace,
  swatter: TexKeys.WeaponSwatter,
};
