import Phaser from 'phaser';
import { Loot, type LootKind } from '../objects/Loot';
import { GAME_WIDTH, GAME_HEIGHT, Tuning } from '../config';

// Owns the pool of loot and the cavern layout. Loot is pooled (never created in
// the hot path) and laid out randomly below the play line at round start.
export class LootField {
  readonly group: Phaser.GameObjects.Group;

  constructor(scene: Phaser.Scene) {
    this.group = scene.add.group({ classType: Loot, maxSize: 24 });
    for (let i = 0; i < 24; i++) {
      const loot = new Loot(scene);
      scene.add.existing(loot);
      this.group.add(loot);
      loot.despawn();
    }
  }

  /** Lay out a fresh field of loot for a round. */
  populate(): void {
    this.group.getChildren().forEach((c) => (c as Loot).despawn());

    const topY = Tuning.hookOriginY + 120; // leave space under the miner
    const bottomY = GAME_HEIGHT - 40;
    const plan: LootKind[] = [
      'gold-s', 'gold-s', 'gold-s', 'gold-s', 'gold-s',
      'gold-l', 'gold-l', 'gold-l',
      'rock', 'rock', 'rock', 'rock',
    ];

    for (const kind of plan) {
      const loot = this.group.getFirstDead(false) as Loot | null;
      if (!loot) break;
      const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
      const y = Phaser.Math.Between(topY, bottomY);
      loot.place(kind, x, y);
    }
  }

  /** The first active loot whose grab circle contains (x, y), or null. */
  grabAt(x: number, y: number): Loot | null {
    const items = this.group.getChildren();
    for (const c of items) {
      const loot = c as Loot;
      if (!loot.active || loot.grabbed) continue;
      if (Phaser.Math.Distance.Between(x, y, loot.x, loot.y) <= loot.radius) {
        return loot;
      }
    }
    return null;
  }
}
