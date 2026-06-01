import Phaser from 'phaser';

// Pooled projectile. Flies straight toward where it was aimed; the scene resolves
// the hit (damage + optional splash) when it reaches the target point.
export class Bullet extends Phaser.GameObjects.Image {
  vx = 0;
  vy = 0;
  damage = 0;
  splash = 0;
  private life = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'bullet');
    this.setActive(false).setVisible(false);
  }

  fire(tex: string, x: number, y: number, angle: number, speed: number, damage: number, splash: number): void {
    this.setTexture(tex);
    this.setPosition(x, y).setRotation(angle + Math.PI / 2);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.splash = splash;
    this.life = 0;
    this.setScale(splash > 0 ? 0.7 : 0.5).setDepth(12);
    this.setActive(true).setVisible(true);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }

  /** Integrate; returns true if it should despawn (off-field / expired). */
  step(dt: number, w: number, h: number): boolean {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life += dt;
    return this.life > 2 || this.x < -20 || this.x > w + 20 || this.y < -20 || this.y > h + 20;
  }
}
