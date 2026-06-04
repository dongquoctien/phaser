import Phaser from 'phaser';
import { RegistryKeys } from '../types/keys';
import { Storage } from './Storage';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// A small modal that lets the player type a nickname for the leaderboard.
//
// Phaser has no native text field, so we overlay a REAL HTML <input> on top of the
// canvas, sized + positioned over the on-screen input box, kept almost transparent
// (the Phaser text + caret are drawn on top for the themed look). Using a real,
// touchable, visible input is what makes the mobile soft keyboard appear:
//   - NO pointer-events:none  (the input must be touchable, or the OS won't raise
//     the keyboard)
//   - NOT opacity:0 / 1px      (a fully-hidden/zero-size input is refused by mobile
//     browsers — we use a real size and opacity ~0.01)
//   - focus() is called SYNCHRONOUSLY inside the pointer gesture (iOS Safari only
//     opens the keyboard from a direct user gesture — a setTimeout/async focus is
//     silently ignored).
// See: iOS Safari keyboard-focus limitation (focus must be in a click handler).
//
// Usage:
//   showNicknamePrompt(scene, { force: true, onDone: () => ... })
//   force=true blocks cancel (first run); else a SKIP/cancel is allowed.

export interface NicknameOpts {
  force?: boolean;        // first-run: must enter a name (no cancel)
  onDone?: (name: string) => void;
}

const MAX = 12, MIN = 3;
const ALLOWED = /^[A-Za-z0-9 _-]$/; // printable name chars

