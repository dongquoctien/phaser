import { TextureKeys, type TextureKey } from './keys';
import { Tuning } from '../tuning';

// A hero archetype: stat multipliers off the Tuning base + which texture to use.
// `starter` heroes are pickable at the start; `pet` heroes join every 5 floors.
export interface HeroDef {
  id: string;
  name: string;
  texture: TextureKey;
  hpMul: number;
  atkMul: number;
  defMul: number;
  attackSpeed: number; // multiplier on Tuning.attackInterval (lower = faster)
  pet: boolean;
}

export const HEROES: HeroDef[] = [
  // ── Starters (choose 3) ──────────────────────────────────────────────────
  { id: 'capybara', name: 'Capy', texture: TextureKeys.Capybara, hpMul: 1.5, atkMul: 0.85, defMul: 1.4, attackSpeed: 1.1, pet: false },
  { id: 'cat', name: 'Mittens', texture: TextureKeys.Cat, hpMul: 0.8, atkMul: 1.35, defMul: 0.8, attackSpeed: 0.8, pet: false },
  { id: 'duck', name: 'Quacky', texture: TextureKeys.Duck, hpMul: 1.0, atkMul: 1.1, defMul: 1.0, attackSpeed: 1.0, pet: false },
  { id: 'frog', name: 'Hopper', texture: TextureKeys.Frog, hpMul: 1.1, atkMul: 1.0, defMul: 1.15, attackSpeed: 0.95, pet: false },
  // ── Pet recruits (join every 5 floors, in order) ─────────────────────────
  { id: 'owl', name: 'Hoot', texture: TextureKeys.Owl, hpMul: 0.9, atkMul: 1.5, defMul: 0.9, attackSpeed: 0.75, pet: true },
];

export const STARTERS = HEROES.filter((h) => !h.pet);
export const PETS = HEROES.filter((h) => h.pet);

export function heroById(id: string): HeroDef | undefined {
  return HEROES.find((h) => h.id === id);
}

/** Resolve a HeroDef into concrete starting stats. */
export function statsFor(def: HeroDef): { hp: number; atk: number; def: number } {
  return {
    hp: Math.round(Tuning.heroBaseHp * def.hpMul),
    atk: Math.round(Tuning.heroBaseAtk * def.atkMul),
    def: Math.round(Tuning.heroBaseDef * def.defMul),
  };
}
