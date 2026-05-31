import Phaser from 'phaser';
import { TextureKeys } from '../types/keys';
import { CELL } from '../tuning';

export type HopDir = 'up' | 'down' | 'left' | 'right';

// The player frog. Lives on the grid (col, row) and tweens between cells. Has an
// Arcade body only so it can ride logs by being repositioned each frame (no
// physics collisions — those are resolved manually against rows).
export class Frog extends Phaser.Physics.Arcade.Sprite {
  col: number;
  row: number; // logical row index (0 at the start line, increases upward)
  hopping = false;

  private rotForDir: Record<HopDir, number> = {
    up: 0,
    right: Math.PI / 2,
    down: Math.PI,
    left: -Math.PI / 2,
  };

  constructor(scene: Phaser.Scene, col: number, row: number) {
    super(scene, 0, 0, TextureKeys.Frog);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.col = col;
    this.row = row;
    this.setOrigin(0.5);
    this.setScale(0.5); // art baked at 2x supersample
    this.setDepth(20);
  }

  /** Snap to a world position for (col, row) given the world-y of that row. */
  placeAt(worldX: number, worldY: number): void {
    this.setPosition(worldX, worldY);
  }

  /**
   * Animate a hop to a new world position. Returns the tween so the caller can
   * chain. Swaps to the legs-out frame mid-hop, rotates to face the direction.
   */
  hopTo(
    worldX: number,
    worldY: number,
    dir: HopDir,
    durationMs: number,
    onDone: () => void,
  ): void {
    this.hopping = true;
    this.setRotation(this.rotForDir[dir]);
    this.setTexture(TextureKeys.FrogHop);
    this.scene.tweens.add({
      targets: this,
      x: worldX,
      y: worldY,
      duration: durationMs,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.hopping = false;
        this.setTexture(TextureKeys.Frog);
        onDone();
      },
    });
    // A tiny scale pop for juice.
    this.scene.tweens.add({
      targets: this,
      scale: 0.6,
      duration: durationMs / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  get half(): number {
    return CELL / 2;
  }
}
