import { TextureKeys, type TextureKey } from './keys';

// ── Towers ───────────────────────────────────────────────────────────────────
export type TowerId = 'gun' | 'cannon' | 'missile';

export interface TowerTier {
  range: number; // px
  fireInterval: number; // ms
  damage: number;
  upgradeCost: number; // cost to reach THIS tier (tier 0 = the buy cost)
}

export interface TowerDef {
  id: TowerId;
  name: string;
  baseTex: TextureKey;
  turretTex: TextureKey;
  bulletTex: TextureKey;
  bulletSpeed: number;
  splash: number; // splash radius (0 = single target); cannon/missile have it
  tiers: TowerTier[]; // index 0..2 (buy + 2 upgrades)
}

export const TOWERS: Record<TowerId, TowerDef> = {
  gun: {
    id: 'gun', name: 'Gun', baseTex: TextureKeys.BaseGun, turretTex: TextureKeys.TurretGun,
    bulletTex: TextureKeys.Bullet, bulletSpeed: 460, splash: 0,
    tiers: [
      { range: 120, fireInterval: 360, damage: 10, upgradeCost: 70 },
      { range: 140, fireInterval: 280, damage: 16, upgradeCost: 90 },
      { range: 165, fireInterval: 210, damage: 26, upgradeCost: 150 },
    ],
  },
  cannon: {
    id: 'cannon', name: 'Cannon', baseTex: TextureKeys.BaseCannon, turretTex: TextureKeys.TurretCannon,
    bulletTex: TextureKeys.Shell, bulletSpeed: 320, splash: 36,
    tiers: [
      { range: 110, fireInterval: 900, damage: 34, upgradeCost: 110 },
      { range: 125, fireInterval: 780, damage: 56, upgradeCost: 150 },
      { range: 145, fireInterval: 660, damage: 92, upgradeCost: 240 },
    ],
  },
  missile: {
    id: 'missile', name: 'Missile', baseTex: TextureKeys.BaseMissile, turretTex: TextureKeys.TurretMissile,
    bulletTex: TextureKeys.Missile, bulletSpeed: 280, splash: 28,
    tiers: [
      { range: 160, fireInterval: 1100, damage: 28, upgradeCost: 140 },
      { range: 185, fireInterval: 950, damage: 48, upgradeCost: 190 },
      { range: 210, fireInterval: 800, damage: 80, upgradeCost: 300 },
    ],
  },
};

export const TOWER_IDS: TowerId[] = ['gun', 'cannon', 'missile'];

// ── Enemies ──────────────────────────────────────────────────────────────────
export type EnemyId = 'light' | 'medium' | 'heavy';

export interface EnemyDef {
  id: EnemyId;
  tex: TextureKey;
  hp: number; // base hp (scaled by wave)
  speedMul: number; // × Tuning.enemySpeed
  bounty: number; // × Tuning.bountyBase
  scale: number;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  light: { id: 'light', tex: TextureKeys.EnemyLight, hp: 40, speedMul: 1.4, bounty: 1, scale: 0.8 },
  medium: { id: 'medium', tex: TextureKeys.EnemyMedium, hp: 90, speedMul: 1.0, bounty: 1.6, scale: 0.95 },
  heavy: { id: 'heavy', tex: TextureKeys.EnemyHeavy, hp: 220, speedMul: 0.65, bounty: 3, scale: 1.1 },
};
