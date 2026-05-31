import Phaser from 'phaser';
import { SLOT_ICON_TEXTURE, type EquipSlot, type EquipTier } from '../types/equipment';

// Pooled equipment drop — mirrors XpGem. Shows the slot's icon; when the hero is
// within pickup radius it homes in, then is collected and equipped.
export class EquipDrop extends Phaser.GameObjects.Image {
  slot: EquipSlot = 'hat';
  tier: EquipTier = 1;
  private radius = 16;
  private homing = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, SLOT_ICON_TEXTURE.hat);
    this.setActive(false).setVisible(false);
  }

  drop(x: number, y: number, slot: EquipSlot, tier: EquipTier): void {
    this.slot = slot;
    this.tier = tier;
    this.homing = false;
    this.setTexture(SLOT_ICON_TEXTURE[slot]);
    this.setPosition(x, y);
    // Higher tiers read bigger + brighter.
    this.setActive(true).setVisible(true).setDepth(4).setScale(2 + tier * 0.3);
    this.setAlpha(1);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }

  /** Pull toward the hero when within pickup radius. Returns true if collected. */
  update(heroX: number, heroY: number, pickupRadius: number, dt: number): boolean {
    const dx = heroX - this.x;
    const dy = heroY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= this.radius) return true; // collected
    if (this.homing || dist <= pickupRadius) {
      this.homing = true;
      const len = dist || 1;
      const pull = 300 * dt;
      this.x += (dx / len) * pull;
      this.y += (dy / len) * pull;
    }
    return false;
  }
}
