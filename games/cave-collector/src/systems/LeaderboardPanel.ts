import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Api, type LeaderboardEntry } from './Api';
import { Storage } from './Storage';

// Full-screen leaderboard overlay: a fetched top-N list (rank · name · stars ·
// score) with loading / empty / offline states and the local player's row
// highlighted. Self-contained — call showLeaderboard(scene) and it cleans up on
// close.
export function showLeaderboard(scene: Phaser.Scene, onClose?: () => void): void {
  const cx = GAME_WIDTH / 2;
  const root = scene.add.container(0, 0).setDepth(230);
  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05090b, 0.95).setOrigin(0).setInteractive();

  const title = scene.add.text(cx, 22, 'LEADERBOARD', {
    fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold', color: '#ffe14d', stroke: '#05140c', strokeThickness: 4,
  }).setOrigin(0.5);
  root.add([dim, title]);

  const close = () => { root.destroy(); onClose?.(); };
  const closeBtn = scene.add.text(GAME_WIDTH - 14, 18, '✕', {
    fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#ff7db0',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerup', close);
  // tapping the dim backdrop closes too
  dim.on('pointerup', close);
  root.add(closeBtn);

  const listTop = 50;
  let listItems: Phaser.GameObjects.GameObject[] = [];
  const clearList = () => { for (const o of listItems) o.destroy(); listItems = []; };
  const addLine = (msg: string, color = '#9fe3ff') => {
    const t = scene.add.text(cx, listTop + 60, msg, { fontFamily: 'monospace', fontSize: '11px', color, align: 'center' }).setOrigin(0.5);
    listItems.push(t); root.add(t);
  };

  const renderEntries = (entries: LeaderboardEntry[]) => {
    clearList();
    if (entries.length === 0) { addLine('No scores yet — be the first!'); return; }
    const me = Storage.getNickname();
    const rowH = 17, x0 = 18;
    const scoreX = GAME_WIDTH - 16, starX = GAME_WIDTH - 70;

    const head = scene.add.text(x0, listTop, '#  NAME', { fontFamily: 'monospace', fontSize: '9px', color: '#3f6b5a' }).setOrigin(0, 0.5);
    const headS = scene.add.text(starX, listTop, '★', { fontFamily: 'monospace', fontSize: '9px', color: '#3f6b5a' }).setOrigin(1, 0.5);
    const headSc = scene.add.text(scoreX, listTop, 'SCORE', { fontFamily: 'monospace', fontSize: '9px', color: '#3f6b5a' }).setOrigin(1, 0.5);
    listItems.push(head, headS, headSc); root.add([head, headS, headSc]);

    entries.slice(0, 10).forEach((e, i) => {
      const y = listTop + 18 + i * rowH;
      const mine = e.nickname === me;
      const rankCol = i === 0 ? '#ffe14d' : i === 1 ? '#cdd6e6' : i === 2 ? '#e0935b' : '#7aa091';
      if (mine) {
        const hl = scene.add.rectangle(cx, y, GAME_WIDTH - 20, rowH - 2, 0x2f8f5a, 0.22).setStrokeStyle(1, 0x2f8f5a, 0.6);
        listItems.push(hl); root.add(hl);
      }
      const rank = scene.add.text(x0, y, `${i + 1}`.padStart(2, ' '), { fontFamily: 'monospace', fontSize: '11px', color: rankCol }).setOrigin(0, 0.5);
      let label = e.nickname + (mine ? ' (you)' : '');
      if (label.length > (mine ? 17 : 13)) label = e.nickname.slice(0, 11) + (mine ? ' (you)' : '…');
      const name = scene.add.text(x0 + 22, y, label, { fontFamily: 'monospace', fontSize: '11px', color: mine ? '#a7f070' : '#e8f6ee' }).setOrigin(0, 0.5);
      const stars = scene.add.text(starX, y, String(e.stars ?? 0), { fontFamily: 'monospace', fontSize: '11px', color: '#ffd23f' }).setOrigin(1, 0.5);
      const score = scene.add.text(scoreX, y, String(e.score), { fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: '#73eff7' }).setOrigin(1, 0.5);
      listItems.push(rank, name, stars, score); root.add([rank, name, stars, score]);
    });
  };

  const load = async () => {
    clearList();
    if (!Api.enabled) { addLine('Leaderboard is offline.\n(no server configured)', '#ffa657'); return; }
    addLine('Loading…');
    const entries = await Api.getLeaderboard();
    if (!root.active) return; // closed while loading
    renderEntries(entries);
  };

  void load();
}
