import Phaser from 'phaser';

// A pooled horizontal mover — used for BOTH cars (deadly) and logs (rideable).
// Plain Image moved manually each frame; no physics body. Wraps around the play
// field. The owning row sets texture/speed/kind on spawn.
export type MoverKind = 'car' | 'log';

export class Mover extends Phaser.GameObjects.Image {
  kind: MoverKind = 'car';
  speed = 0; // px/s, signed (negative = leftward)
  halfW = 0; // half display width, for collision / ride tests
  rowIndex = -1; // which logical row this belongs to

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, '__MISSING');
    this.setActive(false).setVisible(false);
  }

  spawn(
    texture: string,
    x: number,
    y: number,
    speed: number,
    kind: MoverKind,
    rowIndex: number,
  ): void {
    this.setTexture(texture);
    this.kind = kind;
    this.speed = speed;
    this.rowIndex = rowIndex;
    this.setScale(0.5); // art baked at 2x
    this.setFlipX(speed < 0); // face travel direction
    this.halfW = this.displayWidth / 2;
    this.setPosition(x, y);
    this.setDepth(kind === 'log' ? 10 : 15);
    this.setActive(true).setVisible(true);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
    this.rowIndex = -1;
  }

  /** Advance horizontally; wrap across [minX, maxX]. */
  move(dt: number, minX: number, maxX: number): void {
    this.x += this.speed * dt;
    const span = maxX - minX;
    if (this.speed > 0 && this.x - this.halfW > maxX) this.x -= span + this.displayWidth;
    else if (this.speed < 0 && this.x + this.halfW < minX) this.x += span + this.displayWidth;
  }
}
