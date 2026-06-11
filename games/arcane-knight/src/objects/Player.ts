import Phaser from 'phaser';
import { Tex, Anim, type HeroId } from '../types/keys';

// The playable hero (Warrior or Magician). Arcade body platformer controller with
// run, jump (variable height + coyote time + jump buffer), and an attack that the
// scene reads via `wantsAttack`. Faces by velocity; plays idle/walk/jump/attack.
const RUN = 150;
const JUMP_V = 380;
const COYOTE_MS = 90;     // grace after leaving a ledge
const BUFFER_MS = 110;    // jump pressed slightly before landing still fires
const ATTACK_MS = 280;    // attack lockout / hitbox window

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly hero: HeroId;
  facing: 1 | -1 = 1;
  attacking = false;
  attackUntil = 0;
  private lastGround = -1e9;
  private jumpBufferedAt = -1e9;
  private idleA: string; private walkA: string; private atkA: string;
  private jumpTex: string;

  constructor(scene: Phaser.Scene, x: number, y: number, hero: HeroId) {
    this.hero = hero;
    const idleTex = hero === 'warrior' ? Tex.WarIdle0 : Tex.MagIdle0;
    this.idleA = hero === 'warrior' ? Anim.WarIdle : Anim.MagIdle;
    this.walkA = hero === 'warrior' ? Anim.WarWalk : Anim.MagWalk;
    this.atkA = hero === 'warrior' ? Anim.WarAtk : Anim.MagCast;
    this.jumpTex = hero === 'warrior' ? Tex.WarJump : Tex.MagJump;

    this.sprite = scene.physics.add.sprite(x, y, idleTex).setOrigin(0.5, 1);
    const b = this.sprite.body as Phaser.Physics.Arcade.Body;
    // body is the central column of the 32×32 (×4) sprite — ~40×96 of the 128 tall
    b.setSize(this.sprite.width * 0.28, this.sprite.height * 0.72);
    b.setOffset(this.sprite.width * 0.36, this.sprite.height * 0.26);
    b.setCollideWorldBounds(true);
    this.sprite.play(this.idleA);
  }

  /** queue a jump (called on key/button down) — buffered so it's forgiving. */
  queueJump(now: number): void { this.jumpBufferedAt = now; }

  /** trigger an attack if not already mid-swing. Returns true if it started now. */
  tryAttack(now: number): boolean {
    if (this.attacking || now < this.attackUntil) return false;
    this.attacking = true;
    this.attackUntil = now + ATTACK_MS;
    this.sprite.play(this.atkA, true);
    return true;
  }

  update(now: number, left: boolean, right: boolean, jumpHeld: boolean): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) this.lastGround = now;

    // horizontal
    let vx = 0;
    if (left && !right) { vx = -RUN; this.facing = -1; }
    else if (right && !left) { vx = RUN; this.facing = 1; }
    body.setVelocityX(vx);
    this.sprite.setFlipX(this.facing === -1);

    // jump: buffered press + coyote window
    const canCoyote = now - this.lastGround <= COYOTE_MS;
    const buffered = now - this.jumpBufferedAt <= BUFFER_MS;
    if (buffered && canCoyote) {
      body.setVelocityY(-JUMP_V);
      this.jumpBufferedAt = -1e9;
      this.lastGround = -1e9;
    }
    // variable jump height: cut upward velocity when the jump key is released
    if (!jumpHeld && body.velocity.y < -120) body.setVelocityY(-120);

    // animation state (attack overrides until it finishes)
    if (this.attacking) {
      if (now >= this.attackUntil || !this.sprite.anims.isPlaying) this.attacking = false;
    }
    if (!this.attacking) {
      if (!onGround) { if (this.sprite.texture.key !== this.jumpTex) this.sprite.setTexture(this.jumpTex); }
      else if (Math.abs(vx) > 1) { if (this.sprite.anims.getName() !== this.walkA) this.sprite.play(this.walkA, true); }
      else { if (this.sprite.anims.getName() !== this.idleA) this.sprite.play(this.idleA, true); }
    }
  }

  /** Melee hitbox in front of the warrior (world rect) during the active window. */
  meleeHitbox(): Phaser.Geom.Rectangle | null {
    if (this.hero !== 'warrior' || !this.attacking) return null;
    const w = 56, h = 70;
    const x = this.facing === 1 ? this.sprite.x : this.sprite.x - w;
    return new Phaser.Geom.Rectangle(x, this.sprite.y - 96, w, h);
  }

  destroy(): void { this.sprite.destroy(); }
}
