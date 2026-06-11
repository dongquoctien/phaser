import Phaser from 'phaser';
import { SceneKeys, TileKeys, CharKeys, AnimKeys, GRASS_VARIANTS } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Player } from '../objects/Player';
import { Mob } from '../objects/Mob';
import { Pool } from '../systems/Pool';

// ── The overworld ────────────────────────────────────────────────────────────
// Core loop (one sentence): roam the meadow, and when a roaming monster touches
// you it triggers a turn-based battle. Juice: smooth camera follow, monsters that
// wander then chase, an "!" alert + white flash + freeze-frame on encounter.
const WORLD_W = 1600;
const WORLD_H = 1200;
const TILE = 64; // grass tile draw size (source is 64×64)
const MOB_COUNT = 7;
const ENCOUNTER_COOLDOWN = 900; // ms of grace after a battle so you don't re-trigger instantly

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private mobs!: Pool<Mob>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  private encounterLockUntil = 0;
  private inEncounter = false;
  // exposed for Mob.preUpdate to chase toward
  playerPos!: Phaser.Math.Vector2;

  // touch joystick state
  private stick?: { base: Phaser.GameObjects.Arc; knob: Phaser.GameObjects.Arc; id: number; ox: number; oy: number };
  private touchVec = new Phaser.Math.Vector2();

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.inEncounter = false;
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBackgroundColor('#5fa84a');

    this.buildMeadow();

    // mob walk animation from the sheet (a few frames make a believable shuffle)
    if (!this.anims.exists(AnimKeys.MobWalk)) {
      this.anims.create({
        key: AnimKeys.MobWalk,
        frames: this.anims.generateFrameNumbers(CharKeys.MobWalker, { frames: [6, 7, 8, 9] }),
        frameRate: 6,
        repeat: -1,
      });
    }

    // party
    this.player = new Player(this, WORLD_W / 2, WORLD_H / 2);
    this.playerPos = this.player.pos;
    this.cameras.main.startFollow(this.player.leader, true, 0.12, 0.12);

    // mobs
    this.mobs = new Pool(this, Mob, MOB_COUNT, MOB_COUNT);
    for (let i = 0; i < MOB_COUNT; i++) this.spawnMobAwayFromPlayer();

    // encounter on touch
    this.physics.add.overlap(this.player.leader, this.mobs.group_, (_p, mobObj) => {
      this.onEncounter(mobObj as Mob);
    });

    this.setupInput();
    this.buildHud();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  // ── world build ────────────────────────────────────────────────────────────
  private buildMeadow(): void {
    // grass: a random variant per cell so the field never visibly repeats
    for (let y = 0; y < WORLD_H; y += TILE) {
      for (let x = 0; x < WORLD_W; x += TILE) {
        const key = Phaser.Utils.Array.GetRandom(GRASS_VARIANTS as unknown as string[]);
        this.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(TILE, TILE).setDepth(0);
      }
    }
    // a meandering dirt path across the middle for visual interest
    let px = 80, py = WORLD_H / 2;
    for (let i = 0; i < 26; i++) {
      this.add.image(px, py, TileKeys.Dirt).setOrigin(0.5).setDisplaySize(58, 58).setDepth(1);
      px += 58;
      py += Phaser.Math.Between(-26, 26);
      py = Phaser.Math.Clamp(py, 120, WORLD_H - 120);
    }

    // scatter decor — small flora as flat ground decals, trees as tall occluders
    const flat = [TileKeys.Flowers, TileKeys.Bush, TileKeys.Mushroom, TileKeys.Log, TileKeys.RockMed1];
    for (let i = 0; i < 60; i++) {
      const k = Phaser.Utils.Array.GetRandom(flat);
      this.add.image(Phaser.Math.Between(40, WORLD_W - 40), Phaser.Math.Between(40, WORLD_H - 40), k)
        .setOrigin(0.5).setScale(0.5).setDepth(2);
    }
    const tall = [TileKeys.TreeRound, TileKeys.TreePine, TileKeys.TreeSmall1, TileKeys.TreeSmall2, TileKeys.RockBig1];
    for (let i = 0; i < 28; i++) {
      const k = Phaser.Utils.Array.GetRandom(tall);
      const t = this.add.image(Phaser.Math.Between(60, WORLD_W - 60), Phaser.Math.Between(80, WORLD_H - 60), k)
        .setOrigin(0.5, 0.9).setScale(0.6);
      t.setDepth(t.y); // y-sort so the party walks behind tree tops, in front of trunks
    }
  }

  private spawnMobAwayFromPlayer(): void {
    let x = 0, y = 0, tries = 0;
    do {
      x = Phaser.Math.Between(80, WORLD_W - 80);
      y = Phaser.Math.Between(80, WORLD_H - 80);
      tries++;
    } while (tries < 20 && Phaser.Math.Distance.Between(x, y, WORLD_W / 2, WORLD_H / 2) < 260);
    this.mobs.spawn(x, y);
  }

  // ── encounter ────────────────────────────────────────────────────────────
  private onEncounter(mob: Mob): void {
    if (this.inEncounter || this.time.now < this.encounterLockUntil) return;
    this.inEncounter = true;
    this.player.move(0, 0);
    this.physics.world.pause();

    // juice: "!" pop over the mob + white flash + tiny shake
    const bang = this.add.text(mob.x, mob.y - 30, '!', {
      fontFamily: 'monospace', fontSize: '28px', color: '#ffe14d', stroke: '#5a3b00', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(9999);
    this.tweens.add({ targets: bang, y: bang.y - 12, scale: 1.4, duration: 220, yoyo: true });
    this.cameras.main.flash(180, 255, 255, 255);
    this.cameras.main.shake(160, 0.006);

    const mx = mob.x, my = mob.y;
    this.time.delayedCall(420, () => {
      bang.destroy();
      mob.despawn();
      // hand off to battle (stub scene). It wakes us back up via scene.resume.
      this.scene.launch(SceneKeys.Battle, { mobX: mx, mobY: my });
      this.scene.pause();
    });

    // when the battle scene wakes us back up, resume the field with a cooldown
    this.events.once(Phaser.Scenes.Events.RESUME, () => {
      this.physics.world.resume();
      this.inEncounter = false;
      this.encounterLockUntil = this.time.now + ENCOUNTER_COOLDOWN;
      if (this.mobs.group_.countActive(true) < MOB_COUNT) this.spawnMobAwayFromPlayer();
    });
  }

  // ── input ────────────────────────────────────────────────────────────────
  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    // addKeys('W,A,S,D') returns keys named W/A/S/D — map them to up/down/left/right
    // so the update() loop can read .up/.down/.left/.right uniformly with the arrows.
    const k = this.input.keyboard!.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
    this.wasd = { up: k.W, down: k.S, left: k.A, right: k.D };

    // simple drag joystick on touch: appears where the finger lands
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.stick) return;
      const base = this.add.circle(p.x, p.y, 34, 0xffffff, 0.16).setScrollFactor(0).setDepth(9000);
      const knob = this.add.circle(p.x, p.y, 16, 0xffffff, 0.45).setScrollFactor(0).setDepth(9001);
      this.stick = { base, knob, id: p.id, ox: p.x, oy: p.y };
    });
    const endStick = (p: Phaser.Input.Pointer) => {
      if (this.stick && this.stick.id === p.id) {
        this.stick.base.destroy(); this.stick.knob.destroy();
        this.stick = undefined; this.touchVec.set(0, 0);
      }
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, endStick);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, endStick);
    this.input.setPollAlways(); // sample joystick every frame, not just on move
  }

  /** Recompute the touch vector each frame from the live pointer (no lag). */
  private sampleTouch(): void {
    if (!this.stick) return;
    const p = this.input.manager.pointers.find((pt) => pt.id === this.stick!.id);
    if (!p || !p.isDown) { this.touchVec.set(0, 0); return; }
    const dx = p.x - this.stick.ox, dy = p.y - this.stick.oy;
    const max = 34;
    const len = Math.min(max, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    this.stick.knob.setPosition(this.stick.ox + Math.cos(a) * len, this.stick.oy + Math.sin(a) * len);
    this.touchVec.set(Math.cos(a) * (len / max), Math.sin(a) * (len / max));
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  private buildHud(): void {
    const pad = this.add.graphics().setScrollFactor(0).setDepth(8000);
    pad.fillStyle(0x000000, 0.45).fillRoundedRect(6, 6, 196, 26, 6);
    this.add.text(14, 11, 'MEADOW QUEST', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffffff',
    }).setScrollFactor(0).setDepth(8001);
    this.add.text(GAME_WIDTH - 6, GAME_HEIGHT - 6, 'WASD / arrows / drag to move', {
      fontFamily: 'monospace', fontSize: '9px', color: '#eaffea',
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(8001);
  }

  update(time: number): void {
    if (this.inEncounter) { this.player.update(time); return; }

    this.sampleTouch();
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;
    if (this.touchVec.lengthSq() > 0.02) { dx += this.touchVec.x; dy += this.touchVec.y; }

    this.player.move(dx, dy);
    this.player.update(time);
    this.player.leader.setDepth(this.player.leader.y); // y-sort against trees
  }

  private cleanup(): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.input.removeAllListeners();
    this.stick?.base.destroy();
    this.stick?.knob.destroy();
    this.stick = undefined;
  }
}
