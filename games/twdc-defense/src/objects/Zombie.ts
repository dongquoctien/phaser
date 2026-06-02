import Phaser from 'phaser';
import { type ZombieDef } from '../types/roster';

// A pooled zombie that walks the waypoint path. Plain Image moved manually (no
// physics body). Carries status effects layered by hero skills: slow, poison
// (DoT), stun, knockback. Heroes query it via the scene's zombie list.
export class Zombie extends Phaser.GameObjects.Image {
  hp = 0;
  maxHp = 0;
  baseSpeed = 0;
  bounty = 0;
  dead = true;        // removed from play (stepped over, untargetable)
  dying = false;      // death anim is playing; not steppable/targetable but still on screen
  reachedEnd = false;

  // status
  private slowFactor = 1; // 1 = normal; <1 = slowed
  private slowUntil = 0;
  private stunUntil = 0;
  private poisonDps = 0;
  private poisonUntil = 0;
  private dist = 0; // distance travelled along the path (px), for knockback + targeting order

  private wpIndex = 0;
  private waypoints: { x: number; y: number }[] = [];
  private segLen: number[] = [];
  private hpBar: Phaser.GameObjects.Rectangle;
  private hpBarBg: Phaser.GameObjects.Rectangle;

  // ── procedural walk anim (no spritesheet): the sprite is one static pixel
  //    grid; we fake a shambling gait by bobbing it vertically and lurching it
  //    side-to-side as it travels. Phase is driven by distance walked so speed
  //    changes (slow/runner) keep the cadence in sync. ──────────────────────────
  private baseScale = 1; // resting scale captured at spawn; bob squashes around it
  private gait = 0;      // a per-zombie phase offset so a wave doesn't march in lockstep
  private pathX = 0;     // true on-path position (gait offsets render around it, never accumulate)
  private pathY = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'zombie-walker');
    this.setActive(false).setVisible(false);
    this.hpBarBg = scene.add.rectangle(0, 0, 26, 4, 0x1a1c2c).setDepth(15).setVisible(false);
    this.hpBar = scene.add.rectangle(0, 0, 24, 2, 0xb13e53).setOrigin(0, 0.5).setDepth(16).setVisible(false);
  }

  spawn(def: ZombieDef, hp: number, baseSpeed: number, bountyBase: number, waypoints: { x: number; y: number }[]): void {
    this.setTexture(def.tex).setScale(def.scale);
    this.baseScale = def.scale;
    this.gait = Math.random() * Math.PI * 2; // desync the herd
    this.hp = hp;
    this.maxHp = hp;
    this.baseSpeed = baseSpeed * def.speedMul;
    this.bounty = Math.round(bountyBase * def.bounty);
    this.waypoints = waypoints;
    this.wpIndex = 0;
    this.dist = 0;
    this.dead = false;
    this.dying = false;
    this.reachedEnd = false;
    this.slowFactor = 1; this.slowUntil = 0; this.stunUntil = 0;
    this.poisonDps = 0; this.poisonUntil = 0;
    // precompute segment lengths for distance-based ordering
    this.segLen = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      this.segLen.push(Phaser.Math.Distance.BetweenPoints(waypoints[i], waypoints[i + 1]));
    }
    const wp0 = waypoints[0];
    this.pathX = wp0.x; this.pathY = wp0.y;
    this.setPosition(wp0.x, wp0.y).setRotation(0).setActive(true).setVisible(true).setDepth(10).clearTint();
    this.hpBarBg.setVisible(false);
    this.hpBar.setVisible(false);
  }

  despawn(): void {
    this.dead = true;
    this.dying = false;
    this.pathX = 0; this.pathY = 0; // clear gait state for the next pooled use
    this.setRotation(0).setAngle(0).setAlpha(1);
    this.setActive(false).setVisible(false);
    this.hpBarBg.setVisible(false);
    this.hpBar.setVisible(false);
    this.clearTint();
  }

  /** Total distance travelled along the path — used to target the FRONT zombie. */
  get progress(): number { return this.dist; }

  /** Step toward the next waypoint. Returns 'end' if it reached the exit. */
  step(dt: number, now: number): 'end' | null {
    if (this.dead || this.dying) return null; // death/end-attack tween owns it now

    // undo last frame's gait render-offset so movement math runs on the true path
    // position (otherwise the bob/lurch would feed back into waypoint steering).
    if (this.pathX || this.pathY) { this.x = this.pathX; this.y = this.pathY; }

    // poison DoT
    if (this.poisonUntil > now && this.poisonDps > 0) {
      if (this.applyDamage(this.poisonDps * dt)) return null; // killed → caller reads dead via list filter
    }

    // stunned → no movement (but still flashes)
    if (this.stunUntil > now) { this.updateBars(); return null; }

    const speed = this.baseSpeed * (this.slowUntil > now ? this.slowFactor : 1);
    let move = speed * dt;
    while (move > 0) {
      const target = this.waypoints[this.wpIndex + 1];
      if (!target) { this.reachedEnd = true; return 'end'; }
      const dx = target.x - this.x, dy = target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d <= move) {
        this.setPosition(target.x, target.y);
        this.dist += d;
        this.wpIndex += 1;
        move -= d;
      } else {
        this.x += (dx / d) * move;
        this.y += (dy / d) * move;
        this.dist += move;
        move = 0;
      }
    }
    this.applyGait();
    this.updateBars();
    return null;
  }

  /**
   * Shambling walk from a single static sprite: bob up/down + a lateral lurch +
   * a tiny tilt, all phased by distance walked (cadence stays right at any speed).
   * Two summed frequencies make it "bounce" rather than a robotic pure sine — the
   * second, faster wobble gives the off-balance zombie shuffle. Bigger zombies
   * (brute/boss) get a heavier, slower-feeling bob via their larger scale.
   */
  private applyGait(): void {
    // `step()` left this.x/this.y on the true path — capture it, then RENDER the
    // sprite at path + gait offset. Offsets are recomputed from scratch each frame
    // so they never accumulate (no drift off the road).
    this.pathX = this.x;
    this.pathY = this.y;
    const stride = 11; // px travelled per full gait cycle
    const p = this.dist / stride + this.gait;
    const bob = Math.sin(p) * 1.6 + Math.sin(p * 2.3) * 0.5; // px up/down (varied)
    const lurch = Math.sin(p * 0.5) * 1.2; // slow side-to-side sway
    const tilt = Math.sin(p) * 0.04; // radians; subtle off-balance lean
    this.x = this.pathX + lurch;
    this.y = this.pathY - Math.abs(bob); // bob lifts the body (never sinks below path)
    this.setRotation(tilt);
    // squash: stretch tall at the top of the bob, compress at the bottom
    const sq = 1 + (bob >= 0 ? 0.03 : -0.03);
    this.setScale(this.baseScale / sq, this.baseScale * sq);
  }

  /**
   * Death animation: pop up, spin-flatten, fade to nothing, THEN despawn (return
   * to the pool). Marks `dying` immediately so step/targeting skip it while the
   * tween plays. `onDone` lets the scene award gold/FX at the right beat.
   */
  playDeath(onDone?: () => void): void {
    if (this.dying || this.dead) { onDone?.(); return; }
    this.dying = true;
    this.hpBarBg.setVisible(false);
    this.hpBar.setVisible(false);
    this.setTint(0xb13e53); // brief red death flush
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      y: this.pathY - 10,                 // a small death pop
      scaleX: this.baseScale * 1.3,
      scaleY: this.baseScale * 0.2,       // flatten
      angle: 90,                          // topple over
      alpha: 0,
      duration: 320,
      ease: 'Quad.in',
      onComplete: () => { this.setAlpha(1).setAngle(0); this.despawn(); onDone?.(); },
    });
  }

  /**
   * Lunge at the base when reaching the exit — a quick chomp forward in travel
   * direction before the scene drains a life and despawns it. `onDone` fires after
   * the lunge so the life-loss reads as "the zombie got through".
   */
  playEndAttack(onDone?: () => void): void {
    if (this.dying || this.dead) { onDone?.(); return; }
    this.dying = true;
    this.hpBarBg.setVisible(false);
    this.hpBar.setVisible(false);
    // direction from the last waypoint we passed toward the exit
    const prev = this.waypoints[Math.max(0, this.wpIndex - 1)] ?? { x: this.x - 1, y: this.y };
    const dx = Math.sign(this.x - prev.x) || 1;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.chain({
      targets: this,
      tweens: [
        { scaleX: this.baseScale * 0.85, scaleY: this.baseScale * 1.15, duration: 80, ease: 'Quad.out' }, // rear up
        { x: this.x + dx * 10, scaleX: this.baseScale * 1.2, scaleY: this.baseScale * 0.85, duration: 90, ease: 'Quad.in' }, // chomp
        { alpha: 0, duration: 120, ease: 'Quad.in' },
      ],
      onComplete: () => { this.setAlpha(1); this.despawn(); onDone?.(); },
    });
  }

  /** Apply a flat damage amount; returns true if this killed it. */
  applyDamage(amount: number): boolean {
    if (this.dead || this.dying) return false;
    this.hp -= amount;
    this.flash();
    if (this.hp <= 0) { this.hp = 0; return true; }
    this.updateBars();
    return false;
  }

  applySlow(factor: number, durationS: number, now: number): void {
    // strongest slow wins; refresh duration
    this.slowFactor = Math.min(this.slowFactor === 1 ? factor : this.slowFactor, factor);
    this.slowUntil = Math.max(this.slowUntil, now + durationS * 1000);
    this.setTint(0x9be0ff);
    this.scene.time.delayedCall(120, () => { if (!this.dead && this.slowUntil <= this.scene.time.now) this.clearTint(); });
  }

  applyPoison(dps: number, durationS: number, now: number): void {
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonUntil = Math.max(this.poisonUntil, now + durationS * 1000);
  }

  applyStun(durationS: number, now: number): void {
    this.stunUntil = Math.max(this.stunUntil, now + durationS * 1000);
    this.setTint(0xffe066);
    this.scene.time.delayedCall(durationS * 1000, () => { if (!this.dead) this.clearTint(); });
  }

  /** Push the zombie back along the path (rewind waypoints by `px`). */
  knockBack(px: number): void {
    if (this.dead) return;
    let back = px;
    while (back > 0 && this.wpIndex >= 0) {
      const prev = this.waypoints[this.wpIndex];
      const dx = this.x - prev.x, dy = this.y - prev.y;
      const d = Math.hypot(dx, dy);
      if (d >= back) {
        this.x -= (dx / (d || 1)) * back;
        this.y -= (dy / (d || 1)) * back;
        this.dist = Math.max(0, this.dist - back);
        back = 0;
      } else {
        this.setPosition(prev.x, prev.y);
        this.dist = Math.max(0, this.dist - d);
        back -= d;
        if (this.wpIndex > 0) this.wpIndex -= 1; else back = 0;
      }
    }
    this.updateBars();
  }

  private flash(): void {
    this.setTint(0xffffff);
    this.scene.time.delayedCall(45, () => {
      if (this.dead) return;
      // restore a status tint if one is active, else clear
      if (this.stunUntil > this.scene.time.now) this.setTint(0xffe066);
      else if (this.slowUntil > this.scene.time.now) this.setTint(0x9be0ff);
      else this.clearTint();
    });
  }

  private updateBars(): void {
    if (this.hp >= this.maxHp) { this.hpBarBg.setVisible(false); this.hpBar.setVisible(false); return; }
    // hang bars off the true path position (pathX/Y), not the bobbing render
    // position, so the bar stays steady while the sprite shambles under it.
    const bx = this.pathX || this.x;
    const by = (this.pathY || this.y) - 16;
    this.hpBarBg.setPosition(bx, by).setVisible(true);
    this.hpBar.setPosition(bx - 12, by).setVisible(true);
    this.hpBar.width = 24 * Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
  }

  destroyAll(): void {
    this.hpBar.destroy();
    this.hpBarBg.destroy();
    this.destroy();
  }
}
