import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';

// The actual gameplay scene. This template is intentionally minimal — wire up
// your pools (systems/Pool.ts), objects, and systems here.
//
// Lifecycle reminders ("pro" hygiene):
//  - Create pools/colliders in create(), not update().
//  - Register cleanup in shutdown(): remove timers, tweens, and event listeners
//    so restarting the scene doesn't leak or double-fire.
export class GameScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.add
      .text(8, 8, 'GameScene — start building here', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9aa0ff',
      })
      .setScrollFactor(0);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  update(_time: number, _deltaMs: number): void {
    // Game loop. Keep allocations out of here (no `new` in the hot path).
  }

  private cleanup(): void {
    // this.tweens.killAll();
    // this.time.removeAllEvents();
    // remove custom input/event listeners registered in create()
  }
}
