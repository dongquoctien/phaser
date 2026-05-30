import Phaser from 'phaser';
import { TextureKeys } from '../types/keys';
import { Tuning, GAME_HEIGHT } from '../config';

// A single pipe (top OR bottom half). Pipes are spawned continuously as the
// world scrolls, so they are pooled rather than created/destroyed each time.
// The base Pipe texture is 52x64 and is stretched to the needed height.
export class Pipe extends Phaser.Physics.Arcade.Sprite {
  // Marks the bottom pipe of a pair as the one that awards a point when passed.
  scoring = false;
  scored = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKeys.Pipe);
    scene.physics.add.existing(this);
    this.despawn();
  }

  /**
   * Position this pipe as the top or bottom of a gap centered at `gapY`.
   */
  spawnAt(x: number, gapY: number, isTop: boolean): void {
    const halfGap = Tuning.pipeGap / 2;
    const groundY = GAME_HEIGHT - Tuning.groundHeight;

    let height: number;
    let y: number;
    if (isTop) {
      height = Math.max(8, gapY - halfGap);
      y = 0;
      this.setOrigin(0, 0);
    } else {
      const bottomY = gapY + halfGap;
      height = Math.max(8, groundY - bottomY);
      y = bottomY;
      this.setOrigin(0, 0);
    }

    this.enableBody(true, x, y, true, true);
    this.setDisplaySize(this.width, height);
    // The Arcade body size is given in UNSCALED texture pixels — Arcade multiplies
    // it by the sprite's scale. setDisplaySize() scaled us by height/frameHeight,
    // so passing the full frame size makes the body exactly cover the visible
    // pipe (not the stretched value, which would balloon the body across the gap
    // and kill the bird in the open space).
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.frame.realWidth, this.frame.realHeight, true);
    body.allowGravity = false;
    this.setVelocityX(Tuning.pipeSpeed);
    this.setImmovable(true);

    this.scoring = !isTop;
    this.scored = false;
  }

  despawn(): void {
    this.scoring = false;
    this.scored = false;
    this.disableBody(true, true);
  }

  // Recycle once fully off the left edge.
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.active && this.x + this.displayWidth < 0) {
      this.despawn();
    }
  }
}
