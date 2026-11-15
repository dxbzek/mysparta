/**
 * Which sound set plays for a cue (fight-screen lane; owner, 15 Nov 2026: "it depends on the
 * weapon too. Knife doesn't sound like a knife"). Since stage contract rev 3 every cue names the
 * thing that made it (`Cue.item`) and what an impact struck (`Cue.on`). These tables give every
 * held item, shield and pet its own set where a fitting recording exists, otherwise its material
 * group. A cue with no item, or an item whose set is missing from the sprite, falls back to the
 * family's set (`families` in sfx.json). The set names are the ones tools/build-audio.mjs builds;
 * a test checks that every name used here exists in the shipped sfx.json.
 */
import type { CompanionId, HeldId, PropId, ShieldId } from "@rankzero/core";
import type { Cue, SfxItem } from "@rankzero/stage";

/** A hit on the body, by what struck. */
export const HIT_SET: Readonly<Record<HeldId | CompanionId, string>> = {
  fists: "hit-fist", "knuckle-dusters": "hit-knuckle",
  "pocket-knife": "hit-blade-small", screwdrivers: "hit-blade-small", "garden-shears": "hit-blade-small",
  machete: "hit-blade-big", "hand-axe": "hit-blade-big",
  pipe: "hit-pipe", crowbar: "hit-pipe", "tyre-iron": "hit-pipe", rebar: "hit-pipe", "monkey-wrench": "hit-pipe",
  bat: "hit-wood", broom: "hit-wood", "cricket-bat": "hit-wood", "hockey-stick": "hit-wood", "pool-cue": "hit-wood",
  // a steel folding chair: a hollow steel-frame bang, never a wood knock
  "folding-chair": "hit-chair", boomerang: "hit-wood",
  sledgehammer: "hit-heavy", anvil: "hit-heavy", "ball-and-chain": "hit-heavy",
  "frying-pan": "hit-pan", wok: "hit-pan",
  shovel: "hit-shovel", "stop-sign": "hit-shovel",
  "golf-club": "hit-light-metal",
  // a pickaxe lands with its heavy steel head; a pitchfork stabs with its tines
  pickaxe: "hit-heavy", pitchfork: "hit-stab",
  "rubber-chicken": "hit-squeak", plunger: "hit-plunger", umbrella: "hit-umbrella", "bike-chain": "hit-chain",
  darts: "hit-darts", bricks: "hit-brick", "paint-can": "hit-paint",
  "plastic-bottle": "hit-plastic", "lawn-flamingo": "hit-plastic", "rubber-ball": "hit-ball", hubcap: "hit-hubcap",
  "traffic-cone": "hit-rubber", tyre: "hit-rubber",
  // a pet's contact sounds like the animal: a dog's or raccoon's bite snaps, a bird's beak pecks,
  // a cat's claws rake, a boar's tusks gore with its grunt under the blow
  "stray-dog": "hit-bite", raccoon: "hit-bite", crow: "hit-peck", goose: "hit-peck", "alley-cat": "hit-claw", boar: "hit-gore",
};

/** The swish of a swing, an evade or a draw, by the weight of what moves. */
export const SWISH_SET: Readonly<Record<HeldId | CompanionId, string>> = {
  fists: "swish-light", "knuckle-dusters": "swish-light", "pocket-knife": "swish-light", screwdrivers: "swish-light",
  "garden-shears": "swish-light", darts: "swish-light", "rubber-chicken": "swish-light", plunger: "swish-light",
  "plastic-bottle": "swish-light", "rubber-ball": "swish-light",
  machete: "swish-medium", "hand-axe": "swish-medium", pipe: "swish-medium", crowbar: "swish-medium",
  "tyre-iron": "swish-medium", rebar: "swish-medium", "monkey-wrench": "swish-medium", bat: "swish-medium",
  broom: "swish-medium", "cricket-bat": "swish-medium", "hockey-stick": "swish-medium", "pool-cue": "swish-medium",
  "folding-chair": "swish-medium", boomerang: "swish-medium", "frying-pan": "swish-medium", wok: "swish-medium",
  shovel: "swish-medium", "stop-sign": "swish-medium", "golf-club": "swish-medium", pitchfork: "swish-medium",
  umbrella: "swish-medium", bricks: "swish-medium", "paint-can": "swish-medium", "lawn-flamingo": "swish-medium",
  hubcap: "swish-medium", "traffic-cone": "swish-medium", tyre: "swish-medium",
  sledgehammer: "swish-heavy", anvil: "swish-heavy", "ball-and-chain": "swish-heavy", pickaxe: "swish-heavy",
  "bike-chain": "swish-whip",
  raccoon: "swish-light", goose: "swish-light", boar: "swish-medium", "stray-dog": "swish-light", crow: "swish-light",
  "alley-cat": "swish-light",
};

/** The flight sound at a throw's release, for every held item (any of them can be thrown): a
 *  spinning whirr for things that spin, a heavy whoomp for heavy things, a light swish for small
 *  hard things, a plain air whoosh ("throw") for the rest. A throw with no item (a Move's tarp)
 *  plays the family's set, the same neutral whoosh, never a blade swish. */
