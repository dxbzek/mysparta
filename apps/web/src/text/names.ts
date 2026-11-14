/**
 * Player-facing names of every perk and of bare fists (fight-screen lane). Plain English only.
 * A total Record: the compiler fails when an id is added to the contract and not named here.
 */
import type { CompanionId, PerkId } from "@rankzero/core";

export const NAMES: Readonly<Record<PerkId | "fists", string>> = {
  fists: "Fists",
  // weapons
  pipe: "Pipe",
  "pocket-knife": "Pocket Knife",
  broom: "Broom",
  machete: "Machete",
  "hand-axe": "Hand Axe",
  bat: "Bat",
  pitchfork: "Pitchfork",
  crowbar: "Crowbar",
  "knuckle-dusters": "Knuckle Dusters",
  "bin-lid": "Bin Lid",
  shovel: "Shovel",
  sledgehammer: "Sledgehammer",
  darts: "Darts",
  "bike-chain": "Bike Chain",
  "monkey-wrench": "Monkey Wrench",
  pickaxe: "Pickaxe",
  rebar: "Rebar",
  screwdrivers: "Screwdrivers",
  "garden-shears": "Garden Shears",
  "stop-sign": "Stop Sign",
  boomerang: "Boomerang",
  anvil: "Anvil",
  "ball-and-chain": "Ball and Chain",
  umbrella: "Umbrella",
  "pool-cue": "Pool Cue",
  bricks: "Bricks",
  "rubber-chicken": "Rubber Chicken",
  "lawn-flamingo": "Lawn Flamingo",
  // skills: boosters
  "big-heart": "Big Heart",
  "heavy-hands": "Heavy Hands",
  "light-feet": "Light Feet",
  "fast-twitch": "Fast Twitch",
  "glass-cannon": "Glass Cannon",
  mountain: "Mountain",
  // skills: passives
  padding: "Padding",
  anticipation: "Anticipation",
  "sharpening-stone": "Sharpening Stone",
  "bare-knuckle": "Bare Knuckle",
  payback: "Payback",
  flurry: "Flurry",
  "car-door": "Car Door",
  "firm-grip": "Firm Grip",
  "head-start": "Head Start",
  "sharp-eye": "Sharp Eye",
  parry: "Parry",
  "heavy-lifter": "Heavy Lifter",
  pitcher: "Pitcher",
  "plate-vest": "Plate Vest",
  "knock-loose": "Knock Loose",
  "last-stand": "Last Stand",
  stubborn: "Stubborn",
  slippery: "Slippery",
  // skills: Moves
  haymaker: "Haymaker",
  "energy-drink": "Energy Drink",
  tarp: "Tarp",
  whistle: "Whistle",
  firecrackers: "Firecrackers",
  snatch: "Snatch",
  "air-horn": "Air Horn",
  "body-slam": "Body Slam",
  // companions
  raccoon: "Raccoon",
  goose: "Goose",
  boar: "Boar",
};

/** A name for an id read from a save that may be unknown: warns once and falls back. */
const warned = new Set<string>();
export function nameOf(id: string): string {
  const known = (NAMES as Record<string, string | undefined>)[id];
  if (known !== undefined) return known;
  if (!warned.has(id)) {
    warned.add(id);
    console.warn(`names: unknown id "${id}"`);
  }
  return "Something";
}

export function companionName(id: CompanionId): string {
  return NAMES[id];
}
