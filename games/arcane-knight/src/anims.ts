// Register every animation from the baked single-frame textures. Phaser anims can
// reference different texture KEYS per frame (each baked sprite is its own texture),
// so we build frame lists from Tex keys. Call once after bakeArt.
import Phaser from 'phaser';
import { Tex, Anim } from './types/keys';

const f = (key: string) => ({ key }); // a frame that is a whole single-texture

export function createAnims(scene: Phaser.Scene): void {
  const make = (key: string, frames: string[], frameRate: number, repeat = -1) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({ key, frames: frames.map(f), frameRate, repeat });
  };

  make(Anim.WarIdle, [Tex.WarIdle0, Tex.WarIdle1], 2);
  make(Anim.WarWalk, [Tex.WarWalk0, Tex.WarWalk1, Tex.WarWalk2, Tex.WarWalk3], 10);
  make(Anim.WarAtk, [Tex.WarAtk0, Tex.WarAtk1], 14, 0);

  make(Anim.MagIdle, [Tex.MagIdle0, Tex.MagIdle1], 2);
  make(Anim.MagWalk, [Tex.MagWalk0, Tex.MagWalk1, Tex.MagWalk2, Tex.MagWalk3], 10);
  make(Anim.MagCast, [Tex.MagCast0, Tex.MagCast1], 12, 0);

  make(Anim.SlimeMove, [Tex.Slime0, Tex.Slime1], 4);
  make(Anim.BatFly, [Tex.Bat0, Tex.Bat1], 8);
  make(Anim.SkelWalk, [Tex.Skeleton0, Tex.Skeleton1], 5);
  make(Anim.BossMove, [Tex.Boss0, Tex.Boss1], 3);
}
