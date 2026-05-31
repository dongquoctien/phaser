import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { SKILL_POOL } from '../types/skills';
import {
  EQUIP_SLOTS,
  SLOT_ICON_TEXTURE,
  type EquipSlot,
} from '../types/equipment';
import type { Equipment } from './Equipment';

const STRIP_H = 30;
const DEPTH = 60;

// Bottom HUD strip: chosen skills (icon × count) on the left, the 4 equip slots
// on the right. Pre-created once; updated only on change (no per-frame work).
// NON-interactive so pointer events fall through to the drag-anywhere joystick.
export class Footer {
  private y = GAME_HEIGHT - STRIP_H;
  // Per-skill chip: icon + "xN" count text, hidden until taken.
  private skillIcons: Record<string, Phaser.GameObjects.Image> = {};
  private skillCounts: Record<string, Phaser.GameObjects.Text> = {};
  // Per-equip slot: a frame, an icon (hidden until equipped), a tier pip text.
  private equipIcons: Record<EquipSlot, Phaser.GameObjects.Image> = {} as Record<
    EquipSlot,
    Phaser.GameObjects.Image
  >;
  private equipTiers: Record<EquipSlot, Phaser.GameObjects.Text> = {} as Record<
    EquipSlot,
    Phaser.GameObjects.Text
  >;

  constructor(scene: Phaser.Scene) {
    const cy = this.y + STRIP_H / 2;

    // Background strip.
    scene.add
      .rectangle(0, this.y, GAME_WIDTH, STRIP_H, 0x10131f, 0.92)
      .setOrigin(0, 0)
      .setDepth(DEPTH);
    scene.add
      .line(0, this.y, 0, 0, GAME_WIDTH, 0, 0x2a2f45, 1)
      .setOrigin(0, 0)
      .setDepth(DEPTH);

    // ── Right zone: 4 equip slots (gun, hat, shirt, shoes), right-aligned. ──
    const slotSize = 24;
    const slotGap = 4;
    const rightPad = 8;
    const slotsW = EQUIP_SLOTS.length * slotSize + (EQUIP_SLOTS.length - 1) * slotGap;
    const slotsX0 = GAME_WIDTH - rightPad - slotsW;
    EQUIP_SLOTS.forEach((slot, i) => {
      const x = slotsX0 + i * (slotSize + slotGap) + slotSize / 2;
      scene.add
        .rectangle(x, cy, slotSize, slotSize, 0x0a0c16)
        .setStrokeStyle(1, 0x39405e)
        .setDepth(DEPTH + 1);
      const icon = scene.add
        .image(x, cy, SLOT_ICON_TEXTURE[slot])
        .setDepth(DEPTH + 2)
        .setVisible(false);
      const tier = scene.add
        .text(x + slotSize / 2 - 2, cy + slotSize / 2 - 2, '', {
          fontFamily: 'monospace', fontSize: '9px', color: '#ffcd75',
        })
        .setOrigin(1, 1)
        .setDepth(DEPTH + 3);
      this.equipIcons[slot] = icon;
      this.equipTiers[slot] = tier;
    });

    // ── Left zone: one chip per skill (icon + xN), laid out in stable order. ──
    // Pre-create all 8 (hidden); show + position the taken ones on refresh.
    const chipX0 = 8;
    SKILL_POOL.forEach((sk) => {
      const icon = scene.add
        .image(chipX0, cy, sk.icon)
        .setDepth(DEPTH + 2)
        .setScale(0.85)
        .setVisible(false);
      const cnt = scene.add
        .text(chipX0, cy, '', {
          fontFamily: 'monospace', fontSize: '10px', color: '#e8ecff',
        })
        .setOrigin(0, 0.5)
        .setDepth(DEPTH + 2)
        .setVisible(false);
      this.skillIcons[sk.id] = icon;
      this.skillCounts[sk.id] = cnt;
    });
  }

  /** Re-lay out the skill chips from the taken counts (nonzero only). */
  refreshSkills(taken: Record<string, number>): void {
    const cy = this.y + STRIP_H / 2;
    let x = 8;
    // Iterate SKILL_POOL for a stable order.
    for (const sk of SKILL_POOL) {
      const n = taken[sk.id] ?? 0;
      const icon = this.skillIcons[sk.id];
      const cnt = this.skillCounts[sk.id];
      if (n <= 0) {
        icon.setVisible(false);
        cnt.setVisible(false);
        continue;
      }
      icon.setPosition(x + 9, cy).setVisible(true);
      cnt.setPosition(x + 19, cy).setText(`x${n}`).setVisible(true);
      x += 38; // icon(18) + count(~18) + gap
    }
  }

  /** Reflect the currently equipped gear in the right-zone slots. */
  refreshEquip(equip: Equipment): void {
    for (const slot of EQUIP_SLOTS) {
      const tier = equip.slots[slot];
      const icon = this.equipIcons[slot];
      const txt = this.equipTiers[slot];
      if (tier > 0) {
        icon.setVisible(true);
        txt.setText(String(tier));
      } else {
        icon.setVisible(false);
        txt.setText('');
      }
    }
  }
}
