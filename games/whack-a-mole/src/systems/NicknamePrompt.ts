import Phaser from 'phaser';
import { RegistryKeys } from '../types/keys';
import { Storage } from './Storage';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// A small modal that lets the player type a nickname for the leaderboard.
//
// Phaser has no native text field, so we drive entry off the keyboard (desktop)
// AND a hidden HTML <input> mounted over the canvas (mobile — it raises the soft
// keyboard and feeds value back). The chosen name is saved via Storage + mirrored
// to the registry. Validates 3–12 chars; OK is disabled until valid.
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
  const hint = scene.add.text(cx, cy - 54, 'Shown on the leaderboard (3–12 chars)', {
    fontFamily: 'monospace', fontSize: '10px', color: '#b6d99a',
  }).setOrigin(0.5);

  // input box + the typed text + a blinking caret
  const box = scene.add.rectangle(cx, cy - 6, GAME_WIDTH - 110, 44, 0x0c1a08, 1).setStrokeStyle(2, 0x5a8a3a);
  const text = scene.add.text(cx, cy - 6, value, {
    fontFamily: 'monospace', fontSize: '20px', color: '#ffffff',
  }).setOrigin(0.5);
  const caret = scene.add.rectangle(0, cy - 6, 2, 24, 0xffe14d).setOrigin(0, 0.5);
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

  root.add([dim, card, title, hint, box, text, caret, errText, okBtn, cancelBtn]);

  // hidden HTML input — focused on open so mobile raises the soft keyboard and so
  // desktop paste works; we read its value back on every input event.
  const dom = document.createElement('input');
  dom.maxLength = MAX;
  dom.value = value;
  dom.style.cssText = 'position:fixed;opacity:0;pointer-events:none;left:0;top:0;width:1px;height:1px;';
  document.body.appendChild(dom);
  setTimeout(() => { try { dom.focus(); } catch { /* ignore */ } }, 50);

  const valid = () => value.trim().length >= MIN;
  const refresh = () => {
    text.setText(value);
    caret.setPosition(text.x + text.width / 2 + 2, cy - 6);
    okBtn.setAlpha(valid() ? 1 : 0.4);
    errText.setText(value.length > 0 && !valid() ? `At least ${MIN} characters` : '');
  };
  refresh();

  // keyboard entry (desktop)
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Enter') { commit(); return; }
    if (ev.key === 'Backspace') { value = value.slice(0, -1); refresh(); ev.preventDefault(); return; }
    if (ev.key.length === 1 && value.length < MAX && ALLOWED.test(ev.key)) {
      value += ev.key; refresh();
    }
  };
  // sync from the hidden DOM input (mobile soft keyboard / paste)
  const onDomInput = () => {
    value = dom.value.replace(/[^A-Za-z0-9 _-]/g, '').slice(0, MAX);
    if (dom.value !== value) dom.value = value;
    refresh();
  };
  scene.input.keyboard?.on('keydown', onKey);
  dom.addEventListener('input', onDomInput);

  const close = () => {
    scene.input.keyboard?.off('keydown', onKey);
    dom.removeEventListener('input', onDomInput);
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
