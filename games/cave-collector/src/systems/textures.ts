import Phaser from 'phaser';
import { Tex, Anim } from '../types/keys';

// Art is now loaded from sliced atlases (see scripts/cut-g1.mjs + PreloadScene).
// This module only registers the animations that index into those atlas frames.
//
// Hero atlas frame layout (from the g1 hero sheet, in sheet order):
//   0-3   idle
//   4-9   run
//   10-12 jump (crouch, launch, fall)
//   13-15 punch
export function registerAnims(scene: Phaser.Scene): void {
  const a = scene.anims;
  if (a.exists(Anim.HeroIdle)) return;

  a.create({ key: Anim.HeroIdle, frames: a.generateFrameNames(Tex.Hero, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
  a.create({ key: Anim.HeroRun, frames: a.generateFrameNames(Tex.Hero, { start: 4, end: 9 }), frameRate: 12, repeat: -1 });
  a.create({ key: Anim.HeroJump, frames: a.generateFrameNames(Tex.Hero, { start: 10, end: 12 }), frameRate: 8, repeat: 0 });
  a.create({ key: Anim.HeroPunch, frames: a.generateFrameNames(Tex.Hero, { start: 13, end: 15 }), frameRate: 18, repeat: 0 });

  a.create({ key: Anim.RobotIdle, frames: a.generateFrameNames(Tex.Robot, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
  a.create({ key: Anim.ShurikenSpin, frames: a.generateFrameNames(Tex.Shuriken, { start: 0, end: 3 }), frameRate: 18, repeat: -1 });
  a.create({ key: Anim.SlimeHop, frames: a.generateFrameNames(Tex.Slime, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
  a.create({ key: Anim.BatFlap, frames: a.generateFrameNames(Tex.Bat, { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
  a.create({ key: Anim.BeetleWalk, frames: a.generateFrameNames(Tex.Beetle, { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
  // Boss atlas: idle 0-3, windup 4-6, attack 7-9.
  a.create({ key: Anim.BossIdle, frames: a.generateFrameNames(Tex.Boss, { start: 0, end: 3 }), frameRate: 5, repeat: -1 });
  a.create({ key: Anim.BossWindup, frames: a.generateFrameNames(Tex.Boss, { start: 4, end: 6 }), frameRate: 6, repeat: 0 });
  a.create({ key: Anim.BossAttack, frames: a.generateFrameNames(Tex.Boss, { start: 7, end: 9 }), frameRate: 8, repeat: 0 });
  a.create({ key: Anim.StarSpin, frames: a.generateFrameNames(Tex.Star, { start: 0, end: 5 }), frameRate: 10, repeat: -1 });
  a.create({ key: Anim.CoinSpin, frames: a.generateFrameNames(Tex.Coin, { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
  a.create({ key: Anim.SparkBurst, frames: a.generateFrameNames(Tex.Spark, { start: 0, end: 2 }), frameRate: 18, repeat: 0 });
}
