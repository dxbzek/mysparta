import type { BeastDef } from "../types.js";

/** Beasts of Legend (02-gdd-core.md §5.4), numbers verbatim. */
export const BEASTS: BeastDef[] = [
  {
    id: "lykos",
    name: "Ash Wolf",
    gritTax: 2,
    hpBase: 16,
    dmgMin: 4,
    dmgMax: 6,
    interval: 260,
    evasion: 15,
    armour: 0,
    init: 0,
    flavour: "Pack instinct: each extra Ash Wolf grants the pack +5% damage.",
  },
  {
    id: "stymphal_shrike",
    name: "Storm Shrike",
    gritTax: 4,
    hpBase: 22,
    dmgMin: 5,
    dmgMax: 8,
    interval: 200,
    evasion: 25,
    armour: 0,
    init: 0,
    flavour: "First action at tick 40; harass: foe Accuracy −5 while it lives.",
  },
  {
    id: "kalydon_boar",
    name: "Iron Boar",
    gritTax: 5,
    hpBase: 45,
    dmgMin: 10,
    dmgMax: 16,
    interval: 340,
    evasion: 0,
    armour: 1,
    init: 0,
    flavour: "Charge: its first attack deals +50% damage.",
  },
  {
    id: "nemean_cub",
    name: "Regal Cub",
    gritTax: 6,
    hpBase: 70,
    dmgMin: 8,
    dmgMax: 12,
    interval: 380,
    evasion: 0,
    armour: 3,
    init: -100,
    flavour: "Slow to wake. Guardian: 30% of hits aimed at you strike the Cub instead.",
  },
  {
    id: "ember_fox",
    name: "Ember Fox",
    gritTax: 3,
    hpBase: 18,
    dmgMin: 5,
    dmgMax: 7,
    interval: 220,
    evasion: 20,
    armour: 0,
    init: 50,
    flavour: "First into the fray, gone before the swing lands.",
  },
  {
    id: "bronze_owl",
    name: "Bronze Owl",
    gritTax: 3,
    hpBase: 14,
    dmgMin: 3,
    dmgMax: 5,
    interval: 240,
    evasion: 30,
    armour: 0,
    init: 20,
    flavour: "Small talons, endless patience, very hard to swat.",
  },
  {
    id: "kerberos_pup",
    name: "Hellhound Pup",
    gritTax: 5,
    hpBase: 34,
    dmgMin: 8,
    dmgMax: 12,
    interval: 300,
    evasion: 5,
    armour: 1,
    init: 0,
    flavour: "Three heads, one appetite. Bites above its weight.",
  },
  {
    id: "marble_tortoise",
    name: "Granite Tortoise",
    gritTax: 4,
    hpBase: 60,
    dmgMin: 4,
    dmgMax: 6,
    interval: 420,
    evasion: 0,
    armour: 4,
    init: -60,
    flavour: "Nothing gets through. Nothing hurries it either.",
  },
];

const byId = new Map(BEASTS.map((b) => [b.id, b] as const));

export function beast(id: string): BeastDef {
  const b = byId.get(id);
  if (!b) throw new Error(`Unknown beast: ${id}`);
  return b;
}

/** Total Grit tax for a beast list, respecting Beast Bond (−1 each). */
export function beastTax(ids: string[], hasBeastBond: boolean): number {
  return ids.reduce((sum, id) => sum + Math.max(0, beast(id).gritTax - (hasBeastBond ? 1 : 0)), 0);
}
