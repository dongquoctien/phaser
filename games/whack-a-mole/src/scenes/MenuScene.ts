import Phaser from 'phaser';
import {
  SceneKeys,
  AtlasKeys,
  TexKeys,
  AudioKeys,
  Weapons,
  REG_WEAPON,
  type WeaponId,
} from '../types/keys';
import { WEAPON_TEX } from '../systems/art';
import { Audio } from '../systems/Audio';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Storage } from '../systems/Storage';
import { Api } from '../systems/Api';
import { showNicknamePrompt } from '../systems/NicknamePrompt';
import { showLeaderboard } from '../systems/LeaderboardPanel';

export class MenuScene extends Phaser.Scene {
  private weapon: WeaponId = 'swatter';
  private picks: { id: WeaponId; ring: Phaser.GameObjects.Rectangle }[] = [];
  private audio!: Audio;
  private modalOpen = false; // true while the nickname/leaderboard overlay is up
  private nameText?: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.picks = [];
    this.modalOpen = false; // scene instances are reused across restarts — reset
    this.audio = new Audio(this);
    // keep the previous choice across visits; default to swatter
    this.weapon = (this.registry.get(REG_WEAPON) as WeaponId) ?? 'swatter';

    // grassy backdrop (matches the game)
    const g = this.add.graphics();
    g.fillStyle(0x9fd95f, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x7ec850, 1).fillRect(0, 160, GAME_WIDTH, GAME_HEIGHT - 160);

