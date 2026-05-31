import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, RegistryKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, Tuning } from '../config';
import { Hook } from '../objects/Hook';
import { LootField } from '../systems/LootField';
import { Audio } from '../systems/Audio';

export class GameScene extends Phaser.Scene {
  private hook!: Hook;
  private field!: LootField;
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private audio!: Audio;
  private score = 0;
  private timeLeft = Tuning.roundTime;
  private over = false;
  private timer?: Phaser.Time.TimerEvent;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.score = 0;
    this.timeLeft = Tuning.roundTime;
    this.over = false;
    this.audio = new Audio(this);

    // Miner sits centered just above the hook pivot (its feet at the pivot, so the
    // rope visually starts from the miner). The HUD row lives above the miner.
    this.add
      .image(GAME_WIDTH / 2, Tuning.hookOriginY, TextureKeys.Miner)
      .setOrigin(0.5, 1)
      .setScale(3)
      .setDepth(6);
    // Cavern floor line just below the pivot.
    this.add
      .rectangle(0, Tuning.hookOriginY + 6, GAME_WIDTH, 4, 0x1a1c2c)
      .setOrigin(0, 0);

    this.field = new LootField(this);
    this.field.populate();
    this.hook = new Hook(this);

    // HUD
    this.scoreText = this.add
      .text(10, 8, 'GOLD 0', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffcd75',
        stroke: '#1a1c2c',
        strokeThickness: 3,
      })
      .setDepth(20);
    this.timeText = this.add
      .text(GAME_WIDTH - 10, 8, `0:${Tuning.roundTime}`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#73eff7',
        stroke: '#1a1c2c',
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setDepth(20);
    this.add
      .text(GAME_WIDTH / 2, 10, `TARGET ${Tuning.targetScore}`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#a7f070',
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    // Input: drop the hook.
    this.input.on('pointerdown', this.drop, this);
    this.input.keyboard?.on('keydown-SPACE', this.drop, this);

    // Round countdown.
    this.timer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.over) return;
        this.timeLeft -= 1;
        this.updateTimeText();
        if (this.timeLeft <= 0) this.endRound();
      },
    });
    this.updateTimeText();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  private drop(): void {
    if (this.over) return;
    if (this.hook.state === 'swing') this.audio.play(AudioKeys.Drop);
    this.hook.drop();
  }

  update(_time: number, deltaMs: number): void {
    if (this.over) return;

    const result = this.hook.update(deltaMs);

    // While extending, try to grab loot at the tip.
    if (this.hook.state === 'extend' && !this.hook.carried) {
      const loot = this.field.grabAt(this.hook.tipX, this.hook.tipY);
      if (loot) {
        this.hook.grab(loot);
        this.audio.play(AudioKeys.Grab);
      }
    }

    // On return, score and recycle whatever came back.
    if (result === 'returned') {
      const loot = this.hook.release();
      if (loot) {
        this.audio.play(AudioKeys.Score);
        this.addScore(loot.value);
        loot.despawn();
      }
    }
  }

  private addScore(n: number): void {
    this.score += n;
    this.scoreText.setText(`GOLD ${this.score}`);
    if (this.score >= Tuning.targetScore && !this.over) this.endRound();
  }

  private updateTimeText(): void {
    const t = Math.max(0, this.timeLeft);
    this.timeText.setText(`0:${t.toString().padStart(2, '0')}`);
  }

  private endRound(): void {
    if (this.over) return;
    this.over = true;
    this.timer?.remove();

    const best = (this.registry.get(RegistryKeys.Best) as number) ?? 0;
    if (this.score > best) this.registry.set(RegistryKeys.Best, this.score);

    const won = this.score >= Tuning.targetScore;
    if (won) this.audio.play(AudioKeys.Win);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, won ? 'CLEARED!' : 'TIME UP', {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: won ? '#a7f070' : '#b13e53',
        stroke: '#1a1c2c',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.time.delayedCall(1600, () => this.scene.start(SceneKeys.Menu));
  }

  private cleanup(): void {
    this.timer?.remove();
    this.input.off('pointerdown', this.drop, this);
    this.input.keyboard?.off('keydown-SPACE', this.drop, this);
  }
}
