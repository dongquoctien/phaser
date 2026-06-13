import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Tex, Icon } from '../types/keys';

// Full-screen "HOW TO PLAY" overlay. Teaches the controls + rules using the REAL
// game sprites beside short labels (show-don't-tell: the player sees exactly what
// each thing looks like). Self-contained — call showHowToPlay(scene) and it cleans
// up on close. Follows the project modal rules (phaser-ui-ux): an interactive dim
// that ARMS on its own pointerdown (so the opening click can't dismiss it), a
// close button added last, pixel icons (never emoji).
export function showHowToPlay(scene: Phaser.Scene, onClose?: () => void): void {
  const cx = GAME_WIDTH / 2;
  const root = scene.add.container(0, 0).setDepth(240);
  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05090b, 0.95).setOrigin(0).setInteractive();
  root.add(dim);

  const title = scene.add.text(cx, 18, 'HOW TO PLAY', {
    fontFamily: '"Pixelify Sans", monospace', fontSize: '20px', fontStyle: 'bold',
    color: '#7df0a8', stroke: '#05140c', strokeThickness: 4,
  }).setOrigin(0.5);
  root.add(title);

  // Each row: an icon (a real game sprite, or a control glyph) + a label. Rows are
  // laid out in a tidy two-block column so it fits the 426x240 screen.
  const startY = 44;
  const rowH = 23;
  const iconX = 30;
  const textX = 52;

  // Render one row; `icon` is either a texture key (sprite) or a control container.
  const addRow = (
    i: number, label: string, build: (x: number, y: number) => Phaser.GameObjects.GameObject,
  ) => {
    const y = startY + i * rowH;
    const ic = build(iconX, y);
    const t = scene.add.text(textX, y, label, {
      fontFamily: 'monospace', fontSize: '10px', color: '#e8f6ee',
    }).setOrigin(0, 0.5);
    root.add([ic, t]);
  };

  // a sprite icon sized to ~18px, vertically centred
  const sprite = (key: string, x: number, y: number, size = 18, frame?: number) =>
    scene.add.image(x, y, key, frame).setDisplaySize(size, size);

  // ── Controls ──
  // Move: arrow-left + a mirrored copy for right.
  addRow(0, 'MOVE  —  ← →  or  A D  (tap pads on mobile)', (x, y) => {
    const c = scene.add.container(x, y);
    const l = scene.add.image(-5, 0, Icon.ArrowLeft).setDisplaySize(14, 14).setTint(0x9fe3ff);
    const r = scene.add.image(6, 0, Icon.ArrowLeft).setDisplaySize(14, 14).setTint(0x9fe3ff).setFlipX(true);
    return c.add([l, r]);
  });
  // Jump: arrow-up.
  addRow(1, 'JUMP  —  ↑ / W / SPACE  (tap ▲ pad)  ·  hold = higher', (x, y) =>
    scene.add.image(x, y, Icon.ArrowUp).setDisplaySize(14, 14).setTint(0x9fe3ff));

  // ── Rules ──
  addRow(2, 'Grab STARS and COINS for points', (x, y) => {
    const c = scene.add.container(x, y);
    return c.add([sprite(Tex.Star, -5, 0, 16), sprite(Tex.Coin, 8, 0, 12)]);
  });
  addRow(3, 'STOMP enemies from above to beat them', (x, y) => sprite(Tex.Robot, x, y, 18));
  addRow(4, 'But SPIKED bugs & BATS hurt — dodge them!', (x, y) => {
    const c = scene.add.container(x, y);
    return c.add([sprite(Tex.Beetle, -5, 0, 16), sprite(Tex.Bat, 9, 0, 16)]);
  });
  addRow(5, 'Hit ? BLOCKS from below for a star', (x, y) => sprite(Tex.Block, x, y, 16));
  addRow(6, 'Reach the DOOR to clear the level', (x, y) => sprite(Tex.Door, x, y, 20));

  // close button — added LAST so it's above everything (phaser-ui-ux §6).
  const close = () => { root.destroy(); onClose?.(); };
  const closeBtn = scene.add.image(GAME_WIDTH - 14, 16, Icon.Close).setDisplaySize(16, 16).setTint(0xff7db0)
    .setInteractive({ useHandCursor: true });
  closeBtn.on('pointerup', close);
  root.add(closeBtn);

  // a "GOT IT!" button at the bottom — the obvious way to dismiss.
  const gotY = GAME_HEIGHT - 18;
  const gotLabel = scene.add.text(cx, gotY, 'GOT IT!', {
    fontFamily: '"Pixelify Sans", monospace', fontSize: '13px', fontStyle: 'bold', color: '#05140c',
  }).setOrigin(0.5);
  const gw = gotLabel.width + 24;
  const gotBg = scene.add.graphics();
  gotBg.fillStyle(0x7df0a8, 1).fillRoundedRect(cx - gw / 2, gotY - 10, gw, 20, 5);
  gotBg.lineStyle(2, 0x2f8f5a, 1).strokeRoundedRect(cx - gw / 2, gotY - 10, gw, 20, 5);
  const gotZone = scene.add.zone(cx, gotY, gw, 24).setOrigin(0.5).setInteractive({ useHandCursor: true });
  gotZone.on('pointerup', close);
  root.add([gotBg, gotLabel, gotZone]);

  // dim closes only on a gesture that BOTH starts and ends on it (phaser-ui-ux §1b).
  let armed = false;
  dim.on('pointerdown', () => { armed = true; });
  dim.on('pointerup', () => { if (armed) close(); });
}
