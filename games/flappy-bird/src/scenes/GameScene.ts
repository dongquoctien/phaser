import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, RegistryKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, Tuning } from '../config';
import { Bird } from '../objects/Bird';
import { Pipe } from '../objects/Pipe';
import { PipePool } from '../systems/PipePool';
import { Audio } from '../systems/Audio';

export class GameScene extends Phaser.Scene {
  private bird!: Bird;
  private pipes!: PipePool;
  private ground!: Phaser.GameObjects.TileSprite;
  private scoreText!: Phaser.GameObjects.Text;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private audio!: Audio;
  private score = 0;
  private over = false;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.score = 0;
    this.over = false;
    this.audio = new Audio(this);

    const groundY = GAME_HEIGHT - Tuning.groundHeight;

    // Scrolling ground (TileSprite scrolls cheaply, one draw call).
    this.ground = this.add
      .tileSprite(0, groundY, GAME_WIDTH, Tuning.groundHeight, TextureKeys.Ground)
      .setOrigin(0, 0)
      .setDepth(10);
    this.physics.add.existing(this.ground, true); // static body

    // World bounds stop at the ground so the bird can die on it.
    this.physics.world.setBounds(0, 0, GAME_WIDTH, groundY);

    this.bird = new Bird(this, GAME_WIDTH * 0.3, GAME_HEIGHT * 0.4);
    this.bird.setDepth(5);

    this.pipes = new PipePool(this);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 60, '0', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#ffffff',
        stroke: '#0d3b3e',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(20);

    // Collisions: pipes and ground both kill the bird.
    this.physics.add.collider(this.bird, this.pipes.group, this.die, undefined, this);
    this.physics.add.collider(this.bird, this.ground, this.die, undefined, this);

    // Input
    this.input.on('pointerdown', this.flap, this);
    this.input.keyboard?.on('keydown-SPACE', this.flap, this);

    // Pipe spawner
    this.spawnTimer = this.time.addEvent({
      delay: Tuning.pipeSpacing,
      loop: true,
      callback: () => this.pipes.spawnPair(),
    });
    this.pipes.spawnPair(); // first pair immediately

    // Clean everything up on shutdown — no leaked listeners/timers across runs.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  private flap(): void {
    if (this.over) return;
    this.bird.flap();
    this.audio.play(AudioKeys.Flap);
  }

  update(): void {
    if (this.over) return;

    // Scroll ground.
    this.ground.tilePositionX -= (Tuning.pipeSpeed * -1) * (this.game.loop.delta / 1000);

    // Scoring: award a point when the bird passes a scoring pipe.
    this.pipes.group.getChildren().forEach((obj) => {
      const pipe = obj as Pipe;
      if (
        pipe.active &&
        pipe.scoring &&
        !pipe.scored &&
        pipe.x + pipe.displayWidth < this.bird.x
      ) {
        pipe.scored = true;
        this.addScore();
      }
    });
  }

  private addScore(): void {
    this.score += 1;
    this.scoreText.setText(String(this.score));
    this.audio.play(AudioKeys.Score);
  }

  private die(): void {
    if (this.over) return;
    this.over = true;
    this.audio.play(AudioKeys.Hit);
    this.bird.kill();
    this.spawnTimer?.remove();
    this.pipes.group.setVelocityX(0);

    // Persist best score.
    const best = (this.registry.get(RegistryKeys.Best) as number) ?? 0;
    if (this.score > best) this.registry.set(RegistryKeys.Best, this.score);

    this.cameras.main.shake(200, 0.01);
    this.cameras.main.flash(120, 255, 255, 255);

    this.time.delayedCall(900, () => this.scene.start(SceneKeys.Menu));
  }

  private cleanup(): void {
    this.spawnTimer?.remove();
    this.input.off('pointerdown', this.flap, this);
    this.input.keyboard?.off('keydown-SPACE', this.flap, this);
  }
}