export const THROW_SET: Readonly<Record<HeldId, string>> = {
  boomerang: "throw-spin", hubcap: "throw-spin", tyre: "throw-spin",
  darts: "swish-light", "pocket-knife": "swish-light", screwdrivers: "swish-light", "knuckle-dusters": "swish-light",
  "garden-shears": "swish-light", fists: "swish-light",
  bricks: "swish-heavy", "paint-can": "swish-heavy", anvil: "swish-heavy", sledgehammer: "swish-heavy",
  "ball-and-chain": "swish-heavy", pickaxe: "swish-heavy",
  "bike-chain": "swish-whip",
  machete: "swish-medium", "hand-axe": "swish-medium", pipe: "swish-medium", crowbar: "swish-medium",
  "tyre-iron": "swish-medium", rebar: "swish-medium", "monkey-wrench": "swish-medium", bat: "swish-medium",
  "cricket-bat": "swish-medium", "hockey-stick": "swish-medium", "pool-cue": "swish-medium", "folding-chair": "swish-medium",
  "frying-pan": "swish-medium", wok: "swish-medium", shovel: "swish-medium", "stop-sign": "swish-medium",
  "golf-club": "swish-medium", pitchfork: "swish-medium",
  "plastic-bottle": "throw", "rubber-ball": "throw", "traffic-cone": "throw", "rubber-chicken": "throw",
  "lawn-flamingo": "throw", umbrella: "throw", plunger: "throw", broom: "throw",
};

/** A blow taken on a shield, by the shield. */
export const BLOCK_SET: Readonly<Record<ShieldId, string>> = {
  "car-door": "block-sheet", "bin-lid": "block-tin", "riot-shield": "block-plastic",
  "wooden-pallet": "block-wood", skateboard: "block-wood", "ironing-board": "block-frame",
};

/** An item landing on the floor, by its material. */
export const DROP_SET: Readonly<Record<PropId, string>> = {
  pipe: "drop-metal", crowbar: "drop-metal", "tyre-iron": "drop-metal", rebar: "drop-metal", "monkey-wrench": "drop-metal",
  sledgehammer: "drop-metal", anvil: "drop-metal", "ball-and-chain": "drop-metal", wok: "drop-metal", "frying-pan": "drop-metal",
  "golf-club": "drop-metal", pitchfork: "drop-metal", pickaxe: "drop-metal", shovel: "drop-metal",
  "pocket-knife": "drop-metal", screwdrivers: "drop-metal", "garden-shears": "drop-metal", machete: "drop-metal",
  "hand-axe": "drop-metal", "knuckle-dusters": "drop-metal", "bike-chain": "drop-metal", darts: "drop-metal",
  "paint-can": "drop-metal", "folding-chair": "drop-metal",
  "stop-sign": "drop-sheet", hubcap: "drop-sheet", "car-door": "drop-sheet", "bin-lid": "drop-sheet", "ironing-board": "drop-sheet",
  bat: "drop-wood", broom: "drop-wood", "cricket-bat": "drop-wood", "hockey-stick": "drop-wood", "pool-cue": "drop-wood",
  boomerang: "drop-wood", "wooden-pallet": "drop-wood", skateboard: "drop-wood",
  "rubber-chicken": "drop-soft", plunger: "drop-soft", umbrella: "drop-soft", "plastic-bottle": "drop-soft",
  "rubber-ball": "drop-soft", "traffic-cone": "drop-soft", tyre: "drop-soft", "lawn-flamingo": "drop-soft", "riot-shield": "drop-soft",
  // a brick drops like stone
  bricks: "drop-stone",
};

/** A pet's own call. */
export const VOICE_SET: Readonly<Record<CompanionId, string>> = {
  "stray-dog": "voice-dog", crow: "voice-crow", goose: "voice-goose", raccoon: "voice-raccoon", boar: "voice-boar",
  "alley-cat": "voice-cat",
};

const has = <K extends string>(table: Readonly<Partial<Record<K, string>>>, item: SfxItem | undefined): item is K & SfxItem =>
  item !== undefined && Object.prototype.hasOwnProperty.call(table, item);

/** The set for a cue's item, or null when the family's own set should play. */
export function itemSet(cue: Pick<Cue, "family" | "item" | "on">): string | null {
  const { family, item, on } = cue;
  switch (family) {
    case "fist": case "blunt": case "blade":
      return has(HIT_SET, item) ? HIT_SET[item] : null;
    case "block":
      if (on === "shield") return has(BLOCK_SET, item) ? BLOCK_SET[item] : null;
      if (on === "weapon") return "block-parry";
      return null;
    case "swing": case "whoosh":
      return has(SWISH_SET, item) ? SWISH_SET[item] : null;
    case "throw":
      return has(THROW_SET, item) ? THROW_SET[item] : null;
    case "drop":
      return has(DROP_SET, item) ? DROP_SET[item] : null;
    case "companion":
      return has(VOICE_SET, item) ? VOICE_SET[item] : null;
    default:
      return null;
  }
}

/** Every set name these tables use (for the sprite test). */
export function setsUsed(): string[] {
  const all = [HIT_SET, SWISH_SET, THROW_SET, BLOCK_SET, DROP_SET, VOICE_SET].flatMap((t) => Object.values(t) as string[]);
  return [...new Set([...all, "block-parry"])].sort();
}
