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
  "frying-pan": "Frying Pan",
  "tyre-iron": "Tyre Iron",
  "golf-club": "Golf Club",
  "hockey-stick": "Hockey Stick",
  "folding-chair": "Folding Chair",
  "cricket-bat": "Cricket Bat",
  wok: "Wok",
  plunger: "Plunger",
  // weapons: Thrown (content v2)
  "plastic-bottle": "Plastic Bottle",
  "rubber-ball": "Rubber Ball",
  "paint-can": "Paint Can",
  "traffic-cone": "Traffic Cone",
  hubcap: "Hubcap",
  tyre: "Tyre",
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
  "quick-swap": "Quick Swap",
  "pet-lover": "Pet Lover",
  "junk-collector": "Junk Collector",
  "trick-shot": "Trick Shot",
  // skills: Moves
  haymaker: "Haymaker",
  "energy-drink": "Energy Drink",
  tarp: "Tarp",
  whistle: "Whistle",
  firecrackers: "Firecrackers",
  snatch: "Snatch",
  "air-horn": "Air Horn",
  "body-slam": "Body Slam",
  "sand-in-the-eyes": "Sand in the Eyes",
  taunt: "Taunt",
  "second-wind": "Second Wind",
  grapple: "Grapple",
  // companions
  raccoon: "Raccoon",
  goose: "Goose",
  boar: "Boar",
  "stray-dog": "Stray Dog",
  crow: "Crow",
  "alley-cat": "Alley Cat",
  // shields (content v2)
  "car-door": "Car Door",
  "bin-lid": "Bin Lid",
  "wooden-pallet": "Wooden Pallet",
  "ironing-board": "Ironing Board",
  skateboard: "Skateboard",
  "riot-shield": "Riot Shield",
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
