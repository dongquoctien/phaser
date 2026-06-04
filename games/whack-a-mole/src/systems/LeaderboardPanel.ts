import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Api, type LeaderboardEntry } from './Api';
import { Storage } from './Storage';

// A full-screen leaderboard overlay: a fetched top-N list (rank · nickname · score)
// with loading / empty / offline states and the local player's own row highlighted.
// Self-contained — call showLeaderboard(scene, onClose?) and it cleans itself up on
// close. Whack-a-Char has a single mode, so there are no difficulty tabs.

export function showLeaderboard(scene: Phaser.Scene, onClose?: () => void): void {
  const cx = GAME_WIDTH / 2;
  const root = scene.add.container(0, 0).setDepth(1300);
  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05140a, 0.95).setOrigin(0).setInteractive();
  const title = scene.add.text(cx, 44, 'LEADERBOARD', {
    fontFamily: 'monospace', fontSize: '30px', color: '#ffe14d', fontStyle: 'bold', stroke: '#1a2e12', strokeThickness: 5,
  }).setOrigin(0.5);
  root.add([dim, title]);

  const close = () => { root.destroy(); onClose?.(); };
  // close button (top-right) — added last so it's always tappable
  const closeBtn = scene.add.text(GAME_WIDTH - 22, 40, 'X', {
    fontFamily: 'monospace', fontSize: '24px', color: '#ff6b6b', fontStyle: 'bold',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerup', close);

  // ── list area ──
  const listTop = 100;
  let listItems: Phaser.GameObjects.GameObject[] = [];
  const clearList = () => { for (const o of listItems) o.destroy(); listItems = []; };
  const addLine = (msg: string, color = '#b6d99a') => {
    const t = scene.add.text(cx, listTop + 40, msg, { fontFamily: 'monospace', fontSize: '13px', color, align: 'center' }).setOrigin(0.5);
    listItems.push(t); root.add(t);
  };

  const renderEntries = (entries: LeaderboardEntry[]) => {
    clearList();
    if (entries.length === 0) { addLine('No scores yet — be the first!'); return; }
    const me = Storage.getNickname();
    const rowH = 30, x0 = 28;
    // header row
    const head = scene.add.text(x0, listTop, '#   NAME', { fontFamily: 'monospace', fontSize: '11px', color: '#6f8a52' }).setOrigin(0, 0.5);
    const headS = scene.add.text(GAME_WIDTH - 28, listTop, 'SCORE', { fontFamily: 'monospace', fontSize: '11px', color: '#6f8a52' }).setOrigin(1, 0.5);
    listItems.push(head, headS); root.add([head, headS]);
    entries.slice(0, 20).forEach((e, i) => {
      const y = listTop + 26 + i * rowH;
      const mine = e.nickname === me;
      const rankCol = i === 0 ? '#ffd23f' : i === 1 ? '#cdd6e6' : i === 2 ? '#e0935b' : '#8aa56a';
      if (mine) {
        const hl = scene.add.rectangle(cx, y, GAME_WIDTH - 32, rowH - 4, 0x2a8a3a, 0.22).setStrokeStyle(1, 0x2a8a3a, 0.6);
        listItems.push(hl); root.add(hl);
      }
      const rank = scene.add.text(x0, y, `${i + 1}`.padStart(2, ' '), { fontFamily: 'monospace', fontSize: '14px', color: rankCol }).setOrigin(0, 0.5);
      const name = scene.add.text(x0 + 34, y, e.nickname + (mine ? '  (you)' : ''), { fontFamily: 'monospace', fontSize: '14px', color: mine ? '#a7f070' : '#eaf6dc' }).setOrigin(0, 0.5);
      const score = scene.add.text(GAME_WIDTH - 28, y, String(e.score), { fontFamily: 'monospace', fontSize: '14px', color: '#ffe14d' }).setOrigin(1, 0.5);
      listItems.push(rank, name, score); root.add([rank, name, score]);
    });
  };

  const load = async () => {
    clearList();
    if (!Api.enabled) { addLine('Leaderboard is offline.\n(no server configured)', '#ffb46b'); return; }
    addLine('Loading…');
    const entries = await Api.getLeaderboard();
    if (!root.active) return; // closed while loading
    renderEntries(entries);
  };

  root.add(closeBtn); // keep the close button on top of the list
  void load();
}
