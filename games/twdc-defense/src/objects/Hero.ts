import Phaser from 'phaser';
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
  // ── merge state ── each merge adds +3% damage AND a gold-shield tier (max 3).
  // A boss hit consumes one shield tier (hero survives, loses that tier's bonus).
  mergeTiers = 0;
  dragging = false; // true while being dragged for a merge
  private nextFireAt = 0;
  private turret: Phaser.GameObjects.Image | null = null; // none for now; heroes face forward
  private ring: Phaser.GameObjects.Arc;
  private baseScale = 1; // resting scale; all anims tween RELATIVE to this
  private facing = 1; // +1 right, -1 left (flipX). attack lunges along this axis.
  private idleTween?: Phaser.Tweens.Tween;
  private bubble?: Phaser.GameObjects.Container; // active speech bubble (one at a time)
  private nextChatterAt = 0; // rate-limit attack chatter so it doesn't spam
  // merge visuals
  private mergeAura?: Phaser.GameObjects.Particles.ParticleEmitter; // fiery power-up aura
  private mergeGlow?: Phaser.GameObjects.Arc;      // pulsing glow disc at the feet
  private mergePct?: Phaser.GameObjects.Text;     // "+x%" label below the hero
  private shieldPips: Phaser.GameObjects.Arc[] = []; // gold shield dots above the hero

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
    this.chatter('place'); // greet on placement
    // selection ring (hidden until selected)
    this.ring = scene.add.circle(x, y, def.tiers[0].range, Phaser.Display.Color.HexStringToColor(def.tint).color, 0.1)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(def.tint).color, 0.5)
      .setDepth(9).setVisible(false);
    // a small "Lv" pip baked into depth via tint pop on upgrade
  }

  get stats(): HeroTier { return this.def.tiers[this.tier]; }
  get canUpgrade(): boolean { return this.tier < this.def.tiers.length - 1; }
  get nextUpgradeCost(): number { return this.canUpgrade ? this.def.tiers[this.tier + 1].cost : 0; }
  /** True once the hero is fully upgraded (the only state that may be merged). */
  get isMaxLevel(): boolean { return this.tier >= this.def.tiers.length - 1; }
  /** Damage multiplier from merges: +3% per merge tier (max 3 → +9%). */
  get mergeMult(): number { return 1 + 0.03 * this.mergeTiers; }
  get hasShield(): boolean { return this.mergeTiers > 0; }

  /** Returns a FireIntent when ready to act this frame, else null. */
  update(time: number, zombies: Zombie[]): FireIntent | null {
    if (time < this.nextFireAt) return null;
    const s = this.stats;

    if (this.def.attack === 'aura' || this.def.attack === 'nova') {
      // radius effects fire on cooldown regardless of a specific target, but
      // nova should only bother if something is in range.
      if (this.def.attack === 'nova') {
        const any = zombies.some((z) => !z.dead && !z.dying && Phaser.Math.Distance.Between(z.x, z.y, this.x, this.y) <= s.range);
        if (!any) return null;
      }
      this.nextFireAt = time + s.fireInterval;
      this.playAttack(0); // aura/nova: small forward pulse, no specific direction
      return { target: null, angle: 0 };
    }

    // projectile / melee: target the FRONT-most zombie in range
    const target = this.frontTargetInRange(zombies, s.range);
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
    this.ring.setRadius(this.stats.range);
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
    this.ring.setRadius(this.stats.range).setVisible(on);
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

  /** Apply one merge: +1 tier (so +3% more damage), refresh visuals, pop FX.
   *  No-op past 3 tiers. Returns true if it actually merged. */
  mergeOnce(): boolean {
    if (this.mergeTiers >= 3) return false;
    this.mergeTiers += 1;
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

  /** Boss hit lands on a shielded hero: pop one shield tier (lose its +3% too).
   *  Returns true if a shield absorbed the hit (hero survives). */
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

  /** Rebuild the fiery aura + shield pips + "+x%" label for the current tier count. */
  private refreshMergeVisuals(): void {
    // fiery "fused" aura: a pulsing glow ring under the hero + rising flame sparks.
    // Colour/intensity ramps with merge tiers so a 3-stack reads as much hotter.
    if (this.mergeTiers > 0) {
      const ringCol = [0xffd23f, 0xff8c3b, 0xff5b3b][Math.min(this.mergeTiers - 1, 2)];
      if (!this.mergeGlow) {
        // glow disc at the feet — always-visible "power-up" base
        this.mergeGlow = this.scene.add.circle(this.x, this.y + 8, 20, ringCol, 0.35).setDepth(8);
        this.scene.tweens.add({ targets: this.mergeGlow, scale: 1.25, alpha: 0.55, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      this.mergeGlow.setFillStyle(ringCol, 0.4).setRadius(18 + this.mergeTiers * 4);
      if (!this.mergeAura) {
        this.mergeAura = this.scene.add.particles(this.x, this.y + 6, 'spark', {
          speed: { min: 14, max: 40 }, angle: { min: 245, max: 295 }, lifespan: 620,
          scale: { start: 1.3, end: 0 }, alpha: { start: 0.95, end: 0 }, frequency: 45,
          tint: [0xffe066, 0xffd23f, 0xff8c3b, 0xff5b3b], blendMode: 'ADD',
        }).setDepth(10);
      }
      this.mergeAura.frequency = Math.max(20, 60 - this.mergeTiers * 13); // denser per tier
      this.setTint(0xfff0c0); // warm glow on the hero sprite itself
    } else {
      this.mergeAura?.destroy(); this.mergeAura = undefined;
      this.mergeGlow?.destroy(); this.mergeGlow = undefined;
      this.clearTint();
    }
    // shield pips (gold dots) above the head — one per tier
    for (const p of this.shieldPips) p.destroy();
    this.shieldPips = [];
    for (let i = 0; i < this.mergeTiers; i++) {
      const px = this.x - (this.mergeTiers - 1) * 5 + i * 10;
      const pip = this.scene.add.circle(px, this.y - 30, 3.5, 0xffd23f).setStrokeStyle(1, 0x7a5a00).setDepth(12);
      this.shieldPips.push(pip);
    }
    // persistent "+x%" label below the feet
    const pct = this.mergeTiers * 3;
    if (pct > 0) {
      if (!this.mergePct) {
        this.mergePct = this.scene.add.text(this.x, this.y + 18, '', {
          fontFamily: 'monospace', fontSize: '10px', color: '#ffd23f', stroke: '#1a1c2c', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(12);
      }
      this.mergePct.setText(`+${pct}%`);
    } else if (this.mergePct) {
      this.mergePct.destroy(); this.mergePct = undefined;
    }
  }

  /** A floating "+x%" that rises and fades (juice on each merge / shield change). */
  private floatPct(): void {
    const t = this.scene.add.text(this.x, this.y - 34, `+${this.mergeTiers * 3}%`, {
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
    this.mergeAura?.destroy();
    this.mergeGlow?.destroy();
    this.mergePct?.destroy();
    for (const p of this.shieldPips) p.destroy();
    this.destroy();
  }
}
