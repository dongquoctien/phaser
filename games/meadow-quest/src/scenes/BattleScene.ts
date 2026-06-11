import Phaser from 'phaser';
import { SceneKeys, CharKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// ── Battle (STUB) ────────────────────────────────────────────────────────────
// Placeholder for the turn-based combat built in the next PR. For now it proves
// the overworld→battle→overworld loop end to end: it shows the party vs the
// monster on a battle backdrop with the Attack/Skill/Item/Retreat menu from the
// reference screenshot, and any choice returns to the field (resuming GameScene).
//
// Launched via scene.launch(Battle, {...}) while GameScene is paused; it calls
// scene.resume(Game) + scene.stop(self) to hand control back.
const MENU = ['Attack', 'Skill', 'Item', 'Retreat'] as const;

export class BattleScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Battle);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    // backdrop — sky over meadow, matching the reference battle screen
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x6fb7e0).setDepth(0);
    this.add.rectangle(cx, GAME_HEIGHT * 0.72, GAME_WIDTH, GAME_HEIGHT * 0.56, 0x6fc04a).setDepth(0);

    // enemy (left) and the party (right), echoing the screenshot layout
    this.add.sprite(GAME_WIDTH * 0.26, GAME_HEIGHT * 0.5, CharKeys.MobWalker, 6)
      .setScale(0.6).setFlipX(true).setDepth(2);
    const party = [CharKeys.Rem, CharKeys.Hollis, CharKeys.Moz];
    party.forEach((k, i) => {
      this.add.sprite(GAME_WIDTH * (0.66 + i * 0.1), GAME_HEIGHT * (0.46 + i * 0.04), k)
        .setScale(0.8).setDepth(2 + i);
    });

    this.add.text(cx, 22, 'A wild monster appeared!', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', stroke: '#143a52', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    this.buildMenu();

    // keyboard: any of A/S/I/R or number keys, Esc = retreat
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
  }

  private buildMenu(): void {
    // command box bottom-left, like the reference
    const x = 14, y0 = GAME_HEIGHT - 16 - MENU.length * 26;
    MENU.forEach((label, i) => {
      const y = y0 + i * 26;
      const box = this.add.rectangle(x, y, 110, 22, 0x12324a, 0.92)
        .setOrigin(0, 0).setStrokeStyle(2, 0x49a7e0).setDepth(10)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(x + 12, y + 4, label, {
        fontFamily: 'monospace', fontSize: '13px', color: '#eaf6ff',
      }).setDepth(11);
      box.on('pointerover', () => box.setFillStyle(0x1d4e72, 0.95));
      box.on('pointerout', () => box.setFillStyle(0x12324a, 0.92));
      box.on('pointerup', () => this.finish());
      void txt;
    });

    this.add.text(GAME_WIDTH - 8, GAME_HEIGHT - 6,
      'STUB — any command returns to the meadow (full combat next PR)', {
      fontFamily: 'monospace', fontSize: '8px', color: '#cdeaff',
    }).setOrigin(1, 1).setDepth(11);
  }

  /** End the battle: flash, then resume the overworld and stop this scene. */
  private finish(): void {
    this.cameras.main.fade(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.resume(SceneKeys.Game);
      this.scene.stop();
    });
  }
}
