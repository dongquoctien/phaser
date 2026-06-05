import Phaser from 'phaser';
import { type ZombieDef } from '../types/roster';

// A pooled zombie that walks the waypoint path. A Sprite (moved manually, no
// physics body). Carries status effects layered by hero skills: slow, poison
// (DoT), stun, knockback. Heroes query it via the scene's zombie list.
//
// Two visual modes: `animated` zombies (the zombie-girl, used for `walker`) play
// real spritesheet anims (walk/takeDamage/death/...); the rest are a single
// static baked grid animated procedurally (gait/topple). One class serves both.
export class Zombie extends Phaser.GameObjects.Sprite {
  hp = 0;
  maxHp = 0;
  baseSpeed = 0;
  bounty = 0;
  dead = true;        // removed from play (stepped over, untargetable)
  dying = false;      // death anim is playing; not steppable/targetable but still on screen
  reachedEnd = false;
  /** boss-only metadata (name + hero-kill cooldown); undefined for minions, even
   *  when a boss type walks in as an elite minion (set only on real boss waves). */
  bossInfo?: { name: string; skillCdMs: number; throwTex?: string;
    fill?: string; killLines?: string[]; spawnLines?: string[] };
  nextHeroKillAt = 0; // next time this boss may destroy a hero (scene clock ms)
  isElite = false; // a boss-type walking in as a tougher minion (no skill/popup); costs 3 lives at the gate
  private bubble?: Phaser.GameObjects.Container; // boss taunt speech bubble
  private bubbleH = 0;       // bubble height (for head-offset placement)
  private bubbleBornAt = 0;  // time the current bubble appeared (drives its life cycle)
  private pendingEntrance?: string[]; // boss entrance taunt, fired once it walks on-field

  // status
  private slowFactor = 1; // 1 = normal; <1 = slowed
  private slowUntil = 0;
  private stunUntil = 0;
  // Joicy quake: after a successful knockback the zombie is briefly KB-IMMUNE, so
  // stacking Joicys (whose slams land out of phase) can't chain-shove + stun-lock a
  // zombie in place forever. Slams during the window still deal damage, just no
  // push/stun — so it reads as "shove, skip a beat, shove again".
  private kbImmuneUntil = 0;
  private freezeStacks = 0; // Morgan: frost stacks build toward a hard-freeze
  private frozenUntil = 0;  // while > now the zombie is locked solid (can't move)
  // xxKongxx burn: each hit adds a stack; at the threshold the zombie INCINERATES,
  // taking a % of its CURRENT hp per tick (shreds high-hp targets) until burn ends.
  private burnStacks = 0;
  private burnDps = 0;       // flat DoT per second from stacked burn (pre-incinerate)
  private burnUntil = 0;
  private incinPctPerTick = 0; // >0 once incinerated: fraction of current hp per tick
  private lastBurnTick = 0;
  private poisonDps = 0;
  private poisonUntil = 0;
  private vulnStacks = 0; // gnaw (Jibgor): each bite raises damage taken; +8% per stack, capped
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

