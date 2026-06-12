import Phaser from 'phaser';
import { Tex, Anim } from '../types/keys';

// A flying BAT hazard: sweeps left/right between [minX, maxX] like the shuriken,
// but bobs up and down on a sine wave so it's a moving aerial threat (and a
// different feel from the spinning shuriken). No gravity. Pooled via a group.
export class Bat extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  private minX = 0;
  private maxX = 0;
  private speed = 50;
  private baseY = 0;
  private amp = 12; // vertical bob amplitude (px)
  private phase = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, Tex.Bat, 0);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.setActive(false).setVisible(false);
  }

  launch(x: number, y: number, range: number, speed: number, phase = 0): void {
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setAllowGravity(false);
    this.body.setSize(22, 16).setOffset(5, 6);
    this.setScale(0.6);
    this.setPosition(x, y);
    this.minX = x - range;
    this.maxX = x + range;
    this.speed = speed;
    this.baseY = y;
    this.phase = phase;
    this.setVelocityX(speed);
    this.setFlipX(true); // sheet faces left → moving right shows flipped
    this.play(Anim.BatFlap, true);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    // horizontal sweep with edge reversal
    if (this.x <= this.minX && this.body.velocity.x < 0) { this.setVelocityX(this.speed); this.setFlipX(true); }
    else if (this.x >= this.maxX && this.body.velocity.x > 0) { this.setVelocityX(-this.speed); this.setFlipX(false); }
    // vertical sine bob (drive Y directly; gravity is off)
    this.phase += delta / 1000;
    this.y = this.baseY + Math.sin(this.phase * 3) * this.amp;
  }
}
