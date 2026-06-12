import Phaser from 'phaser';
import { Tex, Anim } from '../types/keys';

// A spiked BEETLE: patrols its platform like the Robot, but its back is covered in
// spikes — landing on it HURTS instead of stomping. GameScene checks `stompable`
// (false here) so a jump-on always damages the hero; you must avoid or out-run it.
const SPEED = 30;

export class Beetle extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  public readonly stompable = false; // spikes on top — can't be jumped on
  private dir = -1;
  private platforms?: Phaser.Physics.Arcade.StaticGroup;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, Tex.Beetle, 0);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  spawn(x: number, y: number, platforms: Phaser.Physics.Arcade.StaticGroup): void {
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.setScale(0.6).setOrigin(0.5, 1);
    this.body.setAllowGravity(true);
    this.body.setSize(28, 22).setOffset(2, 8);
    this.setPosition(x, y);
    this.platforms = platforms;
    this.dir = -1;
    this.setVelocityX(SPEED * this.dir);
    this.setFlipX(this.dir > 0); // sheet faces left
    this.play(Anim.BeetleWalk, true);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active || !this.body) return;
    const onGround = this.body.blocked.down || this.body.touching.down;
    if (this.body.blocked.left) this.dir = 1;
    else if (this.body.blocked.right) this.dir = -1;
    else if (onGround && !this.groundAhead()) this.dir = -this.dir;
    this.setVelocityX(SPEED * this.dir);
    this.setFlipX(this.dir > 0);
  }

  private groundAhead(): boolean {
    if (!this.platforms) return true;
    const px = this.x + this.dir * (this.body.halfWidth + 4);
    const py = this.body.bottom + 4;
    for (const tile of this.platforms.getChildren()) {
      const b = (tile as Phaser.Physics.Arcade.Image).getBounds();
      if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) return true;
    }
    return false;
  }
}
