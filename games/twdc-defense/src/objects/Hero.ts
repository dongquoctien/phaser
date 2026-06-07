import Phaser from 'phaser';
import { Fonts } from '../types/keys';
import { HEROES, type HeroId, type HeroDef, type HeroTier } from '../types/roster';
import { pickLine, type VoiceEvent } from '../types/voicelines';
import { Zombie } from './Zombie';

// A placed hero: sits on a pad, auto-targets the front-most zombie in range, and
// produces a "fire intent" each time its cooldown elapses. The GameScene resolves
// the intent (projectile / melee / aura / nova) so all skill effects live in one
// place. Tiered upgrades scale range/rate/damage.
export interface FireIntent {
  target: Zombie | null; // primary target (null for aura/nova which hit by radius)
  angle: number;
}

export class Hero extends Phaser.GameObjects.Image {
  readonly heroId: HeroId;
  readonly def: HeroDef & { tiers: HeroTier[] };
  readonly col: number;
  readonly row: number;
  private readonly homeX: number; // true pad x; attacks always lunge from + return here
  tier = 0;
  spent = 0; // total gold sunk into this hero (buy + upgrades); drives sell refund
  // ── merge state ── each merge adds +15% damage, +8% range, AND a gold-shield tier
  // (max 3). A boss hit consumes one shield tier (hero survives, loses that bonus).
  mergeTiers = 0;
  dragging = false; // true while being dragged for a merge
  // ── ultimate (active skill) state — only meaningful when def.ultimate is set (HAKJ).
  // Charges 0→100 over time + per team kill; at 100 the player can tap to fire it.
  ultCharge = 0;
  private nextFireAt = 0;
  private turret: Phaser.GameObjects.Image | null = null; // none for now; heroes face forward
  private ring: Phaser.GameObjects.Arc;
  private baseScale = 1; // resting scale; all anims tween RELATIVE to this
  private facing = 1; // +1 right, -1 left (flipX). attack lunges along this axis.
  private idleTween?: Phaser.Tweens.Tween;
  private bubble?: Phaser.GameObjects.Container; // active speech bubble (one at a time)
  private nextChatterAt = 0; // rate-limit attack chatter so it doesn't spam
  // merge visuals — a rotating magic-circle at the feet (one ring per merge tier:
  // gold → gold+black → gold+black+red) + small shield icons above the head.
  // The rings live inside `mergeGround`, a container flattened on Y (scaleY≈0.42) to
  // project the floor plane. The rune Graphics rotate INSIDE that container, so the
  // spin happens in the ground plane THEN gets foreshortened — geometrically correct
  // (rotating a pre-flattened sprite would tilt the whole ellipse, which looks wrong).
  private mergeGround?: Phaser.GameObjects.Container; // foreshortened floor plane
  private mergeRings: Phaser.GameObjects.Graphics[] = []; // concentric rune wheels (spin)
  private mergeRingTween?: Phaser.Tweens.Tween;           // shared rotation driver
  private mergeGlow?: Phaser.GameObjects.Arc;      // soft glow disc under the circle
  private mergePct?: Phaser.GameObjects.Text;     // "+x%" label below the hero
  private shieldIcons: Phaser.GameObjects.Graphics[] = []; // shield badges above the head
  private lvLabel?: Phaser.GameObjects.Text;      // persistent "Lv N" badge over the head
  private nextBuffSparkAt = 0;                    // throttle for the "being buffed" spark
  // ultimate energy AURA (only for heroes with def.ultimate, e.g. HAKJ). Two layers:
  //  ultRing  (depth 10, BEHIND the hero) — back half of the swirling water bands.
  //  ultFront (depth 12, in FRONT) — front half of the water bands + glowing eyes.
  //  ultGlow  (depth 9)  — a bright copy of the hero sprite = silhouette rim glow.
  //  ultLabel (depth 13) — the "ULTI" tap-prompt at the feet.
  //  All only appear at "enough rage" (ultReady).
  private ultRing?: Phaser.GameObjects.Graphics;
  private ultFront?: Phaser.GameObjects.Graphics;
  private ultGlow?: Phaser.GameObjects.Sprite; // bright silhouette copy behind hero (rim glow)
  private ultLabel?: Phaser.GameObjects.Text;  // "ULTI" prompt under the feet when ready
  // combo (xxKingxx): rising bonus damage while striking the SAME target
  private comboTarget: Zombie | null = null;
  comboCount = 0;
  // spirit orbs (Yugitoh): visual guardians that circle the hero
  private orbs: Phaser.GameObjects.Arc[] = [];
  private orbRing?: Phaser.GameObjects.Arc; // faint orbit-path ring under the orbs
  private orbTween?: Phaser.Tweens.Tween;   // shared rotation driver for the orbs
  // aura "heartbeat" pulse ring (buff/heal/gold supports): grows small→range, fades
  private auraPulseTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, id: HeroId, col: number, row: number, x: number, y: number) {
    const def = HEROES[id];
    super(scene, x, y, def.tex);
    this.heroId = id;
    this.def = def;
    this.col = col;
    this.row = row;
    this.homeX = x; // pad anchor — lunges restore to this, never drift
    // Hero sprites are pixel-art PNGs (~56px tall). Scale to fit a pad. Pixel art
    // wants integer-ish scale for crispness; pick the nearest integer step (min 1)
    // so the nearest-neighbor upscale stays clean instead of a blurry fraction.
    const targetH = 44;
    const srcH = this.height || targetH;
    this.baseScale = Math.max(1, Math.round(targetH / srcH)) || targetH / srcH;
    // if the sprite is already taller than target (big heroes), allow a clean 1x.
    if (srcH >= targetH) this.baseScale = 1;
    this.setDepth(11).setScale(this.baseScale);
    this.setOrigin(0.5, 0.62); // feet sit a touch below centre on the pad
    scene.add.existing(this);
    this.startIdle();
    if (def.skill === 'spirit') this.spawnOrbs(); // Yugitoh's orbiting guardians
    if (def.attack === 'aura') this.startAuraPulse(); // buff/heal/gold auras: heartbeat ring
    this.chatter('place'); // greet on placement
    // selection ring (hidden until selected)
    this.ring = scene.add.circle(x, y, def.tiers[0].range, Phaser.Display.Color.HexStringToColor(def.tint).color, 0.1)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(def.tint).color, 0.5)
      .setDepth(9).setVisible(false);
    this.refreshLevel(); // show the "Lv1" badge from the moment it's placed
    if (this.hasUltimate) {
      this.ultRing = scene.add.graphics().setDepth(10);  // behind the hero sprite (11)
      this.ultFront = scene.add.graphics().setDepth(12); // in front of the hero
      // rim glow: a brightened copy of the hero's OWN sprite (transparent PNG), so the
      // halo traces the real silhouette. Sits just behind, additively tinted, hidden
      // until the ult is ready.
      this.ultGlow = scene.add.sprite(x, y, def.tex)
        .setOrigin(this.originX, this.originY).setScale(this.baseScale)
        .setTint(0xbfeaff).setBlendMode(Phaser.BlendModes.ADD).setDepth(9).setVisible(false);
      // "ULTI" tap-prompt under the feet
      this.ultLabel = scene.add.text(x, y + this.displayHeight * 0.5, 'ULTI ✦', {
        fontFamily: Fonts.Mono, fontSize: '9px', color: '#dffaff', stroke: '#0a2436', strokeThickness: 3,
        backgroundColor: '#16486acc', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 0).setDepth(13).setVisible(false);
      this.updateUltRing();
    }
  }

  get stats(): HeroTier { return this.def.tiers[this.tier]; }
  get canUpgrade(): boolean { return this.tier < this.def.tiers.length - 1; }
  get nextUpgradeCost(): number { return this.canUpgrade ? this.def.tiers[this.tier + 1].cost : 0; }
  /** True once the hero is fully upgraded (the only state that may be merged). */
  get isMaxLevel(): boolean { return this.tier >= this.def.tiers.length - 1; }
  /** Damage multiplier from merges: +15% per merge tier (max 3 → +45%). */
  get mergeMult(): number { return 1 + 0.15 * this.mergeTiers; }
  /** Range multiplier from merges: +8% per merge tier (max 3 → +24%) so a fused
   *  hero also reaches noticeably further, not just hits harder. */
  get mergeRangeMult(): number { return 1 + 0.08 * this.mergeTiers; }
  /** The hero's EFFECTIVE attack range = current tier range × merge range bonus.
   *  Use this everywhere a hero's reach is needed so merges actually extend it. */
  get range(): number { return this.stats.range * this.mergeRangeMult; }
  /** True if this hero has a player-triggered ultimate (e.g. HAKJ's map freeze). */
  get hasUltimate(): boolean { return !!this.def.ultimate; }
  /** True once the ultimate is fully charged and can be fired. */
  get ultReady(): boolean { return this.hasUltimate && this.ultCharge >= 100; }
  /** Add charge (clamped 0..100). No-op for heroes without an ultimate. */
  addUltCharge(pts: number): void {
    if (!this.hasUltimate || this.ultCharge >= 100) return;
    this.ultCharge = Math.min(100, this.ultCharge + pts);
    this.updateUltRing();
  }
  /** Spend a full charge (call when the ultimate fires). Returns false if not ready. */
  consumeUlt(): boolean {
    if (!this.ultReady) return false;
    this.ultCharge = 0;
    this.updateUltRing();
    return true;
  }

  /** Draw a LIVING blue energy aura around HAKJ's body that grows with ult charge:
   *  jagged ice flames licking upward, each tongue flickering tall/short over time
   *  (sine-driven, not random-per-frame, so it shimmers smoothly). Faint at low charge,
   *  a bright pulsing blaze when ready. Call every frame so it animates; `updateUltRing`
   *  (no time) is the cheap static refresh used by the charge hooks. */
  private updateUltRing(now = this.scene.time.now): void {
    const g = this.ultRing;
    if (!g) return;
    const cx = this.homeX, cy = this.y + this.displayHeight * 0.12; // around the body
    const halfW = this.displayWidth * 0.55;
    const ICE = 0x6cc6ff, CORE = 0xdffaff;
    g.clear();
    this.ultFront?.clear(); // always wipe the front layer first (water/eyes)
    if (!this.ultReady) {
      // not full yet → no aura (the rage effects only appear at full charge)
      this.ultGlow?.setVisible(false);
      this.ultLabel?.setVisible(false);
      return;
    }
    const tt = now / 1000;
    const breathe = 0.5 + 0.5 * Math.sin(tt * 3);

    // ── "enough rage" layers — wrap the body (NO foot flames) ───────────────────
    const gf = this.ultFront;
    if (gf) {
      const midY = this.y; // body centre
      const rx = halfW * 1.5, ry = this.displayHeight * 0.16; // swirl ellipse radii
      const WATER = 0x3aa0e0;
      void cx; void cy; // (rim glow is the silhouette sprite below, not an ellipse)
      // WATER SWIRL — several horizontal water BANDS stacked up the body, each a
      //    flat arc wrapping around it (front + back halves), drifting around the axis
      //    over time so the whole thing reads as a rotating vortex (ref: Isaac Rubio
      //    2d water FX). Front half on gf (over hero), back half on g (behind).
      const BANDS = 4;
      for (let bd = 0; bd < BANDS; bd++) {
        const u = bd / (BANDS - 1);                       // 0 (bottom) .. 1 (top)
        const bandY = midY + (u - 0.5) * this.displayHeight * 0.85;
        const spin = tt * 2.2 + bd * 0.8;                 // each band offset → swirl
        const bw = rx * (0.7 + 0.3 * Math.sin(u * Math.PI)); // wider in the middle
        // walk the ellipse in segments; split into front/back polylines
        const STEPS = 14;
        const drawHalf = (layer: Phaser.GameObjects.Graphics, fromFront: boolean, col: number, width: number, alpha: number) => {
          layer.lineStyle(width, col, alpha); let started = false;
          for (let s = 0; s <= STEPS; s++) {
            const a = (s / STEPS) * Math.PI * 2 + spin;
            const isFront = Math.sin(a) > 0;
            if (isFront !== fromFront) { started = false; continue; }
            const px = cx + Math.cos(a) * bw;
            const py = bandY + Math.sin(a) * ry;
            if (!started) { layer.beginPath(); layer.moveTo(px, py); started = true; } else layer.lineTo(px, py);
          }
          if (started) layer.strokePath();
        };
        // back half (behind hero) — dimmer; front half (over hero) — brighter + a glint
        drawHalf(g, false, WATER, 3.5, 0.7);
        drawHalf(g, false, CORE, 1.2, 0.4);
        drawHalf(gf, true, WATER, 4, 0.9);
        drawHalf(gf, true, CORE, 1.6, 0.85);
        // a moving white glint dot riding the FRONT of each band
        const ga = -Math.PI / 2 + Math.sin(tt * 3 + bd) * 0.8; // near the front centre
        gf.fillStyle(0xffffff, 0.95).fillCircle(cx + Math.cos(ga) * bw, bandY + Math.sin(ga) * ry, 2);
      }
      // a few stray water droplets flicking around (front)
      for (let d = 0; d < 4; d++) {
        const da = tt * 1.5 + d * 1.9;
        const dr = rx * (1.0 + 0.15 * Math.sin(tt * 5 + d));
        gf.fillStyle(ICE, 0.8).fillCircle(cx + Math.cos(da) * dr, midY + Math.sin(da) * ry * 2.4, 1.6);
      }
      // GLOWING EYES — two bright dots where HAKJ's eyes sit (front)
      const eyeY = this.y - this.displayHeight * 0.04, eyeDX = this.displayWidth * 0.13;
      const eg = 0.7 + 0.3 * Math.sin(tt * 6);
      for (const sgn of [-1, 1]) {
        gf.fillStyle(CORE, eg).fillCircle(this.x + sgn * eyeDX, eyeY, 2.4);
        gf.fillStyle(0xffffff, eg).fillCircle(this.x + sgn * eyeDX, eyeY, 1.1);
      }
    }

    // SILHOUETTE RIM GLOW — a brightened, slightly larger copy of HAKJ's own sprite
    // behind it, breathing in alpha/scale → a glowing border that traces the real
    // character outline (the PNG is transparent). + the "ULTI" tap-prompt at the feet.
    if (this.ultGlow) {
      this.ultGlow.setVisible(true).setPosition(this.x, this.y)
        .setScale(this.baseScale * (1.08 + 0.04 * breathe))
        .setAlpha(0.45 + 0.35 * breathe);
    }
    if (this.ultLabel) {
      this.ultLabel.setVisible(true).setPosition(this.x, this.y + this.displayHeight * 0.5)
        .setAlpha(0.75 + 0.25 * breathe);
    }
  }

  /** Per-frame tick for the energy aura (called from the scene update loop) so it
   *  shimmers continuously, not only when charge changes. */
  tickUltAura(now: number): void {
    if (this.ultRing && this.ultCharge > 2) this.updateUltRing(now);
  }
  get hasShield(): boolean { return this.mergeTiers > 0; }
  /** True once the hero has merged the maximum 3 tiers — it can't merge further,
   *  so it shouldn't be drag-pickable anymore. */
  get isMaxMerged(): boolean { return this.mergeTiers >= 3; }

  /** Returns a FireIntent when ready to act this frame, else null. */
  update(time: number, zombies: Zombie[]): FireIntent | null {
    if (this.dragging) return null; // a hero being dragged for a merge doesn't attack
    if (time < this.nextFireAt) return null;
    const s = this.stats;

    if (this.def.attack === 'aura' || this.def.attack === 'nova' || this.def.attack === 'orbit') {
      // radius effects fire on cooldown regardless of a specific target, but
      // nova/orbit should only bother if something is in range of the effect.
      if (this.def.attack === 'nova' || this.def.attack === 'orbit') {
        const reach = this.def.attack === 'orbit' ? (this.def.orbRadius ?? this.range) : this.range;
        const any = zombies.some((z) => !z.dead && !z.dying && Phaser.Math.Distance.Between(z.x, z.y, this.x, this.y) <= reach);
        if (!any) return null;
      }
      this.nextFireAt = time + s.fireInterval;
      if (this.def.attack !== 'orbit') this.playAttack(0); // orbit doesn't lunge — orbs do the work
      return { target: null, angle: 0 };
    }

    // projectile / melee: target the FRONT-most zombie in range
    const target = this.frontTargetInRange(zombies, this.range);
    if (!target) return null;
    this.nextFireAt = time + s.fireInterval;
    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    this.facing = Math.cos(angle) < 0 ? -1 : 1;
    this.setFlipX(this.facing < 0); // face the target
    this.playAttack(angle);
    return { target, angle };
  }

  // ── procedural animation (no spritesheet; one static pixel image, animated by
  //    transforms). Tower-defense heroes stand on a pad, so: idle "breathing",
  //    an attack "lunge + squash" toward the target, and a hit flash. ──────────

  /** Gentle perpetual breathing so an idle hero doesn't look frozen. */
  private startIdle(): void {
    this.idleTween = this.scene.tweens.add({
      targets: this,
      scaleY: this.baseScale * 1.04,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  /**
   * Attack tell: a quick squash-and-lunge toward the target, then settle back.
   * `angle` is the world-space direction to the target (0 for radius skills).
   * Self-contained: kills any in-flight attack tween and restores rest state.
   */
  playAttack(angle: number): void {
    this.chatter('attack'); // occasional bark
    const reach = 4 * this.baseScale; // px to lunge forward
    const dx = Math.cos(angle) * reach;
    const restX = this.homeX; // ALWAYS restore to the pad anchor (fast firers like
    // DongDong would otherwise drift: a new lunge starts before the last restores,
    // capturing the already-displaced x and creeping the hero away from its pad).
    this.x = restX; // snap home before the new lunge so it never accumulates
    this.idleTween?.pause();
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.chain({
      targets: this,
      tweens: [
        // wind-up: squat down + slight back-lean (anticipation)
        { scaleX: this.baseScale * 1.08, scaleY: this.baseScale * 0.92, duration: 60, ease: 'Quad.out' },
        // strike: lunge toward target, stretch
        { x: restX + dx, scaleX: this.baseScale * 0.94, scaleY: this.baseScale * 1.06, duration: 70, ease: 'Quad.in' },
        // recover to rest
        { x: restX, scaleX: this.baseScale, scaleY: this.baseScale, duration: 130, ease: 'Back.out' },
      ],
      onComplete: () => { this.x = restX; this.setScale(this.baseScale); this.idleTween?.resume(); },
    });
  }

  /** Damage/feedback flash — quick white tint + shake. (Call when a hero is hit
   *  by an enemy, if you add enemy-on-hero damage later.) */
  playHit(): void {
    this.setTint(0xffffff);
    this.scene.tweens.add({
      targets: this, x: this.x + 2, duration: 40, yoyo: true, repeat: 2,
      onComplete: () => this.clearTint(),
    });
  }

  // ── voice lines ──────────────────────────────────────────────────────────────

  /** Pick a random line for the event and show it (rate-limited for 'attack'). */
  chatter(ev: VoiceEvent): void {
    if (ev === 'attack') {
      const now = this.scene.time.now;
      if (now < this.nextChatterAt) return;          // not too often
      if (Math.random() > 0.18) { this.nextChatterAt = now + 1500; return; } // mostly silent
      this.nextChatterAt = now + 4000 + Math.random() * 3000;
    }
    const line = pickLine(this.heroId, ev);
    if (line) this.say(line);
  }

  /** Float a small speech bubble above the hero, then fade it out. */
  private say(text: string): void {
    this.bubble?.destroy(); // only one bubble at a time
    const pad = 4;
    const label = this.scene.add.text(0, 0, text, {
      fontFamily: 'monospace', fontSize: '9px', color: '#1a1c2c', align: 'center',
    }).setOrigin(0.5);
    const w = label.width + pad * 2;
    const h = label.height + pad * 2;
    const bg = this.scene.add.rectangle(0, 0, w, h, 0xf4f4f4, 1)
      .setStrokeStyle(1, 0x1a1c2c).setOrigin(0.5);
    const tail = this.scene.add.triangle(0, h / 2, -3, 0, 3, 0, 0, 5, 0xf4f4f4)
      .setStrokeStyle(1, 0x1a1c2c).setOrigin(0.5);
    const yTop = -this.displayHeight * 0.62 - 8; // just above the head
    const c = this.scene.add.container(this.x, this.y + yTop, [bg, tail, label]).setDepth(40);
    this.bubble = c;
    c.setScale(0.6).setAlpha(0);
    this.scene.tweens.add({ targets: c, scale: 1, alpha: 1, y: c.y - 6, duration: 140, ease: 'Back.out' });
    this.scene.tweens.add({
      targets: c, alpha: 0, y: c.y - 14, delay: 1200, duration: 300, ease: 'Quad.in',
      onComplete: () => { if (this.bubble === c) this.bubble = undefined; c.destroy(); },
    });
  }

  /** All live zombies within `range` (for cleave/nova/aura). */
  inRange(zombies: Zombie[], range: number): Zombie[] {
    return zombies.filter((z) => !z.dead && !z.dying && Phaser.Math.Distance.Between(z.x, z.y, this.x, this.y) <= range);
  }

  private frontTargetInRange(zombies: Zombie[], range: number): Zombie | null {
    let best: Zombie | null = null;
    let bestProg = -1;
    for (const z of zombies) {
      if (z.dead || z.dying) continue;
      if (Phaser.Math.Distance.Between(z.x, z.y, this.x, this.y) > range) continue;
      if (z.progress > bestProg) { bestProg = z.progress; best = z; }
    }
    return best;
  }

  upgrade(): void {
    if (!this.canUpgrade) return;
    this.tier += 1;
    this.ring.setRadius(this.range);
    this.refreshLevel(); // update the head badge (Lv2, Lv3 … MAX)
    if (this.def.skill === 'spirit') this.spawnOrbs(); // more/wider orbs per tier
    this.chatter('upgrade');
    // celebratory pop relative to the resting scale (not a hard 1.18 that would
    // shrink a >1x hero), then settle back to baseScale.
    this.idleTween?.pause();
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this, scale: this.baseScale * 1.25, duration: 110, yoyo: true, ease: 'Back.out',
      onComplete: () => { this.setScale(this.baseScale); this.idleTween?.resume(); },
    });
  }

  setSelected(on: boolean): void {
    this.ring.setRadius(this.range).setVisible(on);
  }

  /** Snap back to the pad after a cancelled drag (a little settle bounce). */
  snapHome(): void {
    this.refreshMergeVisuals(); // reposition aura/pips/label to the pad
    this.scene.tweens.killTweensOf(this);
    this.idleTween?.pause();
    this.scene.tweens.add({
      targets: this, scale: this.baseScale * 1.12, duration: 90, yoyo: true, ease: 'Quad.out',
      onComplete: () => { this.setScale(this.baseScale); this.idleTween?.resume(); },
    });
  }

  /** Add `add` merge tiers (each = +15% damage + +8% range + 1 gold shield), refresh
   *  visuals, pop FX. Merge value is CONSERVED (Clash-Royale style): the caller passes
   *  the full worth of the consumed source — a plain max hero is worth 1 tier, a hero
   *  that was already merged is worth its tiers + 1 — so two single-merge heroes combine
   *  to a 3-tier hero, never losing value. Caps at 3 tiers. Returns true if gained. */
  mergeOnce(add = 1): boolean {
    if (this.mergeTiers >= 3) return false;
    this.mergeTiers = Math.min(3, this.mergeTiers + Math.max(1, add));
    this.refreshMergeVisuals();
    this.floatPct();
    // a punchy power-up pop + brief flame burst
    this.scene.tweens.killTweensOf(this);
    this.idleTween?.pause();
    this.scene.tweens.add({
      targets: this, scale: this.baseScale * 1.35, duration: 140, yoyo: true, ease: 'Back.out',
      onComplete: () => { this.setScale(this.baseScale); this.idleTween?.resume(); },
    });
    return true;
  }

  /** Boss hit lands on a shielded hero: pop one shield tier (lose that tier's
   *  +15% damage / +8% range too). Returns true if a shield absorbed it (survives). */
  consumeShield(): boolean {
    if (this.mergeTiers <= 0) return false;
    this.mergeTiers -= 1;
    this.refreshMergeVisuals();
    this.floatPct();
    // shield-break flash, then restore the merge warm-tint (or none if last tier)
    this.setTint(0xffffff);
    this.scene.time.delayedCall(140, () => {
      if (!this.active) return;
      if (this.mergeTiers > 0) this.setTint(0xfff0c0); else this.clearTint();
    });
    return true;
  }

  // Draw one neon "rune wheel" (Genshin-style magic-circle ring) into `g`, centred
  // at (0,0): a glowing ring, a ring of 4-point star runes around it, and 4 long
  // spikes at the diagonals. `col` tints it; drawn with additive-ish bright strokes.
  private drawRuneWheel(g: Phaser.GameObjects.Graphics, radius: number, col: number): void {
    g.clear();
    // main ring (double stroke = glow + core)
    g.lineStyle(4, col, 0.28); g.strokeCircle(0, 0, radius);
    g.lineStyle(1.6, col, 0.95); g.strokeCircle(0, 0, radius);
    g.lineStyle(1, col, 0.7); g.strokeCircle(0, 0, radius * 0.82); // inner thin ring
    // 12 four-point star runes spaced around the ring
    const star = (cx: number, cy: number, s: number) => {
      g.lineStyle(1.4, col, 0.95);
      g.beginPath();
      g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.3, cy - s * 0.3); g.lineTo(cx + s, cy);
      g.lineTo(cx + s * 0.3, cy + s * 0.3); g.lineTo(cx, cy + s);
      g.lineTo(cx - s * 0.3, cy + s * 0.3); g.lineTo(cx - s, cy);
      g.lineTo(cx - s * 0.3, cy - s * 0.3); g.closePath(); g.strokePath();
    };
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      star(Math.cos(a) * radius, Math.sin(a) * radius, 4.5);
    }
    // 4 long diagonal spikes (the pointed "compass" arms from the reference)
    g.lineStyle(1.6, col, 0.9);
    for (const d of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const ix = Math.cos(d) * radius, iy = Math.sin(d) * radius;
      const ox = Math.cos(d) * (radius * 1.32), oy = Math.sin(d) * (radius * 1.32);
      g.beginPath(); g.moveTo(ix, iy); g.lineTo(ox, oy); g.strokePath();
    }
  }

  // Draw a small shield badge into `g`, centred at (0,0), ~`s` px wide.
  private drawShield(g: Phaser.GameObjects.Graphics, s: number): void {
    g.clear();
    const w = s, h = s * 1.25;
    g.fillStyle(0xffd23f, 1); g.lineStyle(1.5, 0x7a5a00, 1);
    g.beginPath();
    g.moveTo(0, -h / 2);                 // top centre
    g.lineTo(w / 2, -h / 2 + 2);         // top-right
    g.lineTo(w / 2, h * 0.12);           // right side
    g.lineTo(0, h / 2);                  // bottom point
    g.lineTo(-w / 2, h * 0.12);          // left side
    g.lineTo(-w / 2, -h / 2 + 2);        // top-left
    g.closePath(); g.fillPath(); g.strokePath();
    // a little cross/emblem
    g.lineStyle(1.4, 0x7a5a00, 0.9);
    g.beginPath(); g.moveTo(0, -h * 0.22); g.lineTo(0, h * 0.18); g.strokePath();
    g.beginPath(); g.moveTo(-w * 0.26, -h * 0.04); g.lineTo(w * 0.26, -h * 0.04); g.strokePath();
  }

  /** Rebuild the rotating magic-circle + shield badges + "+x%" label for the
   *  current tier count. Ring colours stack per tier: gold → +black → +red. */
  private refreshMergeVisuals(): void {
    // ── feet magic-circle: one rune wheel per merge tier, nested + colour-coded ──
    // tier1 = gold; tier2 = gold(inner) + black(outer); tier3 = gold + black + red.
    const TIER_COLORS = [0xffd23f, 0x161616, 0xff2e2e]; // gold, black, red (inner→outer)
    // (re)build the rings whenever the tier count changes
    const wantRings = this.mergeTiers;
    if (this.mergeRings.length !== wantRings) {
      for (const r of this.mergeRings) r.destroy();
      this.mergeRings = [];
      this.mergeRingTween?.stop(); this.mergeRingTween = undefined;
      if (wantRings > 0) {
        // the foreshortened floor plane: a container squashed on Y. Rune graphics
        // rotate inside it (in the flat ground plane); the container then projects.
        if (!this.mergeGround) {
          this.mergeGround = this.scene.add.container(0, 0).setDepth(7).setScale(1, 0.42);
        }
        for (let i = 0; i < wantRings; i++) {
          const g = this.scene.make.graphics({}, false);
          this.drawRuneWheel(g, 30 + i * 13, TIER_COLORS[i]); // bigger + spaced so all 3 read clearly
          this.mergeGround.add(g);
          this.mergeRings.push(g);
        }
        // soft glow disc under the circle (sized to cover the outermost ring)
        const glowR = 30 + (wantRings - 1) * 13 + 6;
        if (!this.mergeGlow) {
          this.mergeGlow = this.scene.add.circle(this.x, this.y + 12, glowR, 0xffd23f, 0.16).setDepth(6).setScale(1, 0.42);
          this.scene.tweens.add({ targets: this.mergeGlow, alpha: 0.28, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        } else {
          this.mergeGlow.setRadius(glowR);
        }
        // counter-rotate alternating rings via a shared phase driver (rotation is in
        // the GROUND plane — the container's scaleY foreshortens it afterwards)
        const state = { p: 0 };
        this.mergeRingTween = this.scene.tweens.add({
          targets: state, p: Math.PI * 2, duration: 6000, repeat: -1, ease: 'Linear',
          onUpdate: () => {
            for (let i = 0; i < this.mergeRings.length; i++) {
              this.mergeRings[i].rotation = (i % 2 ? -state.p : state.p) * (1 + i * 0.15);
            }
          },
        });
      } else {
        this.mergeGround?.destroy(); this.mergeGround = undefined;
        this.mergeGlow?.destroy(); this.mergeGlow = undefined;
      }
    }
    // position the ground plane + glow at the feet (also used after a drag/snap)
    this.mergeGround?.setPosition(this.x, this.y + 12);
    this.mergeGlow?.setPosition(this.x, this.y + 12);
    // hero keeps a subtle warm tint while fused
    if (this.mergeTiers > 0) this.setTint(0xfff2d0); else this.clearTint();

    // ── shield badges above the head — one per tier ──
    for (const s of this.shieldIcons) s.destroy();
    this.shieldIcons = [];
    for (let i = 0; i < this.mergeTiers; i++) {
      const px = this.x - (this.mergeTiers - 1) * 7 + i * 14;
      const g = this.scene.add.graphics().setDepth(12).setPosition(px, this.y - 32);
      this.drawShield(g, 8);
      this.shieldIcons.push(g);
    }
    // selection/range ring follows the merged (larger) range too
    this.ring.setRadius(this.range);
    // persistent "+x%" damage label below the feet (now +15%/tier)
    const pct = this.mergeTiers * 15;
    if (pct > 0) {
      if (!this.mergePct) {
        this.mergePct = this.scene.add.text(this.x, this.y + 20, '', {
          fontFamily: 'monospace', fontSize: '10px', color: '#ffd23f', stroke: '#1a1c2c', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(12);
      }
      this.mergePct.setPosition(this.x, this.y + 20).setText(`+${pct}%`);
    } else if (this.mergePct) {
      this.mergePct.destroy(); this.mergePct = undefined;
    }
    this.refreshLevel(); // keep the Lv badge pinned over the head too
  }

  /** Persistent "Lv N" badge above the hero so the player can read every hero's
   *  level at a glance (without tapping it). Sits top-LEFT of the head so it never
   *  overlaps the centred shield badges. Turns gold + reads "MAX" at full level. */
  private refreshLevel(): void {
    const max = this.isMaxLevel;
    const txt = max ? 'MAX' : `Lv${this.tier + 1}`;
    const color = max ? '#ffd23f' : '#ffffff';
    const bx = this.x - 14, by = this.y - 30; // top-left of the head
    if (!this.lvLabel) {
      this.lvLabel = this.scene.add.text(bx, by, txt, {
        fontFamily: 'monospace', fontSize: '10px', color, fontStyle: 'bold',
        stroke: '#1a1c2c', strokeThickness: 3, backgroundColor: '#1a1c2ccc', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(13);
    }
    this.lvLabel.setPosition(bx, by).setText(txt).setColor(color);
  }

  // ── combo (xxKingxx) ──────────────────────────────────────────────────────────
  /** Register a hit on `target`; returns the damage multiplier for this strike.
   *  Consecutive hits on the same target ramp the multiplier; switching resets. */
  comboHit(target: Zombie, step: number, max: number): number {
    if (this.comboTarget === target && !target.dead) {
      this.comboCount = Math.min(this.comboCount + 1, max);
    } else {
      this.comboTarget = target;
      this.comboCount = 0;
    }
    return 1 + this.comboCount * step;
  }

  // ── spirit orbs (Yugitoh) ──────────────────────────────────────────────────────
  /** (Re)build the orbiting orbs to match the current tier's orb count + radius,
   *  then start them circling. Called on placement and after every upgrade. */
  private spawnOrbs(): void {
    for (const o of this.orbs) this.scene.tweens.killTweensOf(o), o.destroy();
    this.orbs = [];
    const n = this.stats.orbs ?? 2;
    const radius = this.def.orbRadius ?? 52;
    const col = Phaser.Display.Color.HexStringToColor(this.def.tint).color;
    if (!this.orbRing) {
      this.orbRing = this.scene.add.circle(this.x, this.y, radius, col, 0.06)
        .setStrokeStyle(1, col, 0.25).setDepth(8);
    }
    this.orbRing.setRadius(radius);
    for (let i = 0; i < n; i++) {
      const orb = this.scene.add.circle(this.x, this.y, 5, col, 0.95)
        .setStrokeStyle(1.5, 0xffffff, 0.7).setDepth(12);
      this.orbs.push(orb);
    }
    // a shared rotation driver: one tween advances `phase`, orbs read it each frame
    this.orbTween?.stop();
    const state = { phase: 0 };
    this.orbTween = this.scene.tweens.add({
      targets: state, phase: Math.PI * 2, duration: 1400, repeat: -1, ease: 'Linear',
      onUpdate: () => {
        for (let i = 0; i < this.orbs.length; i++) {
          const a = state.phase + (i / this.orbs.length) * Math.PI * 2;
          this.orbs[i].setPosition(this.x + Math.cos(a) * radius, this.y + Math.sin(a) * radius);
        }
      },
    });
  }

  // ── aura heartbeat pulse (buff / heal / gold supports) ──────────────────────────
  /** Emit a soft glowing ring that grows from the hero out to its buff RANGE and
   *  fades — repeated on a steady ~1.4s beat (a "heartbeat"). Colour follows the
   *  hero's tint; the ring stops exactly at the hero's range so it reads as the area of
   *  effect. Set up once on placement; the range is read live so it tracks upgrades. */
  private startAuraPulse(): void {
    const col = Phaser.Display.Color.HexStringToColor(this.def.tint).color;
    const emit = () => {
      if (!this.active) return;
      const r = this.range; // current AoE radius (grows with upgrades + merges)
      // a SINGLE thin ring outline — grows to the buff range + fades. Drawn as a FULL
      // circle (matching the hero's range ring), centred on the hero. We tween the
      // RADIUS (not scale) so the 2px stroke stays 2px — scaling would blow the
      // stroke up too and the ring would spill past the actual buff range.
      const ring = this.scene.add.circle(this.x, this.y, 8, 0x000000, 0)
        .setStrokeStyle(2.5, col, 0.55).setDepth(8);
      this.scene.tweens.add({
        targets: ring, radius: r, alpha: 0,
        duration: 1100, ease: 'Cubic.easeOut', onComplete: () => ring.destroy(),
      });
    };
    emit();
    this.auraPulseTimer = this.scene.time.addEvent({ delay: 1400, loop: true, callback: emit });
  }

  /** "Being buffed" feedback: a small gold chevron (▲, drawn pixel-style, no emoji)
   *  rises off the hero and fades — a steady pulse while a buff-aura covers it. The
   *  scene calls this every frame when buffAt > 1; we throttle so it stays a gentle
   *  drip (~1 every 650ms), with a tiny x-jitter so repeats don't overlap. */
  showBuffSpark(now: number): void {
    if (now < this.nextBuffSparkAt) return;
    this.nextBuffSparkAt = now + 650;
    const jx = Phaser.Math.Between(-7, 7);
    const x = this.x + jx, y = this.y - this.displayHeight * 0.45;
    // a small upward chevron built from two short strokes (gold = damage buff)
    const g = this.scene.add.graphics().setDepth(33);
    g.lineStyle(2, 0xffd23f, 1);
    g.beginPath(); g.moveTo(x - 4, y + 3); g.lineTo(x, y - 2); g.lineTo(x + 4, y + 3); g.strokePath();
    g.setAlpha(0.95);
    this.scene.tweens.add({
      targets: g, y: '-=16', alpha: 0, duration: 620, ease: 'Quad.out',
      onComplete: () => g.destroy(),
    });
  }

  /** A floating "+x%" that rises and fades (juice on each merge / shield change). */
  private floatPct(): void {
    const t = this.scene.add.text(this.x, this.y - 34, `+${this.mergeTiers * 15}%`, {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffd23f', stroke: '#7a5a00', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20);
    this.scene.tweens.add({ targets: t, y: t.y - 22, alpha: 0, duration: 700, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  destroyAll(): void {
    this.idleTween?.stop();
    this.scene.tweens.killTweensOf(this);
    this.bubble?.destroy();
    this.ring.destroy();
    this.turret?.destroy();
    this.mergeRingTween?.stop();
    this.mergeGround?.destroy(); // destroys its child ring graphics too
    this.mergeGlow?.destroy();
    this.mergePct?.destroy();
    this.lvLabel?.destroy();
    this.ultRing?.destroy();
    this.ultFront?.destroy();
    this.ultGlow?.destroy();
    this.ultLabel?.destroy();
    for (const s of this.shieldIcons) s.destroy();
    this.orbTween?.stop();
    for (const o of this.orbs) o.destroy();
    this.orbRing?.destroy();
    this.auraPulseTimer?.remove();
    this.destroy();
  }
}
