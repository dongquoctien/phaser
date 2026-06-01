import { TextureKeys, type TextureKey } from './keys';
import { Tuning } from '../tuning';
import type { AttackProfile } from './skills';

// A pickable hero: base stats + a starting tweak to its AttackProfile so each
// one plays differently from shot one (before any skills).
export interface HeroDef {
  id: string;
  name: string;
  blurb: string;
  texture: TextureKey;
  hpMul: number;
  atkMul: number;
  defMul: number;
  // mutate the fresh profile to give the hero its identity
  startProfile: (p: AttackProfile) => void;
  pet: boolean;
}

export const HEROES: HeroDef[] = [
  {
    id: 'capybara', name: 'Capy', blurb: 'Tanky · steady shots', texture: TextureKeys.Capybara,
    hpMul: 1.6, atkMul: 0.9, defMul: 1.5, pet: false,
    startProfile: (p) => { p.lifesteal += 0.05; },
  },
  {
    id: 'cat', name: 'Mittens', blurb: 'Glass cannon · crits', texture: TextureKeys.Cat,
    hpMul: 0.8, atkMul: 1.3, defMul: 0.8, pet: false,
    startProfile: (p) => { p.critChance += 0.15; p.attackInterval = Math.round(p.attackInterval * 0.9); },
  },
  {
    id: 'duck', name: 'Quacky', blurb: 'Spread · starts +1 arrow', texture: TextureKeys.Duck,
    hpMul: 1.0, atkMul: 1.0, defMul: 1.0, pet: false,
    startProfile: (p) => { p.arrows += 1; },
  },
  {
    id: 'frog', name: 'Hopper', blurb: 'Toxic · starts with poison', texture: TextureKeys.Frog,
    hpMul: 1.15, atkMul: 1.0, defMul: 1.1, pet: false,
    startProfile: (p) => { p.poison += 1; },
  },
  // Pet recruit (joins every 5 floors). Fires a weaker support arrow.
  {
    id: 'owl', name: 'Hoot', blurb: 'Pet · support fire', texture: TextureKeys.Owl,
    hpMul: 0.7, atkMul: 1.0, defMul: 0.7, pet: true,
    startProfile: () => {},
  },
];

export const STARTERS = HEROES.filter((h) => !h.pet);
export const PETS = HEROES.filter((h) => h.pet);

export function heroById(id: string): HeroDef | undefined {
  return HEROES.find((h) => h.id === id);
}

export function statsFor(def: HeroDef): { hp: number; atk: number; def: number } {
  return {
    hp: Math.round(Tuning.heroBaseHp * def.hpMul),
    atk: Math.round(Tuning.heroBaseAtk * def.atkMul),
    def: Math.round(Tuning.heroBaseDef * def.defMul),
  };
}
