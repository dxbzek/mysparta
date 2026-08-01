import type { BeastDef } from "../types.js";

/** Beasts of Legend (02-gdd-core.md §5.4), numbers verbatim. */
export const BEASTS: BeastDef[] = [
  {
    id: "lykos",
    name: "Ōkami",
    gritTax: 2,
    hpBase: 16,
    dmgMin: 4,
    dmgMax: 6,
    interval: 260,
    evasion: 15,
    armour: 0,
    init: 0,
    flavour: "An ash-grey wolf that runs at its hunter's heel. Pack instinct: each extra Ōkami grants the pack +5% damage.",
  },
  {
    id: "stymphal_shrike",
    name: "Karasu",
    gritTax: 4,
    hpBase: 22,
    dmgMin: 5,
    dmgMax: 8,
    interval: 200,
    evasion: 25,
    armour: 0,
    init: 0,
    flavour: "A storm crow that dives before the bell fades. First action at tick 40; harass: foe Accuracy −5 while it lives.",
  },
  {
    id: "kalydon_boar",
    name: "Inoshishi",
    gritTax: 5,
    hpBase: 45,
    dmgMin: 10,
    dmgMax: 16,
    interval: 340,
    evasion: 0,
    armour: 1,
    init: 0,
    flavour: "A mountain boar in rift-iron hide. Charge: its first attack deals +50% damage.",
  },
  {
    id: "nemean_cub",
    name: "Komainu",
    gritTax: 6,
    hpBase: 70,
    dmgMin: 8,
    dmgMax: 12,
    interval: 380,
    evasion: 0,
    armour: 3,
    init: -100,
    flavour: "A young shrine-lion, slow to wake. Guardian: 30% of hits aimed at you strike it instead.",
  },
  {
    id: "ember_fox",
    name: "Kitsune",
    gritTax: 3,
    hpBase: 18,
    dmgMin: 5,
    dmgMax: 7,
    interval: 220,
    evasion: 20,
    armour: 0,
    init: 50,
    flavour: "A fox wreathed in embers — first into the fray, gone before the swing lands.",
  },
  {
    id: "bronze_owl",
    name: "Fukurō",
    gritTax: 3,
    hpBase: 14,
    dmgMin: 3,
    dmgMax: 5,
    interval: 240,
    evasion: 30,
    armour: 0,
    init: 20,
    flavour: "A dusk owl with small talons, endless patience, very hard to swat.",
  },
  {
    id: "kerberos_pup",
    name: "Oni Pup",
    gritTax: 5,
    hpBase: 34,
    dmgMin: 8,
    dmgMax: 12,
    interval: 300,
    evasion: 5,
    armour: 1,
    init: 0,
    flavour: "A demon hound whelp. Three heads, one appetite — bites above its weight.",
  },
  {
    id: "marble_tortoise",
    name: "Kame",
    gritTax: 4,
    hpBase: 60,
    dmgMin: 4,
    dmgMax: 6,
    interval: 420,
    evasion: 0,
    armour: 4,
    init: -60,
    flavour: "An old stone-shelled kame. Nothing gets through. Nothing hurries it either.",
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
