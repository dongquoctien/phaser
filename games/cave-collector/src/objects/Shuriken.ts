import Phaser from 'phaser';
import { Tex, Anim } from '../types/keys';

// A spinning shuriken hazard. Sweeps horizontally between [minX, maxX] at a set
// speed, reversing at the bounds. Pooled via a Phaser Group in GameScene.
export class Shuriken extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  private minX = 0;
  private maxX = 0;
  private speed = 80;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, Tex.Shuriken, 0);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.body.setCircle(6); // tight round hitbox
    this.setActive(false).setVisible(false);
  }

  launch(x: number, y: number, range: number, speed: number): void {
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    // Re-assert no-gravity AFTER enabling the body — spawning through a physics
    // group re-creates/re-enables the body and drops the constructor's setting,
    // so without this the shuriken falls below the screen (never seen).
    this.body.setAllowGravity(false);
    this.body.setVelocity(0, 0);
    this.setPosition(x, y);
    this.minX = x - range;
    this.maxX = x + range;
    this.speed = speed;
    this.setVelocityX(speed);
    this.play(Anim.ShurikenSpin, true);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    if (this.x <= this.minX && this.body.velocity.x < 0) this.setVelocityX(this.speed);
    else if (this.x >= this.maxX && this.body.velocity.x > 0) this.setVelocityX(-this.speed);
  }
}
