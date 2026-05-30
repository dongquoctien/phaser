import Phaser from 'phaser';
import { Pipe } from '../objects/Pipe';
import { GAME_WIDTH, GAME_HEIGHT, Tuning } from '../config';

// Manages the pool of pipes and spawns gap-pairs on a timer. Pooling keeps the
// game allocation-free in the hot path — pipes are recycled, never destroyed.
export class PipePool {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene) {
    this.group = scene.physics.add.group({
      classType: Pipe,
      maxSize: 12, // 6 pairs on screen is plenty for this spacing
      runChildUpdate: true,
    });

    // Pre-allocate so the first spawn never hitches.
    for (let i = 0; i < 12; i++) {
      const pipe = new Pipe(scene);
      scene.add.existing(pipe);
      this.group.add(pipe);
      pipe.despawn();
    }
  }

  spawnPair(): void {
    const margin = 60;
    const groundY = GAME_HEIGHT - Tuning.groundHeight;
    const gapY = Phaser.Math.Between(
      margin + Tuning.pipeGap / 2,
      groundY - margin - Tuning.pipeGap / 2,
    );
    const x = GAME_WIDTH + 30;

    // Spawn the TOP pipe first — spawnAt() activates it, so the next
    // getFirstDead() returns a DIFFERENT pipe for the bottom. (Calling
    // getFirstDead twice in a row returns the SAME dead pipe, which made the
    // top pipe get overwritten by the bottom — only the bottom showed.)
    const top = this.group.getFirstDead(false) as Pipe | null;
    if (!top) return; // pool exhausted
    top.spawnAt(x, gapY, true);

    const bottom = this.group.getFirstDead(false) as Pipe | null;
    if (!bottom) return;
    bottom.spawnAt(x, gapY, false);
  }

  reset(): void {
    this.group.getChildren().forEach((c) => (c as Pipe).despawn());
  }
}