    // "TWDC" tag line above the main title (small badge so the big title fits)
    this.add
      .text(GAME_WIDTH / 2, 62, 'TWDC', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffe14d',
        fontStyle: 'bold',
        stroke: '#3a6b1f',
        strokeThickness: 6,
        letterSpacing: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 104, 'WHACK-A-CHAR', {
        fontFamily: 'monospace',
        fontSize: '38px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#3a6b1f',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.buildShowcase(250);
    this.buildInstructions(386);
    this.buildWeaponPicker(508);
    this.buildPlay(688);
    this.buildLeaderboardUi(756);

    // First run: prompt for a leaderboard name (RANDOM assigns a default).
    if (!Storage.hasNickname()) {
      this.modalOpen = true;
      showNicknamePrompt(this, {
        force: true,
        onDone: () => { this.modalOpen = false; this.refreshName(); },
      });
    }
  }

  // --- leaderboard + name row ----------------------------------------------

  private buildLeaderboardUi(y: number): void {
    const board = this.add
      .text(GAME_WIDTH / 2 - 70, y, '[ LEADERBOARD ]', {
        fontFamily: 'monospace', fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
        backgroundColor: '#3a6b1f', padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    board.on('pointerup', () => {
      if (this.modalOpen) return;
      this.audio.play(AudioKeys.Click);
      this.modalOpen = true;
      showLeaderboard(this, () => { this.modalOpen = false; });
    });

    // current name + an edit affordance
    this.nameText = this.add
      .text(GAME_WIDTH / 2 + 88, y, '', {
        fontFamily: 'monospace', fontSize: '12px', color: '#2f4a18',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.nameText.on('pointerup', () => {
      if (this.modalOpen) return;
      this.modalOpen = true;
      showNicknamePrompt(this, { onDone: () => { this.modalOpen = false; this.refreshName(); } });
    });
    this.refreshName();
  }

  private refreshName(): void {
    this.nameText?.setText(`as ${Storage.getNickname()}  (edit)`);
  }

  // --- bonk/spare showcase --------------------------------------------------

  private buildShowcase(cy: number): void {
    const showcase: { frame: string; label: string; color: string; tint: number }[] = [
      { frame: 'cat-black', label: 'BONK', color: '#ff8a7d', tint: 0xff5a4d },
      { frame: 'mole-boss', label: 'BOSS!', color: '#ffd23f', tint: 0xff5a4d },
      { frame: 'capybara', label: 'SPARE', color: '#9be37d', tint: 0x5dd84f },
    ];
    showcase.forEach((s, i) => {
      const x = GAME_WIDTH / 2 + (i - 1) * 130;
      this.add.image(x, cy, TexKeys.Hole).setDepth(1);
      this.add
        .image(x, cy + 4, TexKeys.Marker)
        .setDepth(1.5)
        .setTint(s.tint)
        .setBlendMode(Phaser.BlendModes.ADD);
      const ch = this.add
        .sprite(x, cy + 12, AtlasKeys.Sprites, s.frame)
        .setOrigin(0.5, 1)
        .setDepth(2);
      this.add.image(x, cy + 6, TexKeys.Mound).setOrigin(0.5, 0).setDepth(3);
      this.add
        .text(x, cy + 56, s.label, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: s.color,
          fontStyle: 'bold',
          stroke: '#000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(4);
      this.tweens.add({
        targets: ch,
        y: cy + 4,
        duration: 700 + i * 90,
        yoyo: true,
        loop: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  private buildInstructions(y: number): void {
    this.add
      .text(
        GAME_WIDTH / 2,
        y,
        'RED ring = BONK for points\nGREEN ring = SPARE (or lose your combo!)',
        {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#2f4a18',
          align: 'center',
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5);
  }

  // --- weapon picker --------------------------------------------------------

  private buildWeaponPicker(cy: number): void {
    this.add
      .text(GAME_WIDTH / 2, cy - 56, 'CHOOSE YOUR WEAPON', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#3a6b1f',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const labels: Record<WeaponId, string> = { pan: 'PAN', mace: 'MACE', swatter: 'SWATTER' };
    const tile = 96;
    Weapons.forEach((id, i) => {
      const x = GAME_WIDTH / 2 + (i - 1) * (tile + 16);
      // selection ring (shown only on the chosen one)
      const ring = this.add
        .rectangle(x, cy, tile, tile, 0x000000, 0)
        .setStrokeStyle(4, 0xffe14d)
        .setVisible(id === this.weapon);
      // tile background
      this.add.rectangle(x, cy, tile, tile, 0x000000, 0.18).setDepth(1);
      // weapon art (scaled to fit the tile)
      this.add
        .image(x, cy + 6, WEAPON_TEX[id])
        .setDepth(2)
        .setScale(0.62);
      this.add
        .text(x, cy + tile / 2 + 12, labels[id], {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(3);
      // hit area over the whole tile
      const hit = this.add
        .rectangle(x, cy, tile, tile + 24, 0xffffff, 0.001)
        .setDepth(4)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.selectWeapon(id));
      this.picks.push({ id, ring });
    });
  }

  private selectWeapon(id: WeaponId): void {
    this.weapon = id;
    this.registry.set(REG_WEAPON, id);
    this.audio.play(AudioKeys.Click);
    this.picks.forEach((p) => {
      p.ring.setVisible(p.id === id);
      if (p.id === id) {
        this.tweens.killTweensOf(p.ring);
        p.ring.setScale(1);
        this.tweens.add({ targets: p.ring, scale: 1.12, duration: 110, yoyo: true });
      }
    });
  }

  // --- play -----------------------------------------------------------------

  private buildPlay(y: number): void {
    // make sure a weapon is stored even if the player never taps a tile
    this.registry.set(REG_WEAPON, this.weapon);

    const start = this.add
      .text(GAME_WIDTH / 2, y, '▶  TAP TO PLAY', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#e8643c',
        padding: { x: 22, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({
      targets: start,
      scale: 1.07,
      duration: 600,
      yoyo: true,
      loop: -1,
      ease: 'Sine.easeInOut',
    });

    let starting = false;
    const go = () => {
      if (this.modalOpen || starting) return; // overlay up, or already launching
      starting = true;
      this.audio.play(AudioKeys.Click); // also the gesture that unlocks audio
      Api.startSession(); // fire-and-forget: gets a signed token for score submit
      this.scene.start(SceneKeys.Game);
    };
    start.on('pointerup', go);
    // Keyboard start guard: the nickname prompt mounts a real <input>; while it's in
    // the DOM, swallow keydowns here so the same keystroke (esp. Enter committing the
    // name) can't ALSO start the game even if it fires before modalOpen clears.
    this.input.keyboard?.on('keydown', () => {
      if (document.querySelector('input')) return;
      go();
    });
  }
}
