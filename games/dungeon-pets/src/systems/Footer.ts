import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../tuning';
import { SKILL_POOL } from '../types/skills';

// "Learned Skill" grid (like the reference). One chip per learned skill, showing
// its glyph + stack count, laid out in a grid at the bottom. Update-on-change
// only (refresh() after a pick) — zero per-frame work.
const COLS = 5;
const CELL = 50;
const PAD = 6;

export class Footer {
  private chips = new Map<string, { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; count: Phaser.GameObjects.Text }>();
  private gridX: number;
  private gridY: number;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const gridW = COLS * CELL + (COLS - 1) * PAD;
    this.gridX = (GAME_WIDTH - gridW) / 2;
    this.gridY = GAME_HEIGHT - 132;

    scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 78, GAME_WIDTH - 20, 132, 0x2a2038, 0.96)
      .setStrokeStyle(2, 0x4a3a6a)
      .setDepth(55);
    scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 138, 'LEARNED SKILL', {
        fontFamily: 'monospace', fontSize: '12px', color: '#cdbce6', fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(56);
  }

  /** Rebuild the grid from the taken counts (skills in pool order, nonzero only). */
  refresh(taken: Record<string, number>): void {
    const learned = SKILL_POOL.filter((s) => (taken[s.id] ?? 0) > 0);
    learned.forEach((sk, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = this.gridX + col * (CELL + PAD) + CELL / 2;
      const cy = this.gridY + row * (CELL + PAD) + CELL / 2;
      let chip = this.chips.get(sk.id);
      if (!chip) {
        const box = this.scene.add.rectangle(cx, cy, CELL, CELL, sk.tone, 0.9).setStrokeStyle(2, 0x1a1020).setDepth(56);
        const label = this.scene.add.text(cx, cy - 4, sk.icon, {
          fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', fontStyle: 'bold', align: 'center',
        }).setOrigin(0.5).setDepth(57);
        const count = this.scene.add.text(cx + CELL / 2 - 3, cy + CELL / 2 - 3, '', {
          fontFamily: 'monospace', fontSize: '11px', color: '#ffe066', fontStyle: 'bold',
        }).setOrigin(1, 1).setDepth(58);
        chip = { box, label, count };
        this.chips.set(sk.id, chip);
      } else {
        chip.box.setPosition(cx, cy);
        chip.label.setPosition(cx, cy - 4);
        chip.count.setPosition(cx + CELL / 2 - 3, cy + CELL / 2 - 3);
      }
      const n = taken[sk.id] ?? 0;
      chip.count.setText(n > 1 ? `x${n}` : '');
    });
  }
}