  // animated mode (spritesheet). When set, real anims replace the procedural
  // gait/topple. `sheet` is the anim-key prefix ('girl'|'boss'|'speed').
  private animated = false;
  private sheet = '';        // anim key prefix, '' = not animated
  private busyAnimUntil = 0; // while a one-shot anim (takeDamage) plays, don't override with walk

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'zombie-girl-stand'); // placeholder texture, replaced on spawn()
    this.setActive(false).setVisible(false);
    this.hpBarBg = scene.add.rectangle(0, 0, 26, 4, 0x1a1c2c).setDepth(15).setVisible(false);
    this.hpBar = scene.add.rectangle(0, 0, 24, 2, 0xb13e53).setOrigin(0, 0.5).setDepth(16).setVisible(false);
  }

  spawn(def: ZombieDef, hp: number, baseSpeed: number, bountyBase: number, waypoints: { x: number; y: number }[]): void {
    this.sheet = def.sheet ?? '';
    this.animated = !!this.sheet;
    this.setTexture(def.tex).setScale(def.scale);
    this.setOrigin(0.5, this.animated ? 0.78 : 0.5); // feet near bottom for the tall sheet
    this.baseScale = def.scale;
    this.busyAnimUntil = 0;
    this.gait = Math.random() * Math.PI * 2; // desync the herd
    if (this.animated) this.play(`${this.sheet}-walk`); // looping shuffle
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
    this.bossInfo = undefined; // set by the scene only when this is the wave's real boss
    this.nextHeroKillAt = 0;
    this.isElite = false;
    this.bubble?.destroy(); this.bubble = undefined; this.pendingEntrance = undefined;
    this.slowFactor = 1; this.slowUntil = 0; this.stunUntil = 0; this.kbImmuneUntil = 0;
    this.freezeStacks = 0; this.frozenUntil = 0;
    this.burnStacks = 0; this.burnDps = 0; this.burnUntil = 0; this.incinPctPerTick = 0; this.lastBurnTick = 0;
    this.poisonDps = 0; this.poisonUntil = 0; this.vulnStacks = 0;
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

  /** Float a boss taunt bubble above the head (themed to the boss colour), then fade.
   *  The bubble TRACKS the boss each frame (see updateBubble, called from step) so it
   *  stays over the head as the boss walks. No-op for non-boss / empty lines. One at a
   *  time. The pop/fade is driven by a manual alpha ramp (in updateBubble) rather than
   *  a tween, so the bubble can follow position AND fade together. */
  /** Queue the boss's entrance taunt. The boss spawns ABOVE the field (row -1), so
   *  saying it now would float the bubble off-screen and fade before it's visible.
   *  We hold it and let step() fire it the moment the boss crosses onto the field. */
  bossEntrance(lines?: string[]): void {
    if (lines && lines.length) this.pendingEntrance = lines;
  }

  bossSay(lines?: string[]): void {
    if (!lines || !lines.length || this.dead) return;
    const text = lines[(Math.random() * lines.length) | 0];
    this.bubble?.destroy();
    const pad = 5;
    const label = this.scene.add.text(0, 0, text, {
      fontFamily: 'monospace', fontSize: '10px', color: '#f4f4f4', align: 'center',
      stroke: '#0a0a14', strokeThickness: 3, wordWrap: { width: 130 },
    }).setOrigin(0.5);
    const w = label.width + pad * 2, h = label.height + pad * 2;
    const fill = this.bossInfo?.fill ?? '#b13e53';
    const bg = this.scene.add.rectangle(0, 0, w, h, Phaser.Display.Color.HexStringToColor('#1a0a14').color, 0.92)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(fill).color).setOrigin(0.5);
    const tail = this.scene.add.triangle(0, h / 2, -4, 0, 4, 0, 0, 7, 0x1a0a14, 0.92)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(fill).color).setOrigin(0.5);
    const c = this.scene.add.container(this.pathX || this.x, 0, [bg, tail, label]).setDepth(45).setAlpha(0);
    this.bubble = c;
    this.bubbleH = h;
    this.bubbleBornAt = this.scene.time.now;
    this.updateBubble(); // place it over the head immediately (don't wait a frame)
  }

  /** Keep the speech bubble pinned over the boss's head and run its pop-in / hold /
   *  fade-out life cycle. Called every frame from step(); cheap no-op when idle. */
  private updateBubble(): void {
    const c = this.bubble;
    if (!c) return;
    const HOLD = 1700, FADE = 320, POP = 160;
    const age = this.scene.time.now - this.bubbleBornAt;
    if (age >= HOLD + FADE) { c.destroy(); this.bubble = undefined; return; }
    // follow the head (use the true path position so it doesn't jitter with the gait)
    const headLift = (this.animated ? this.displayHeight * 0.74 : 16) + this.bubbleH * 0.5 + 6;
    c.x = this.pathX || this.x;
    c.y = (this.pathY || this.y) - headLift;
    // life cycle: scale/alpha pop-in, hold, then fade up & out
    if (age < POP) {
      const t = age / POP; c.setAlpha(t).setScale(0.6 + 0.4 * t);
    } else if (age < HOLD) {
      c.setAlpha(1).setScale(1);
    } else {
      c.setAlpha(1 - (age - HOLD) / FADE).setScale(1);
    }
  }

  despawn(): void {
    this.dead = true;
    this.dying = false;
    this.bubble?.destroy(); this.bubble = undefined; // drop any lingering taunt
    this.pendingEntrance = undefined;
    this.pathX = 0; this.pathY = 0; // clear gait state for the next pooled use
    this.setRotation(0).setAngle(0).setAlpha(1).setScale(this.baseScale);
    if (this.animated) { this.stop(); this.setOrigin(0.5, 0.78); }
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

    if (this.bubble) this.updateBubble(); // keep any taunt bubble pinned over the head
    // entrance taunt: fire once the boss has actually walked onto the visible field
    // (it spawns ~67px above the top edge), so players see the line.
    if (this.pendingEntrance && (this.pathY || this.y) > 24) {
      const lines = this.pendingEntrance; this.pendingEntrance = undefined;
      this.bossSay(lines);
    }

    // undo last frame's gait render-offset so movement math runs on the true path
    // position (otherwise the bob/lurch would feed back into waypoint steering).
    if (this.pathX || this.pathY) { this.x = this.pathX; this.y = this.pathY; }

    // poison DoT
    if (this.poisonUntil > now && this.poisonDps > 0) {
      if (this.applyDamage(this.poisonDps * dt)) return null; // killed → caller reads dead via list filter
    }

    // burn DoT (xxKongxx): flat per-stack damage, OR — once incinerated — a % of
    // CURRENT hp every ~250ms tick (so it chews through high-hp zombies fast).
    if (this.burnUntil > now) {
      if (this.burnDps > 0 && this.applyDamage(this.burnDps * dt)) return null;
      if (this.incinPctPerTick > 0 && now - this.lastBurnTick >= 250) {
        this.lastBurnTick = now;
        if (this.applyDamage(this.hp * this.incinPctPerTick)) return null;
      }
    } else if (this.burnStacks > 0) {
      // burn expired → reset the fire state
      this.burnStacks = 0; this.burnDps = 0; this.incinPctPerTick = 0;
    }

    // stunned OR hard-frozen → no movement (but still flashes / takes DoT)
    if (this.stunUntil > now || this.frozenUntil > now) { this.updateBars(); return null; }

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
        if (this.animated && Math.abs(dx) > 0.1) this.setFlipX(dx < 0); // face travel dir
        this.dist += move;
        move = 0;
      }
    }
    if (this.animated) {
      // real anim drives the look; just make sure we're walking once a one-shot
      // (takeDamage) finishes.
      const walk = `${this.sheet}-walk`;
      if (now >= this.busyAnimUntil && this.anims.currentAnim?.key !== walk) this.play(walk);
      this.pathX = this.x; this.pathY = this.y; // keep these synced for bars/knockback
    } else {
      this.applyGait();
    }
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

    if (this.animated) {
      // play the real collapse anim (switches to the lying sheet), hold the last
      // frame briefly, then fade out and despawn.
      this.scene.tweens.killTweensOf(this);
      this.setOrigin(0.5, 0.6); // lying frames are centred, not feet-anchored
      this.play(`${this.sheet}-death`);
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.scene.tweens.add({
          targets: this, alpha: 0, delay: 250, duration: 300, ease: 'Quad.in',
          onComplete: () => { this.setAlpha(1); this.despawn(); onDone?.(); },
        });
      });
      return;
    }

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
  /** One-shot attack anim for the boss hero-kill skill, then resume walking.
   *  No-op for non-animated zombies. */
  playBossAttack(): void {
    if (!this.animated || this.dead || this.dying) return;
    this.play(`${this.sheet}-${Math.random() < 0.5 ? 'attackA' : 'attackB'}`, true);
    this.busyAnimUntil = this.scene.time.now + 500; // hold the attack pose briefly
  }

  playEndAttack(onDone?: () => void): void {
    if (this.dying || this.dead) { onDone?.(); return; }
    this.dying = true;
    this.hpBarBg.setVisible(false);
    this.hpBar.setVisible(false);
    // direction from the last waypoint we passed toward the exit
    const prev = this.waypoints[Math.max(0, this.wpIndex - 1)] ?? { x: this.x - 1, y: this.y };
    const dx = Math.sign(this.x - prev.x) || 1;

    if (this.animated) {
      // real bite at the base, then fade out
      this.play(`${this.sheet}-${Math.random() < 0.5 ? 'attackA' : 'attackB'}`);
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.scene.tweens.add({
          targets: this, alpha: 0, duration: 160, ease: 'Quad.in',
          onComplete: () => { this.setAlpha(1); this.despawn(); onDone?.(); },
        });
      });
      return;
    }

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
    // gnaw vulnerability: each stack makes the zombie take +8% damage (cap +80%)
    if (this.vulnStacks > 0) amount *= 1 + Math.min(this.vulnStacks, 10) * 0.08;
    this.hp -= amount;
    this.flash();
    if (this.hp <= 0) { this.hp = 0; return true; }
    // animated: brief hurt reaction (skipped for tiny poison ticks so it doesn't
    // freeze the walk). The walk resumes in step() once busyAnimUntil passes.
    if (this.animated && amount >= 2) {
      this.play(`${this.sheet}-takeDamage`, true);
      this.busyAnimUntil = this.scene.time.now + 220;
    }
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

  /** gnaw (Jibgor): add a vulnerability stack so the next bites bite harder. */
  gnaw(): void {
    if (this.dead) return;
    this.vulnStacks++;
  }

  /** True while the zombie is on fire. */
  isBurning(now: number): boolean {
    return this.burnUntil > now;
  }

  /** xxKongxx (Flame Breathing): add one burn stack. Each stack adds flat DoT and
   *  refreshes the burn timer; once stacks reach `stacksToIncinerate` the zombie
   *  IGNITES — taking `incinPct` of its CURRENT hp per tick. Returns true on the
   *  tick it first incinerates (so the scene can play the ignite FX). */
  applyBurn(dps: number, durationS: number, stacksToIncinerate: number, incinPct: number, now: number): boolean {
    if (this.dead || this.dying) return false;
    this.burnStacks++;
    this.burnDps = dps * this.burnStacks;
    this.burnUntil = now + durationS * 1000;
    this.setTint(0xff7a1a);
    this.scene.time.delayedCall(140, () => {
      if (!this.dead && this.burnUntil <= this.scene.time.now) this.clearTint();
    });
    if (this.incinPctPerTick === 0 && this.burnStacks >= stacksToIncinerate) {
      this.incinPctPerTick = incinPct;
      this.lastBurnTick = now;
      return true; // just ignited
    }
    return false;
  }

  /** True while the zombie is locked in a hard-freeze (brittle, can't move). */
  isFrozen(now: number): boolean {
    return this.frozenUntil > now;
  }

  /** Morgan (Deep Freeze): add a frost stack. While building up it slows; once it
   *  reaches `stacksToFreeze` it HARD-FREEZES (full stop) for `durationS` and the
   *  stack counter resets so it can be re-frozen later. */
  addFreezeStack(stacksToFreeze: number, durationS: number, now: number): void {
    if (this.dead || this.dying) return;
    // already frozen → just refresh the lock, don't re-count
    if (this.frozenUntil > now) { this.frozenUntil = Math.max(this.frozenUntil, now + durationS * 1000); return; }
    this.freezeStacks++;
    if (this.freezeStacks >= stacksToFreeze) {
      this.freezeStacks = 0;
      this.frozenUntil = now + durationS * 1000;
      this.setTint(0x6cc6ff); // solid ice
      this.scene.time.delayedCall(durationS * 1000, () => {
        if (!this.dead && this.frozenUntil <= this.scene.time.now) this.clearTint();
      });
    } else {
      // building up: a light chill slow + frosty tint
      this.applySlow(0.7, 1.2, now);
    }
  }

  /**
   * Push the zombie back along the path (rewind waypoints by `px`).
   * Honors a short KB-immunity window so stacked knockbacks can't lock a zombie in
   * place: a push within `immuneMs` of the last is ignored. Returns `true` if it
   * actually pushed (caller can then apply stun), `false` if immune.
   */
  knockBack(px: number, now = this.scene.time.now, immuneMs = 0): boolean {
    if (this.dead) return false;
    if (immuneMs > 0 && now < this.kbImmuneUntil) return false; // still immune — no push
    let back = px;
    while (back > 0 && this.wpIndex >= 0) {
      const prev = this.waypoints[this.wpIndex];
      if (!prev) break; // no waypoint to rewind toward (start/edge of path) — stop safely
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
    if (immuneMs > 0) this.kbImmuneUntil = now + immuneMs; // arm the cooldown for next slam
    this.updateBars();
    return true;
  }

  private flash(): void {
    this.setTint(0xffffff);
    this.scene.time.delayedCall(45, () => {
      if (this.dead) return;
      // restore a status tint if one is active, else clear
      const now2 = this.scene.time.now;
      if (this.frozenUntil > now2) this.setTint(0x6cc6ff);
      else if (this.burnUntil > now2) this.setTint(0xff7a1a);
      else if (this.stunUntil > now2) this.setTint(0xffe066);
      else if (this.slowUntil > now2) this.setTint(0x9be0ff);
      else this.clearTint();
    });
  }

  private updateBars(): void {
    if (this.hp >= this.maxHp) { this.hpBarBg.setVisible(false); this.hpBar.setVisible(false); return; }
    // hang bars off the true path position (pathX/Y), not the bobbing render
    // position, so the bar stays steady while the sprite shambles under it.
    const bx = this.pathX || this.x;
    // animated sprite is feet-anchored (origin .78) and taller → lift the bar more
    const headLift = this.animated ? this.displayHeight * 0.74 : 16;
    const by = (this.pathY || this.y) - headLift;
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
