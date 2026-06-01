import Phaser from 'phaser';
import { TOWERS, type TowerDef, type TowerId } from '../types/roster';
import type { Enemy } from './Enemy';

// A placed tower: a static base + a turret Image that rotates to aim. Upgrades
// step through the def's tiers. Targeting + firing cadence live here; the scene
// spawns the actual bullet so it can pool + resolve hits.
export class Tower {
  readonly id: TowerId;
  readonly def: TowerDef;
  readonly col: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
  tier = 0; // 0..2
  private base: Phaser.GameObjects.Image;
  private turret: Phaser.GameObjects.Image;
  private nextFireAt = 0;

  constructor(scene: Phaser.Scene, id: TowerId, col: number, row: number, x: number, y: number) {
    this.id = id;
    this.def = TOWERS[id];
    this.col = col;
    this.row = row;
    this.x = x;
    this.y = y;
    this.base = scene.add.image(x, y, this.def.baseTex).setDepth(5);
    this.turret = scene.add.image(x, y, this.def.turretTex).setDepth(6);
  }

  get stats() {
    return this.def.tiers[this.tier];
  }

  get canUpgrade(): boolean {
    return this.tier < this.def.tiers.length - 1;
  }

  get nextUpgradeCost(): number {
    return this.canUpgrade ? this.def.tiers[this.tier + 1].upgradeCost : 0;
  }

  upgrade(): void {
    if (this.canUpgrade) {
      this.tier += 1;
      // a small pop so the upgrade reads
      this.turret.scene.tweens.add({ targets: [this.base, this.turret], scale: 1.18, duration: 90, yoyo: true });
    }
  }

  /**
   * Aim at the nearest in-range enemy and fire when ready. Returns a fire request
   * (the scene turns it into a pooled bullet) or null.
   */
  update(time: number, enemies: Enemy[]): { angle: number } | null {
    const target = this.nearestInRange(enemies);
    if (!target) return null;
    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    this.turret.setRotation(angle + Math.PI / 2);
    if (time < this.nextFireAt) return null;
    this.nextFireAt = time + this.stats.fireInterval;
    return { angle };
  }

  private nearestInRange(enemies: Enemy[]): Enemy | null {
    const r = this.stats.range;
    const r2 = r * r;
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
      if (d <= r2 && d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  setSelected(on: boolean): void {
    this.base.setTint(on ? 0xffe066 : 0xffffff);
  }

  destroy(): void {
    this.base.destroy();
    this.turret.destroy();
  }
}
