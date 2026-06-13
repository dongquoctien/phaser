import Phaser from 'phaser';
import { SceneKeys, Tex, Reg, Ev } from '../types/keys';
import { GAME_WIDTH } from '../config';
import { addFullscreenButton } from '../systems/FullscreenButton';

// Overlay HUD, launched in parallel with GameScene. Renders the score, star
// count and lives. Reads initial values from the registry and updates on the
// game-level events emitted by GameScene (decoupled — the HUD never reaches
// into gameplay objects).
export class HudScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private starText!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Image[] = [];

  constructor() {
    super(SceneKeys.Hud);
  }

  create(): void {
    // Score (top-left).
    this.add.image(10, 12, Tex.Coin).setScale(1).setScrollFactor(0);
    this.scoreText = this.add
      .text(20, 6, '0', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' })
      .setScrollFactor(0)
      .setShadow(1, 1, '#000000', 2);

    // Star count (top-left, second row).
    this.add.image(10, 28, Tex.Star).setScrollFactor(0);
    this.starText = this.add
      .text(20, 22, '0', { fontFamily: 'monospace', fontSize: '12px', color: '#ffd23f' })
      .setScrollFactor(0)
      .setShadow(1, 1, '#000000', 2);

    // Lives (top-right hearts).
    this.rebuildHearts((this.registry.get(Reg.Lives) as number) ?? 3);

    // Fullscreen toggle, top-right second row (below the hearts).
    addFullscreenButton(this, { x: GAME_WIDTH - 12, y: 30, depth: 1001 });

    this.scoreText.setText(String(this.registry.get(Reg.Score) ?? 0));
    this.starText.setText(String(this.registry.get(Reg.Stars) ?? 0));

    const ge = this.game.events;
    const onScore = (v: number) => this.scoreText.setText(String(v));
    const onStars = (v: number) => this.starText.setText(String(v));
    const onLives = (v: number) => this.rebuildHearts(v);
    ge.on(Ev.ScoreChanged, onScore);
    ge.on(Ev.StarsChanged, onStars);
    ge.on(Ev.LivesChanged, onLives);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      ge.off(Ev.ScoreChanged, onScore);
      ge.off(Ev.StarsChanged, onStars);
      ge.off(Ev.LivesChanged, onLives);
    });
  }

  private rebuildHearts(n: number): void {
    this.hearts.forEach((h) => h.destroy());
    this.hearts = [];
    for (let i = 0; i < Math.max(0, n); i++) {
      const img = this.add
        .image(GAME_WIDTH - 12 - i * 12, 12, Tex.Heart)
        .setScrollFactor(0)
        .setScale(1);
      this.hearts.push(img);
    }
  }
}
