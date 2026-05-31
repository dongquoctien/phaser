// Difficulty = runtime multipliers over the base Tuning (Tuning is `as const`,
// can't be mutated, and we don't want to fork it). Hard = today's raw values
// (×1); Normal/Easy are eased because the base game runs hot.

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DiffMul {
  spawnInterval: number; // ×ramp interval (higher = fewer spawns)
  spawnBatch: number; // ×enemies per spawn tick
  enemyHp: number; // ×enemy HP
  contactDamage: number; // ×damage the hero takes on contact
  spawnRing: number; // ×spawn-ring radius (bigger = more reaction time)
}

export const DIFFICULTY: Record<Difficulty, DiffMul> = {
  easy: { spawnInterval: 1.55, spawnBatch: 0.6, enemyHp: 0.7, contactDamage: 0.55, spawnRing: 1.12 },
  normal: { spawnInterval: 1.2, spawnBatch: 0.85, enemyHp: 0.88, contactDamage: 0.8, spawnRing: 1.05 },
  hard: { spawnInterval: 1.0, spawnBatch: 1.0, enemyHp: 1.0, contactDamage: 1.0, spawnRing: 1.0 },
};

export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: '#a7f070',
  normal: '#73eff7',
  hard: '#b13e53',
};

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
