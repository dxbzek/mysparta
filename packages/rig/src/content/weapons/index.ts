/** Every content weapon (all held ids outside the gate pack), keyed by id. */
import type { HeldId } from "@rankzero/core";
import type { GateWeapon, WeaponArt } from "../../contracts";
import { BAT, CRICKET_BAT, CROWBAR, FRYING_PAN, GOLF_CLUB, HAND_AXE, HOCKEY_STICK, MACHETE, MONKEY_WRENCH, PLUNGER, REBAR, TYRE_IRON, UMBRELLA, WOK } from "./clubs";
import { BALL_AND_CHAIN, BIKE_CHAIN, RUBBER_CHICKEN } from "./flex";
import { ANVIL, BROOM, FOLDING_CHAIR, GARDEN_SHEARS, LAWN_FLAMINGO, PICKAXE, PITCHFORK, POOL_CUE, SHOVEL, SLEDGEHAMMER, STOP_SIGN } from "./poles";
import { BOOMERANG, BRICKS, DARTS, HUBCAP, KNUCKLE_DUSTERS, PAINT_CAN, PLASTIC_BOTTLE, RUBBER_BALL, SCREWDRIVERS, TRAFFIC_CONE, TYRE } from "./thrown";

export const CONTENT_WEAPONS: Record<Exclude<HeldId, GateWeapon>, WeaponArt> = {
  broom: BROOM, machete: MACHETE, "hand-axe": HAND_AXE, bat: BAT, pitchfork: PITCHFORK, crowbar: CROWBAR,
  "knuckle-dusters": KNUCKLE_DUSTERS, shovel: SHOVEL, sledgehammer: SLEDGEHAMMER, darts: DARTS, "bike-chain": BIKE_CHAIN,
  "monkey-wrench": MONKEY_WRENCH, pickaxe: PICKAXE, rebar: REBAR, screwdrivers: SCREWDRIVERS, "garden-shears": GARDEN_SHEARS,
  "stop-sign": STOP_SIGN, boomerang: BOOMERANG, anvil: ANVIL, "ball-and-chain": BALL_AND_CHAIN, umbrella: UMBRELLA,
  "pool-cue": POOL_CUE, bricks: BRICKS, "rubber-chicken": RUBBER_CHICKEN, "lawn-flamingo": LAWN_FLAMINGO,
  "frying-pan": FRYING_PAN, "tyre-iron": TYRE_IRON, "golf-club": GOLF_CLUB, "hockey-stick": HOCKEY_STICK,
  "folding-chair": FOLDING_CHAIR, "cricket-bat": CRICKET_BAT, wok: WOK, plunger: PLUNGER,
  "plastic-bottle": PLASTIC_BOTTLE, "rubber-ball": RUBBER_BALL, "paint-can": PAINT_CAN, "traffic-cone": TRAFFIC_CONE,
  hubcap: HUBCAP, tyre: TYRE,
};
