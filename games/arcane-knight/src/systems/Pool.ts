import Phaser from 'phaser';

/**
 * Generic object pool over a Phaser Group. Recycles game objects instead of
 * creating/destroying them every frame — the single biggest source of GC
 * stutter in action games.
 *
 * Usage:
 *   const bullets = new Pool(scene, Bullet, 64);
 *   const b = bullets.spawn(x, y);   // null if pool exhausted (cap respected)
 *   bullets.despawn(b);              // returns it for reuse
 *
 * The item class must extend a Phaser GameObject and implement reset/sleep
 * (see PooledSprite for a ready base).
 */
export interface Poolable extends Phaser.GameObjects.GameObject {
  spawn(x: number, y: number): void;
  despawn(): void;
}

export class Pool<T extends Poolable> {
  private group: Phaser.GameObjects.Group;

  constructor(
    scene: Phaser.Scene,
    classType: new (scene: Phaser.Scene) => T,
    initialSize: number,
    maxSize = initialSize,
  ) {
    this.group = scene.add.group({
      classType,
      maxSize,
      runChildUpdate: true, // calls preUpdate on active children
    });

    // Pre-allocate so the first spawn never hitches.
    for (let i = 0; i < initialSize; i++) {
      const obj = new classType(scene) as T;
      scene.add.existing(obj);
      obj.despawn();
      this.group.add(obj);
    }
  }

  spawn(x: number, y: number): T | null {
    const obj = this.group.getFirstDead(false) as T | null;
    if (!obj) return null; // pool exhausted — caller decides what to do
    obj.spawn(x, y);
    return obj;
  }

  despawn(obj: T): void {
    obj.despawn();
  }

  get group_(): Phaser.GameObjects.Group {
    return this.group; // expose for physics colliders/overlap
  }
}
