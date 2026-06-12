import Phaser from 'phaser';
import { Tex, Anim } from '../types/keys';

// The player. Responsive platformer feel: coyote-time (jump just after leaving
// a ledge), jump-buffering (press just before landing), and a variable-height
// jump (release early = shorter hop). These three are what make a platformer
// feel "tight" rather than floaty — see game-design (input feel).
const RUN_SPEED = 110;
const JUMP_VELOCITY = -300;
const COYOTE_MS = 90;
const BUFFER_MS = 110;

export class Hero extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  private coyote = 0;
  private buffer = 0;
  private wasOnFloor = false;
  private stepTimer = 0;
  public invuln = 0; // ms of post-hit invulnerability
  public dead = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, Tex.Hero, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1); // anchor at the feet
    // Hitbox a touch narrower than the art so the player squeezes past hazards.
    this.body.setSize(8, 20);
    this.body.setOffset(4, 4);
    this.setCollideWorldBounds(true);
    this.play(Anim.HeroIdle);
  }

  /** Drive from input flags computed in GameScene. */
  control(left: boolean, right: boolean, jumpPressed: boolean, jumpHeld: boolean, dt: number): void {
    if (this.dead) return;

    const onFloor = this.body.blocked.down || this.body.touching.down;

    // coyote + buffer timers
    if (onFloor) this.coyote = COYOTE_MS;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (jumpPressed) this.buffer = BUFFER_MS;
    else this.buffer = Math.max(0, this.buffer - dt);
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);

    // horizontal
    if (left && !right) {
      this.setVelocityX(-RUN_SPEED);
      this.setFlipX(true);
    } else if (right && !left) {
      this.setVelocityX(RUN_SPEED);
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    // jump (consume buffer when grounded-or-coyote)
    if (this.buffer > 0 && this.coyote > 0) {
      this.setVelocityY(JUMP_VELOCITY);
      this.buffer = 0;
      this.coyote = 0;
      this.emit('jumped');
    }
    // variable height: cut the rise short when the button is released
    if (!jumpHeld && this.body.velocity.y < -120) {
      this.setVelocityY(-120);
    }

    // landing event (for dust)
    if (onFloor && !this.wasOnFloor && this.body.velocity.y >= 0) {
      this.emit('landed');
    }
    this.wasOnFloor = onFloor;

    // animation
    if (!onFloor) {
      this.play(Anim.HeroJump, true);
    } else if (this.body.velocity.x !== 0) {
      this.play(Anim.HeroRun, true);
      // footstep cadence while running on the ground
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.stepTimer = 260; this.emit('step'); }
    } else {
      this.play(Anim.HeroIdle, true);
      this.stepTimer = 0;
    }

    // blink while invulnerable
    this.setAlpha(this.invuln > 0 && Math.floor(this.invuln / 60) % 2 === 0 ? 0.4 : 1);
  }

  /** Bounce up after a successful stomp. */
  bounce(): void {
    this.setVelocityY(JUMP_VELOCITY * 0.7);
  }

  hurtFrom(x: number): void {
    this.invuln = 1000;
    this.setVelocity(this.x < x ? -160 : 160, -200);
  }

  die(): void {
    this.dead = true;
    this.setVelocity(0, -260);
    this.body.checkCollision.none = true;
    this.setTint(0xff5d9e);
  }
}
