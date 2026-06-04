import Phaser from 'phaser';
import { Fonts } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Api, type LeaderboardEntry } from './Api';
import { Storage } from './Storage';
import { MAPS } from '../types/map';

// A full-screen leaderboard overlay: difficulty tabs across the top, a fetched
// top-N list below (rank · nickname · best wave), with loading / empty / offline
// states and the local player's own row highlighted. Self-contained — call
// showLeaderboard(scene) and it cleans itself up on close.

export function showLeaderboard(scene: Phaser.Scene, onClose?: () => void): void {
  const cx = GAME_WIDTH / 2;
  const root = scene.add.container(0, 0).setDepth(130);
  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05060a, 0.94).setOrigin(0).setInteractive();
  const title = scene.add.text(cx, 34, '🏆 LEADERBOARD', {
    fontFamily: Fonts.Display, fontSize: '30px', color: '#ffd23f', stroke: '#1a1c2c', strokeThickness: 5,
  }).setOrigin(0.5);
  root.add([dim, title]);

  const close = () => { root.destroy(); onClose?.(); };
  // close button (top-right)
  const closeBtn = scene.add.text(GAME_WIDTH - 18, 30, '✕', {
    fontFamily: Fonts.Display, fontSize: '26px', color: '#ff6b6b',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerup', close);
  root.add(closeBtn);

  // ── difficulty tabs ──
  const tabY = 76;
  const tabW = (GAME_WIDTH - 40) / MAPS.length;
  const tabs: Phaser.GameObjects.Text[] = [];
  let activeMap = 0;

  // ── list area (rebuilt per tab/fetch) ──
  const listTop = 116;
  let listItems: Phaser.GameObjects.GameObject[] = [];
  const clearList = () => { for (const o of listItems) o.destroy(); listItems = []; };
  const addLine = (msg: string, color = '#a89ccb') => {
    const t = scene.add.text(cx, listTop + 30, msg, { fontFamily: 'monospace', fontSize: '13px', color, align: 'center' }).setOrigin(0.5);
    listItems.push(t); root.add(t);
  };

  const renderEntries = (entries: LeaderboardEntry[]) => {
    clearList();
    if (entries.length === 0) { addLine('No scores yet — be the first!'); return; }
    const me = Storage.getNickname();
    const rowH = 30, x0 = 24;
    // header row
    const head = scene.add.text(x0, listTop, '#   NAME', { fontFamily: 'monospace', fontSize: '11px', color: '#6a5a8a' }).setOrigin(0, 0.5);
    const headW = scene.add.text(GAME_WIDTH - 24, listTop, 'WAVE', { fontFamily: 'monospace', fontSize: '11px', color: '#6a5a8a' }).setOrigin(1, 0.5);
    listItems.push(head, headW); root.add([head, headW]);
    entries.slice(0, 20).forEach((e, i) => {
      const y = listTop + 24 + i * rowH;
      const mine = e.nickname === me;
      const rankCol = i === 0 ? '#ffd23f' : i === 1 ? '#cdd6e6' : i === 2 ? '#e0935b' : '#8a91b4';
      if (mine) {
        const hl = scene.add.rectangle(cx, y, GAME_WIDTH - 28, rowH - 4, 0x2a8a3a, 0.22).setStrokeStyle(1, 0x2a8a3a, 0.6);
        listItems.push(hl); root.add(hl);
      }
      const rank = scene.add.text(x0, y, `${i + 1}`.padStart(2, ' '), { fontFamily: 'monospace', fontSize: '14px', color: rankCol }).setOrigin(0, 0.5);
      const name = scene.add.text(x0 + 34, y, e.nickname + (mine ? '  (you)' : ''), { fontFamily: 'monospace', fontSize: '14px', color: mine ? '#a7f070' : '#e8dcff' }).setOrigin(0, 0.5);
      const wave = scene.add.text(GAME_WIDTH - 24, y, String(e.wave), { fontFamily: 'monospace', fontSize: '14px', color: '#73eff7' }).setOrigin(1, 0.5);
      listItems.push(rank, name, wave); root.add([rank, name, wave]);
    });
  };

  const load = async (mapId: number) => {
    clearList();
    if (!Api.enabled) { addLine('Leaderboard is offline.\n(no server configured)', '#ff9b6b'); return; }
    addLine('Loading…');
    const entries = await Api.getLeaderboard(mapId);
    if (activeMap !== mapId) return; // user switched tab while loading — drop stale result
    renderEntries(entries);
  };

  const selectTab = (i: number) => {
    activeMap = i;
    tabs.forEach((t, j) => t.setColor(j === i ? '#ffd23f' : '#8a91b4').setBackgroundColor(j === i ? '#2a2038' : 'transparent'));
    void load(i);
  };

  MAPS.forEach((m, i) => {
    const tx = 20 + tabW * i + tabW / 2;
    const tab = scene.add.text(tx, tabY, m.difficulty, {
      fontFamily: 'monospace', fontSize: '13px', color: '#8a91b4', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    tab.on('pointerup', () => selectTab(i));
    tabs.push(tab); root.add(tab);
  });

  selectTab(0); // open on the first map
}
