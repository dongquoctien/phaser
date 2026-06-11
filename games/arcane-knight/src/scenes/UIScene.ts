import Phaser from 'phaser';
import { SceneKeys, Tex } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// HUD overlay launched on top of GameScene. Shows hearts + level name, a boss HP
// bar when a boss is active, and on-screen touch controls. Communicates with
// GameScene via game-level events (ak-hud / ak-boss / ak-touch / ak-jump / ak-atk).
export class UIScene extends Phaser.Scene {
  private hearts: Phaser.GameObjects.Image[] = [];
  private levelText!: Phaser.GameObjects.Text;
  private bossBar?: Phaser.GameObjects.Graphics;

  constructor() { super({ key: SceneKeys.UI }); }

  create(): void {
    this.hearts = [];
    for (let i = 0; i < 5; i++) {
      this.hearts.push(this.add.image(12 + i * 16, 12, Tex.Heart).setOrigin(0, 0).setScale(1).setScrollFactor(0));
    }
    this.levelText = this.add.text(GAME_WIDTH - 8, 10, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffcd75',
    }).setOrigin(1, 0).setScrollFactor(0);

    this.game.events.on('ak-hud', this.onHud, this);
    this.game.events.on('ak-boss', this.onBoss, this);

    this.buildTouch();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('ak-hud', this.onHud, this);
      this.game.events.off('ak-boss', this.onBoss, this);
    });
  }

  private onHud(d: { hp: number; level: string }): void {
    this.hearts.forEach((h, i) => h.setAlpha(i < d.hp ? 1 : 0.18));
    this.levelText.setText(d.level);
  }

  private onBoss(d: { hp: number; max: number }): void {
    if (!this.bossBar) this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(20);
    const g = this.bossBar, w = 200, x = (GAME_WIDTH - w) / 2, y = GAME_HEIGHT - 18;
    g.clear();
    g.fillStyle(0x10131f, 0.8).fillRoundedRect(x - 3, y - 3, w + 6, 12, 3);
    g.fillStyle(0x331018, 1).fillRect(x, y, w, 7);
    g.fillStyle(0xb13e53, 1).fillRect(x, y, w * Phaser.Math.Clamp(d.hp / d.max, 0, 1), 7);
    this.add.text(GAME_WIDTH / 2, y - 12, 'DEMON LORD', {
      fontFamily: 'monospace', fontSize: '9px', color: '#ff8a8a',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20).setData('bosslabel', true);
  }

  private buildTouch(): void {
    // only show on touch devices; harmless on desktop (sits in corners)
    if (!this.sys.game.device.input.touch) return;
    const mk = (x: number, y: number, label: string, on: () => void, off?: () => void) => {
      const c = this.add.circle(x, y, 22, 0xffffff, 0.14).setScrollFactor(0).setDepth(30).setInteractive();
      this.add.text(x, y, label, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
      c.on('pointerdown', on); if (off) { c.on('pointerup', off); c.on('pointerout', off); }
    };
    const bottom = GAME_HEIGHT - 30;
    mk(28, bottom, '◄', () => this.game.events.emit('ak-touch', { left: true }), () => this.game.events.emit('ak-touch', { left: false }));
    mk(70, bottom, '►', () => this.game.events.emit('ak-touch', { right: true }), () => this.game.events.emit('ak-touch', { right: false }));
    mk(GAME_WIDTH - 70, bottom, 'A', () => this.game.events.emit('ak-atk'));
    mk(GAME_WIDTH - 28, bottom, '▲', () => this.game.events.emit('ak-jump'));
  }
}
