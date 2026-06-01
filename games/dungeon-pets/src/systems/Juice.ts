import Phaser from 'phaser';

// Reusable "game feel" helpers (see .claude/skills/game-design §3). Everything is
// POOLED so juicing a 5-enemy wave stays 60fps (phaser-perf-audit). Magnitudes
// follow the skill's table: shake 2–5px, hit-stop 2–8 frames, damage float ~24px
// over 0.6–1.2s, particle burst 5–20 dots.

const NUM_POOL = 48;
const DOT_POOL = 120;

export class Juice {
  private scene: Phaser.Scene;
  private numbers: Phaser.GameObjects.Text[] = [];
  private dots: Phaser.GameObjects.Arc[] = [];
  private numIdx = 0;
  private dotIdx = 0;

  // Hit-stop: a global timestamp the game loop checks. While now < frozenUntil the
  // scene's own update() skips its simulation (but the camera shake/tweens still
  // run — we DON'T scene.pause(), which would kill those).
  frozenUntil = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    for (let i = 0; i < NUM_POOL; i++) {
      const t = scene.add.text(0, 0, '', {
        fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#1a1020', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(70).setActive(false).setVisible(false);
      this.numbers.push(t);
    }
    for (let i = 0; i < DOT_POOL; i++) {
      const d = scene.add.circle(0, 0, 3, 0xffffff).setDepth(22).setActive(false).setVisible(false);
      this.dots.push(d);
    }
  }

  /** Floating damage number. Crit = bigger + gold; normal = white. */
  damageNumber(x: number, y: number, amount: number, crit: boolean): void {
    const t = this.numbers[this.numIdx];
    this.numIdx = (this.numIdx + 1) % NUM_POOL;
    this.scene.tweens.killTweensOf(t);
    t.setText(fmtDmg(amount))
      .setPosition(x + Phaser.Math.Between(-6, 6), y - 10)
      .setColor(crit ? '#ffd23f' : '#ffffff')
      .setFontSize(crit ? 22 : 15)
      .setScale(1).setAlpha(1)
      .setActive(true).setVisible(true);
    this.scene.tweens.add({
      targets: t,
      y: t.y - (crit ? 36 : 24),
      alpha: 0,
      scale: crit ? 1.2 : 1,
      duration: crit ? 850 : 650,
      ease: 'Quad.easeOut',
      onComplete: () => t.setActive(false).setVisible(false),
    });
  }

  /** Burst of `count` pooled dots flying outward from (x,y), fading out. */
  burst(x: number, y: number, color: number, count = 8, speed = 120): void {
    for (let i = 0; i < count; i++) {
      const d = this.dots[this.dotIdx];
      this.dotIdx = (this.dotIdx + 1) % DOT_POOL;
      this.scene.tweens.killTweensOf(d);
      const a = Math.random() * Math.PI * 2;
      const dist = speed * (0.4 + Math.random() * 0.8);
      d.setPosition(x, y).setFillStyle(color).setRadius(Phaser.Math.Between(2, 4))
        .setScale(1).setAlpha(1).setActive(true).setVisible(true);
      this.scene.tweens.add({
        targets: d,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        alpha: 0, scale: 0.3,
        duration: 200 + Math.random() * 180,
        ease: 'Quad.easeOut',
        onComplete: () => d.setActive(false).setVisible(false),
      });
    }
  }

  /** A single faint fading dot left behind a fast projectile (§3 trail). */
  trail(x: number, y: number, color: number): void {
    const d = this.dots[this.dotIdx];
    this.dotIdx = (this.dotIdx + 1) % DOT_POOL;
    this.scene.tweens.killTweensOf(d);
    d.setPosition(x, y).setFillStyle(color).setRadius(3).setScale(1).setAlpha(0.5)
      .setActive(true).setVisible(true);
    this.scene.tweens.add({
      targets: d, alpha: 0, scale: 0.3, duration: 160, ease: 'Quad.easeOut',
      onComplete: () => d.setActive(false).setVisible(false),
    });
  }

  /** Camera shake scaled by impact (0..1). Skill: 2–5px ≈ intensity 0.004–0.01. */
  shake(impact: number): void {
    const i = Phaser.Math.Clamp(impact, 0, 1);
    this.scene.cameras.main.shake(80 + i * 90, 0.003 + i * 0.008);
  }

  /** Hit-stop: freeze the sim for `frames` (~16.7ms each). Scale by impact. */
  hitStop(frames: number, now: number): void {
    this.frozenUntil = Math.max(this.frozenUntil, now + frames * 16.7);
  }

  get frozen(): boolean {
    return this.scene.time.now < this.frozenUntil;
  }
}

function fmtDmg(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}
