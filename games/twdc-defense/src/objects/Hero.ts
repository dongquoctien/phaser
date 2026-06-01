import Phaser from 'phaser';
import { HEROES, type HeroId, type HeroDef, type HeroTier } from '../types/roster';
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
  tier = 0;
  private nextFireAt = 0;
  private turret: Phaser.GameObjects.Image | null = null; // none for now; heroes face forward
  private ring: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, id: HeroId, col: number, row: number, x: number, y: number) {
    const def = HEROES[id];
    super(scene, x, y, def.tex);
    this.heroId = id;
    this.def = def;
    this.col = col;
    this.row = row;
    // hero sprites are the user's full-res PNGs (~330px tall) — scale to fit a pad.
    const targetH = 38;
    const srcH = this.height || targetH;
    this.setDepth(11).setScale(targetH / srcH);
    this.setOrigin(0.5, 0.62); // feet sit a touch below centre on the pad
    scene.add.existing(this);
    // selection ring (hidden until selected)
    this.ring = scene.add.circle(x, y, def.tiers[0].range, Phaser.Display.Color.HexStringToColor(def.tint).color, 0.1)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(def.tint).color, 0.5)
      .setDepth(9).setVisible(false);
    // a small "Lv" pip baked into depth via tint pop on upgrade
  }

  get stats(): HeroTier { return this.def.tiers[this.tier]; }
  get canUpgrade(): boolean { return this.tier < this.def.tiers.length - 1; }
  get nextUpgradeCost(): number { return this.canUpgrade ? this.def.tiers[this.tier + 1].cost : 0; }

  /** Returns a FireIntent when ready to act this frame, else null. */
  update(time: number, zombies: Zombie[]): FireIntent | null {
    if (time < this.nextFireAt) return null;
    const s = this.stats;

    if (this.def.attack === 'aura' || this.def.attack === 'nova') {
      // radius effects fire on cooldown regardless of a specific target, but
      // nova should only bother if something is in range.
      if (this.def.attack === 'nova') {
        const any = zombies.some((z) => !z.dead && Phaser.Math.Distance.Between(z.x, z.y, this.x, this.y) <= s.range);
        if (!any) return null;
      }
      this.nextFireAt = time + s.fireInterval;
      return { target: null, angle: 0 };
    }

    // projectile / melee: target the FRONT-most zombie in range
    const target = this.frontTargetInRange(zombies, s.range);
    if (!target) return null;
    this.nextFireAt = time + s.fireInterval;
    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    this.setFlipX(Math.cos(angle) < 0); // face the target
    return { target, angle };
  }

  /** All live zombies within `range` (for cleave/nova/aura). */
  inRange(zombies: Zombie[], range: number): Zombie[] {
    return zombies.filter((z) => !z.dead && Phaser.Math.Distance.Between(z.x, z.y, this.x, this.y) <= range);
  }

  private frontTargetInRange(zombies: Zombie[], range: number): Zombie | null {
    let best: Zombie | null = null;
    let bestProg = -1;
    for (const z of zombies) {
      if (z.dead) continue;
      if (Phaser.Math.Distance.Between(z.x, z.y, this.x, this.y) > range) continue;
      if (z.progress > bestProg) { bestProg = z.progress; best = z; }
    }
    return best;
  }

  upgrade(): void {
    if (!this.canUpgrade) return;
    this.tier += 1;
    this.ring.setRadius(this.stats.range);
    this.scene.tweens.add({ targets: this, scale: 1.18, duration: 90, yoyo: true });
  }

  setSelected(on: boolean): void {
    this.ring.setRadius(this.stats.range).setVisible(on);
  }

  destroyAll(): void {
    this.ring.destroy();
    this.turret?.destroy();
    this.destroy();
  }
}