export function showNicknamePrompt(scene: Phaser.Scene, opts: NicknameOpts = {}): void {
  const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT * 0.4;
  let value = (Storage.hasNickname() ? Storage.getNickname() : '').slice(0, MAX);

  const root = scene.add.container(0, 0).setDepth(1200);
  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05140a, 0.86).setOrigin(0).setInteractive();
  const card = scene.add.rectangle(cx, cy, GAME_WIDTH - 60, 240, 0x1a2e12, 0.99).setStrokeStyle(3, 0xffe14d);
  const title = scene.add.text(cx, cy - 86, 'YOUR NAME', {
    fontFamily: 'monospace', fontSize: '30px', color: '#ffe14d', fontStyle: 'bold', stroke: '#1a2e12', strokeThickness: 5,
  }).setOrigin(0.5);
  const hint = scene.add.text(cx, cy - 54, 'Tap the box, then type (3–12 chars)', {
    fontFamily: 'monospace', fontSize: '10px', color: '#b6d99a',
  }).setOrigin(0.5);

  // input box + the typed text + a blinking caret (the visual; the real <input> sits on top)
  const boxW = GAME_WIDTH - 110, boxH = 44, boxY = cy - 6;
  const box = scene.add.rectangle(cx, boxY, boxW, boxH, 0x0c1a08, 1).setStrokeStyle(2, 0x5a8a3a);
  const text = scene.add.text(cx, boxY, value, {
    fontFamily: 'monospace', fontSize: '20px', color: '#ffffff',
  }).setOrigin(0.5);
  const placeholder = scene.add.text(cx, boxY, 'tap to type…', {
    fontFamily: 'monospace', fontSize: '14px', color: '#5a8a3a',
  }).setOrigin(0.5);
  const caret = scene.add.rectangle(0, boxY, 2, 24, 0xffe14d).setOrigin(0, 0.5).setVisible(false);
  scene.tweens.add({ targets: caret, alpha: 0, duration: 500, yoyo: true, repeat: -1 });

  const errText = scene.add.text(cx, cy + 30, '', {
    fontFamily: 'monospace', fontSize: '10px', color: '#ff6b6b',
  }).setOrigin(0.5);

  // buttons
  const okBtn = scene.add.text(cx + 60, cy + 70, 'OK', {
    fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', fontStyle: 'bold', stroke: '#1a2e12', strokeThickness: 4,
    backgroundColor: '#2a8a3a', padding: { x: 22, y: 6 },
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  const cancelBtn = scene.add.text(cx - 60, cy + 70, opts.force ? 'RANDOM' : 'CANCEL', {
    fontFamily: 'monospace', fontSize: '18px', color: '#cdd6e6', fontStyle: 'bold', stroke: '#1a2e12', strokeThickness: 4,
    backgroundColor: '#3a4f2f', padding: { x: 16, y: 6 },
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  root.add([dim, card, title, hint, box, placeholder, text, caret, errText, okBtn, cancelBtn]);

  // ── the REAL HTML <input>, overlaid on the canvas over the box ──────────────────
  // It is touchable and (barely) visible so the mobile soft keyboard opens; the
  // Phaser text/caret above render the themed look. We size/position it to the box
  // in CSS pixels by mapping game coords through the canvas rect each layout.
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
  // Visible-but-transparent: real size (touch target), opacity ~0 so Phaser shows
  // through. NO pointer-events:none. NO opacity:0. Text colour transparent so the
  // native value doesn't double up over the Phaser text.
  dom.style.cssText = [
    'position:fixed', 'margin:0', 'padding:0', 'border:0', 'outline:none',
    'background:transparent', 'color:transparent', 'caret-color:transparent',
    'opacity:0.01', 'z-index:2147483647', 'font-size:16px', // 16px stops iOS zoom-on-focus
    'text-align:center', '-webkit-appearance:none', 'border-radius:0',
  ].join(';') + ';';
  document.body.appendChild(dom);

  // Map the Phaser box rect to CSS px over the canvas, and keep it in sync.
  const layout = () => {
    const canvas = scene.game.canvas;
    const r = canvas.getBoundingClientRect();
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
    errText.setText(value.length > 0 && !valid() ? `At least ${MIN} characters` : '');
  };
  refresh();

  // sync from the real input on every change (covers soft keyboard, paste, IME)
  const onDomInput = () => {
    value = dom.value.replace(/[^A-Za-z0-9 _-]/g, '').slice(0, MAX);
    if (dom.value !== value) dom.value = value;
    refresh();
  };
  const onDomKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
  };
  dom.addEventListener('input', onDomInput);
  dom.addEventListener('keydown', onDomKey);

  // Focus the real input SYNCHRONOUSLY inside the tap gesture — required for iOS to
  // raise the keyboard. Both the box zone and the input itself trigger it.
  const focusInput = () => { try { dom.focus({ preventScroll: true }); } catch { /* ignore */ } };
  box.setInteractive({ useHandCursor: true });
  box.on('pointerdown', focusInput);
  placeholder.setInteractive({ useHandCursor: true });
  placeholder.on('pointerdown', focusInput);
  // try an initial focus too (works on desktop / Android; harmless on iOS)
  focusInput();

  // Keyboard entry fallback for DESKTOP, ONLY when the real <input> does NOT have
  // focus — otherwise the input's own 'input' event already handled the keystroke
  // and counting it here too would double every character.
  const onKey = (ev: KeyboardEvent) => {
    if (document.activeElement === dom) return; // input handles it via onDomInput
    if (ev.key === 'Enter') { commit(); return; }
    if (ev.key === 'Backspace') { value = value.slice(0, -1); dom.value = value; refresh(); ev.preventDefault(); return; }
    if (ev.key.length === 1 && value.length < MAX && ALLOWED.test(ev.key)) {
      value += ev.key; dom.value = value; refresh();
    }
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
    const name = value.trim().slice(0, MAX);
    Storage.setNickname(name);
    scene.registry.set(RegistryKeys.Nickname, name);
    close();
    opts.onDone?.(name);
  };
  const cancel = () => {
    if (opts.force) {
      // first run: "RANDOM" assigns the default Player#### name so we never leave
      // the player nameless.
      const name = Storage.getNickname();
      Storage.setNickname(name);
      scene.registry.set(RegistryKeys.Nickname, name);
    }
    close();
    opts.onDone?.(Storage.getNickname());
  };

  okBtn.on('pointerup', commit);
  cancelBtn.on('pointerup', cancel);
  if (!opts.force) dim.on('pointerup', cancel); // tap outside to dismiss when optional
}
