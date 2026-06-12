import Phaser from 'phaser';
import { Storage } from './Storage';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// A small modal that lets the player type a leaderboard nickname.
//
// Phaser has no native text field, so we overlay a REAL HTML <input> over the
// canvas, kept almost transparent (the Phaser text + caret are drawn on top for
// the themed look). A real, touchable, visible input is what makes the mobile soft
// keyboard appear:
//   - NO pointer-events:none  (must be touchable, or the OS won't raise keyboard)
//   - NOT opacity:0 / 1px      (mobile refuses a hidden/zero-size input → opacity .01)
//   - focus() called SYNCHRONOUSLY in the pointer gesture (iOS only opens the
//     keyboard from a direct gesture; an async focus is ignored).

export interface NicknameOpts {
  force?: boolean;
  onDone?: (name: string) => void;
}

const MAX = 12, MIN = 3;
const ALLOWED = /^[A-Za-z0-9 _-]$/;

export function showNicknamePrompt(scene: Phaser.Scene, opts: NicknameOpts = {}): void {
  const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT * 0.42;
  let value = (Storage.hasNickname() ? Storage.getNickname() : '').slice(0, MAX);

  const root = scene.add.container(0, 0).setDepth(220);
  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05090b, 0.86).setOrigin(0).setInteractive();
  const card = scene.add.rectangle(cx, cy, GAME_WIDTH - 60, 150, 0x0a1820, 0.99).setStrokeStyle(2, 0x7df0a8);
  const title = scene.add.text(cx, cy - 54, 'YOUR NAME', {
    fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#8bf6b0', stroke: '#05140c', strokeThickness: 4,
  }).setOrigin(0.5);
  const hint = scene.add.text(cx, cy - 34, 'tap the box, then type (3–12 chars)', {
    fontFamily: 'monospace', fontSize: '8px', color: '#9fe3ff',
  }).setOrigin(0.5);

  const boxW = GAME_WIDTH - 110, boxH = 28, boxY = cy - 4;
  const box = scene.add.rectangle(cx, boxY, boxW, boxH, 0x06121a, 1).setStrokeStyle(2, 0x2f8f5a);
  const text = scene.add.text(cx, boxY, value, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
  const placeholder = scene.add.text(cx, boxY, 'tap to type…', { fontFamily: 'monospace', fontSize: '10px', color: '#3f6b5a' }).setOrigin(0.5);
  const caret = scene.add.rectangle(0, boxY, 2, 16, 0x7df0a8).setOrigin(0, 0.5).setVisible(false);
  scene.tweens.add({ targets: caret, alpha: 0, duration: 500, yoyo: true, repeat: -1 });
  const errText = scene.add.text(cx, cy + 18, '', { fontFamily: 'monospace', fontSize: '8px', color: '#ff7db0' }).setOrigin(0.5);

  const okBtn = scene.add.text(cx + 52, cy + 48, 'OK', {
    fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#05140c',
    backgroundColor: '#7df0a8', padding: { x: 16, y: 4 },
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  const cancelBtn = scene.add.text(cx - 52, cy + 48, opts.force ? 'RANDOM' : 'CANCEL', {
    fontFamily: 'monospace', fontSize: '11px', color: '#cdd6e6',
    backgroundColor: '#26424a', padding: { x: 12, y: 5 },
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  root.add([dim, card, title, hint, box, placeholder, text, caret, errText, okBtn, cancelBtn]);

  // ── the REAL HTML <input>, overlaid over the box ──
  const dom = document.createElement('input');
  dom.type = 'text';
  dom.maxLength = MAX;
  dom.value = value;
  dom.setAttribute('autocomplete', 'off');
  dom.setAttribute('autocapitalize', 'off');
  dom.setAttribute('autocorrect', 'off');
  dom.setAttribute('spellcheck', 'false');
  dom.setAttribute('enterkeyhint', 'done');
  dom.setAttribute('aria-label', 'Nickname');
  dom.style.cssText = [
    'position:fixed', 'margin:0', 'padding:0', 'border:0', 'outline:none',
    'background:transparent', 'color:transparent', 'caret-color:transparent',
    'opacity:0.01', 'z-index:2147483647', 'font-size:16px',
    'text-align:center', '-webkit-appearance:none', 'border-radius:0',
  ].join(';') + ';';
  document.body.appendChild(dom);

  const layout = () => {
    const r = scene.game.canvas.getBoundingClientRect();
    const sx = r.width / GAME_WIDTH, sy = r.height / GAME_HEIGHT;
    dom.style.left = `${r.left + (cx - boxW / 2) * sx}px`;
    dom.style.top = `${r.top + (boxY - boxH / 2) * sy}px`;
    dom.style.width = `${boxW * sx}px`;
    dom.style.height = `${boxH * sy}px`;
  };
  layout();
  scene.scale.on(Phaser.Scale.Events.RESIZE, layout);
  window.addEventListener('resize', layout);
  window.addEventListener('scroll', layout, true);

  const valid = () => value.trim().length >= MIN;
  const refresh = () => {
    text.setText(value);
    placeholder.setVisible(value.length === 0);
    caret.setVisible(value.length > 0);
    caret.setPosition(text.x + text.width / 2 + 2, boxY);
    okBtn.setAlpha(valid() ? 1 : 0.4);
    errText.setText(value.length > 0 && !valid() ? `at least ${MIN} characters` : '');
  };
  refresh();

  const onDomInput = () => {
    value = dom.value.replace(/[^A-Za-z0-9 _-]/g, '').slice(0, MAX);
    if (dom.value !== value) dom.value = value;
    refresh();
  };
  const onDomKey = (ev: KeyboardEvent) => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } };
  dom.addEventListener('input', onDomInput);
  dom.addEventListener('keydown', onDomKey);

  const focusInput = () => { try { dom.focus({ preventScroll: true }); } catch { /* ignore */ } };
  box.setInteractive({ useHandCursor: true });
  box.on('pointerdown', focusInput);
  placeholder.setInteractive({ useHandCursor: true });
  placeholder.on('pointerdown', focusInput);
  focusInput();

  const onKey = (ev: KeyboardEvent) => {
    if (document.activeElement === dom) return;
    if (ev.key === 'Enter') { commit(); return; }
    if (ev.key === 'Backspace') { value = value.slice(0, -1); dom.value = value; refresh(); ev.preventDefault(); return; }
    if (ev.key.length === 1 && value.length < MAX && ALLOWED.test(ev.key)) { value += ev.key; dom.value = value; refresh(); }
  };
  scene.input.keyboard?.on('keydown', onKey);

  const close = () => {
    scene.input.keyboard?.off('keydown', onKey);
    scene.scale.off(Phaser.Scale.Events.RESIZE, layout);
    window.removeEventListener('resize', layout);
    window.removeEventListener('scroll', layout, true);
    dom.removeEventListener('input', onDomInput);
    dom.removeEventListener('keydown', onDomKey);
    dom.blur();
    dom.remove();
    root.destroy();
  };
  const commit = () => {
    if (!valid()) return;
    Storage.setNickname(value.trim().slice(0, MAX));
    close();
    opts.onDone?.(Storage.getNickname());
  };
  const cancel = () => {
    if (opts.force) Storage.setNickname(Storage.getNickname());
    close();
    opts.onDone?.(Storage.getNickname());
  };

  okBtn.on('pointerup', commit);
  cancelBtn.on('pointerup', cancel);
  // Tap-outside-to-dismiss — only on a gesture that BOTH started and ended on the
  // dim, so the pointerUP from the click that OPENED this prompt (open-on-down)
  // doesn't immediately cancel it.
  if (!opts.force) {
    let armed = false;
    dim.on('pointerdown', () => { armed = true; });
    dim.on('pointerup', () => { if (armed) cancel(); });
  }
}
