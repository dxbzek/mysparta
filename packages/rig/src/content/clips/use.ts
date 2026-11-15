/**
 * Which clip each held item really plays (animation pass, 16 Nov 2026; owner: "Lots of
 * unrealistic arms or usage of weapons"). `WEAPON_META.clip` names the base attack clip the
 * stage asks for; where the real object is used another way, `USES[held][base]` names the
 * variant the rig plays instead (brief 11, the weapon-use table). Every variant keeps its base
 * clip's length and events, so the timeline never changes.
 *
 *   swing  -> swing-2h   Bat, Cricket Bat, Rebar: both hands at the grip end, a flat side swing
 *          -> swing-low  Golf Club, Hockey Stick: low to high
 *   thrust -> thrust-1h  Plunger: a one-hand fencing jab
 *   flick  -> thrust-1h  Umbrella: a fencing lunge, closed; Garden Shears: the same lunge with
 *                        the back hand on the other handle (pinned by the engine), snipping shut
 *   throw  -> throw-flick  Darts;  throw-side  Boomerang, Hubcap;  throw-roll  Tyre;
 *             throw-heave  any other two-hand weapon thrown away (both hands over the head)
 *   smash and thrust are the base clips of the heavy and pole weapons (both hands on the shaft).
 */
import type { HeldId } from "@rankzero/core";
import { WEAPON_IDS, WEAPON_META } from "@rankzero/core";
import type { Clip } from "../../contracts";
import { SWING_2H, SWING_LOW } from "./swing-2h";
import { THRUST, THRUST_1H } from "./thrust";
import { THROW_FLICK, THROW_HEAVE, THROW_ROLL, THROW_SIDE } from "./throws";
import { FOOTWORK } from "./footwork";

export const VARIANTS: Readonly<Record<string, Clip>> = {
  "swing-2h": SWING_2H, "swing-low": SWING_LOW, "thrust-1h": THRUST_1H,
  "throw-side": THROW_SIDE, "throw-roll": THROW_ROLL, "throw-flick": THROW_FLICK, "throw-heave": THROW_HEAVE,
  // not weapon variants: the footwork clips the stage asks for by name (footwork.ts, movement pass 2)
  ...FOOTWORK,
};
/** The base clip each variant stands in for (its length and events are that clip's). */
export const VARIANT_BASE: Readonly<Record<string, string>> = {
  "swing-2h": "swing", "swing-low": "swing", "thrust-1h": "thrust",
  "throw-side": "throw", "throw-roll": "throw", "throw-flick": "throw", "throw-heave": "throw",
};

const OWN: Partial<Record<HeldId, Record<string, string>>> = {
  bat: { swing: "swing-2h" }, "cricket-bat": { swing: "swing-2h" }, rebar: { swing: "swing-2h" },
  "golf-club": { swing: "swing-low" }, "hockey-stick": { swing: "swing-low" },
  plunger: { thrust: "thrust-1h" }, umbrella: { flick: "thrust-1h" }, "garden-shears": { flick: "thrust-1h" },
  darts: { throw: "throw-flick" }, boomerang: { throw: "throw-side" }, hubcap: { throw: "throw-side" }, tyre: { throw: "throw-roll" },
};

/** `uses[held][base]`: the variant name, for every held item that has one. */
export const USES: Readonly<Partial<Record<HeldId, Readonly<Record<string, string>>>>> = (() => {
  const out: Partial<Record<HeldId, Record<string, string>>> = {};
  for (const id of WEAPON_IDS as readonly HeldId[]) {
    const m = WEAPON_META[id];
    const own = { ...(OWN[id] ?? {}) };
    // a two-hand weapon on one shaft, thrown away: both hands over the head
    if (m.hands === 2 && m.pair !== true && m.clip !== "throw" && own.throw === undefined) own.throw = "throw-heave";
    if (Object.keys(own).length > 0) out[id] = own;
  }
  return out;
})();
