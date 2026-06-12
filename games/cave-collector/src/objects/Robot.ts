import Phaser from 'phaser';
import { Tex, Anim } from '../types/keys';

// A patrolling sentry-bot (Goomba-style): walks left/right along its platform,
// turning around when it hits a wall OR is about to walk off the platform edge.
// Gravity-bound so it rides the ground. Edge detection probes a point just ahead
// of and below the front foot against the platforms group — so it never needs a
// hand-tuned range and never strolls off into a pit.
const SPEED = 34;

export class Robot extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  private dir = -1; // start walking left
  private platforms?: Phaser.Physics.Arcade.StaticGroup;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, Tex.Robot, 0);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  spawn(x: number, y: number, platforms: Phaser.Physics.Arcade.StaticGroup): void {
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.setScale(0.6).setOrigin(0.5, 1);
    this.body.setAllowGravity(true);
    this.body.setSize(24, 28).setOffset(4, 3);
    this.setPosition(x, y);
    this.platforms = platforms;
    this.dir = -1;
    this.setVelocityX(SPEED * this.dir);
    this.setFlipX(this.dir < 0);
    this.play(Anim.RobotIdle, true);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active || !this.body) return;

    const onGround = this.body.blocked.down || this.body.touching.down;
    // Hit a wall → turn.
    if (this.body.blocked.left) this.dir = 1;
    else if (this.body.blocked.right) this.dir = -1;
    // About to walk off the front edge → turn. Probe just past the leading foot,
    // a few px below the bottom; if nothing solid is there, flip.
    else if (onGround && !this.groundAhead()) this.dir = -this.dir;

    this.setVelocityX(SPEED * this.dir);
    this.setFlipX(this.dir < 0);
  }

  /** Is there a platform tile under the point just ahead of the front foot? */
  private groundAhead(): boolean {
    if (!this.platforms) return true;
    const half = this.body.halfWidth + 2;
    const px = this.x + this.dir * (half + 2);
    const py = this.body.bottom + 4;
    let found = false;
    for (const tile of this.platforms.getChildren()) {
      const b = (tile as Phaser.Physics.Arcade.Image).getBounds();
      if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) { found = true; break; }
    }
    return found;
  }
}
