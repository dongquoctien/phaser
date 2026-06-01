import Phaser from 'phaser';
import { SceneKeys, AudioKeys, mapBestKey, mapClearedKey } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { MAPS } from '../types/map';

// Map-select screen: one card per map showing name, difficulty, best wave, and a
// tiny preview of its road. Maps unlock progressively — map N is playable only
// once map N-1 has been cleared (persisted in the registry). Map 0 is always open.
export class MapSelectScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.MapSelect);
  }

  private isUnlocked(index: number): boolean {
    if (index === 0) return true;
    return (this.registry.get(mapClearedKey(index - 1)) as boolean) ?? false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1c2c');

    this.add.text(GAME_WIDTH / 2, 36, 'SELECT MAP', {
      fontFamily: 'monospace', fontSize: '26px', color: '#ffffff', stroke: '#1a1c2c', strokeThickness: 6,
    }).setOrigin(0.5);

    const cardW = GAME_WIDTH - 60;
    const cardH = 190;
    const gap = 24;
    const y0 = 110;
    const diffColor: Record<string, string> = { Easy: '#a7f070', Normal: '#ffd23f', Hard: '#ff6b6b' };

    MAPS.forEach((map, i) => {
      const cx = GAME_WIDTH / 2;
      const cy = y0 + i * (cardH + gap) + cardH / 2;
      const unlocked = this.isUnlocked(i);
      const best = (this.registry.get(mapBestKey(i)) as number) ?? 0;
      const cleared = (this.registry.get(mapClearedKey(i)) as boolean) ?? false;

      const card = this.add.rectangle(cx, cy, cardW, cardH, unlocked ? 0x241c34 : 0x18141f, 1)
        .setStrokeStyle(3, unlocked ? Phaser.Display.Color.HexStringToColor(diffColor[map.difficulty]).color : 0x3a3550);

      // mini path preview (top-left of the card)
      this.drawMiniMap(map.path, cx - cardW / 2 + 16, cy - cardH / 2 + 16, 120, cardH - 32, unlocked);

      // text block (right side)
      const tx = cx - cardW / 2 + 150;
      this.add.text(tx, cy - 64, map.name, {
        fontFamily: 'monospace', fontSize: '20px', color: unlocked ? '#ffffff' : '#6a6480',
      });
      this.add.text(tx, cy - 36, map.difficulty, {
        fontFamily: 'monospace', fontSize: '14px', color: unlocked ? diffColor[map.difficulty] : '#6a6480',
      });
      this.add.text(tx, cy - 12, unlocked ? `Best: Wave ${best}/20` : 'Locked', {
        fontFamily: 'monospace', fontSize: '12px', color: '#8a91b4',
      });
      if (cleared) this.add.text(tx, cy + 10, '✓ CLEARED', { fontFamily: 'monospace', fontSize: '12px', color: '#a7f070' });

      if (unlocked) {
        const play = this.add.text(cx + cardW / 2 - 18, cy + cardH / 2 - 20, 'PLAY ▶', {
          fontFamily: 'monospace', fontSize: '15px', color: '#1a1c2c', backgroundColor: '#a7f070', padding: { x: 12, y: 6 },
        }).setOrigin(1, 1);
        const hit = this.add.zone(cx, cy, cardW, cardH).setInteractive({ useHandCursor: true });
        hit.name = `map:${i}`;
        hit.on('pointerup', () => {
          if (this.cache.audio.exists(AudioKeys.Click)) this.sound.play(AudioKeys.Click, { volume: 0.4 });
          this.scene.start(SceneKeys.Game, { mapIndex: i });
        });
        void play;
      } else {
        this.add.text(cx, cy + cardH / 2 - 22, '🔒 Clear the previous map', {
          fontFamily: 'monospace', fontSize: '11px', color: '#8a7aa6',
        }).setOrigin(0.5);
      }
      void card;
    });

    // back to menu
    const back = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 24, '‹ BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#8a91b4',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start(SceneKeys.Menu));
  }

  // Render a map's road as a tiny line-strip preview inside a box.
  private drawMiniMap(path: ReadonlyArray<readonly [number, number]>, x: number, y: number, w: number, h: number, unlocked: boolean): void {
    const cols = 12, rows = 16;
    const sx = w / cols, sy = h / rows;
    const g = this.add.graphics();
    g.fillStyle(unlocked ? 0x2a7a3a : 0x202028, 1).fillRect(x, y, w, h);
    g.lineStyle(Math.max(2, sx * 0.6), unlocked ? 0xa98c5a : 0x3a3550, 1);
    g.beginPath();
    path.forEach(([c, r], i) => {
      const px = x + (c + 0.5) * sx;
      const py = y + (Phaser.Math.Clamp(r, 0, rows - 1) + 0.5) * sy;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    });
    g.strokePath();
  }
}
