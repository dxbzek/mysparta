/**
 * A throw. The thrower winds up from where it stands; the item leaves the hand at the clip's
 * strike (its `release`, or the contact of a fallback clip) and flies as its own prop by its
 * flight kind (flight.ts) to the target's hit point. Contact is on arrival. Then, by `after`:
 * "held" the hand keeps it (Darts), or a Boomerang flies back to the hand; "bag" it fades back
 * to the bag; "gone" it drops to the floor and stays.
 */
import type { StepOf } from "@rankzero/core";
import { WEAPON_META } from "@rankzero/core";
import { evadeEarly, hitSpot, land } from "../effects";
import { flightKindOf, flightMs, makePath } from "../flight";
import type { Builder } from "../timeline";
import { BEAT, FLIGHT } from "../tuning";
import type { Placed } from "./index";
import { swingsAgain } from "./attack";
import { dropOnFloor } from "./props";

export function throwStep(b: Builder, step: StepOf<"throw">, i: number): Placed {
  const s = b.cursor;
  if (!b.has(step.actor) || !b.has(step.target)) return { at: s, apply: s };
  const tr = b.track(step.actor);
  const weapon = step.weapon ?? "fists";
  const clip = b.swingClip(step.actor, weapon, true);
  const info = b.info(tr.rig, clip);
  const strike = b.strikeOf(info);
  const combo = step.n > 0;
  const strikeIn = combo ? BEAT.comboStrikeMs : strike;
  const release = s + strikeIn;
  const me = b.place(step.actor, s);
  const tp = b.place(step.target, s);
  const facing: 1 | -1 = tp.x >= me.x ? 1 : -1;
  b.face(step.actor, s, facing);
  const dress = b.dress(step.actor, weapon);
  // the clip: wind-up to the release, then the recoil
  b.play(step.actor, clip, s, { rate: strike / strikeIn, until: release });
  const rest = info.durationMs - strike;
  const restMs = combo ? BEAT.comboMs - BEAT.comboStrikeMs : rest;
  b.play(step.actor, clip, release, { c0: strike, rate: restMs > 0 ? rest / restMs : 1, until: release + Math.max(1, restMs) });
  b.cue(release, i, "throw", 0, weapon);
  b.bag(tr.side, release, step.bagAfter);

  // The flight: from the hand at the release to the target's hit point at the arrival.
  const hand = b.rig.handAnchor(b.rig.samplePose(tr.rig, clip, strike), dress, { x: me.x, y: me.y, facing });
  let arrive = release + FLIGHT.minMs;
  let spot = hitSpot(b, step.target, arrive);
  for (let k = 0; k < 3; k++) {
    arrive = release + flightMs(Math.hypot(spot.x - hand.x, spot.y - hand.y));
    spot = hitSpot(b, step.target, arrive);
  }
  const kind = flightKindOf(WEAPON_META[weapon]);
  const path = makePath(kind, hand.x, hand.y, spot.x, spot.y, facing, arrive - release, hand.rot);
  const keeps = step.after === "held" && kind !== "return";
  b.flights.push({ item: weapon === "fists" ? "pipe" : weapon, from: release, to: arrive, path,
    after: step.after === "gone" ? "floor" : "vanish" });
  if (!keeps) b.setHeld(step.actor, release, "fists");

  const hitStop = b.hitStopFor(i, step.crit);
  if (step.outcome === "evade") evadeEarly(b, step.target, step.actor, arrive);
  land(b, { i, at: arrive, attacker: step.actor, target: step.target, outcome: step.outcome, damage: step.damage,
    crit: step.crit, hpAfter: step.hpAfter, weapon: step.weapon, hitStop, ...(step.procs !== undefined ? { procs: step.procs } : {}) });

  let done = arrive + hitStop;
  if (weapon !== "fists") {
    if (step.after === "held" && kind === "return") {
      // the Boomerang comes back to the hand on its own flight
      // aimed at where the hand will be when it gets there
      let back = b.handAt(step.actor, arrive);
      let ms = flightMs(Math.hypot(back.x - spot.x, back.y - spot.y));
      for (let k = 0; k < 3; k++) {
        back = b.handAt(step.actor, arrive + ms);
        ms = flightMs(Math.hypot(back.x - spot.x, back.y - spot.y));
      }
      back = b.handAt(step.actor, arrive + ms);
      b.flights.push({ item: weapon, from: arrive, to: arrive + ms, path: makePath("return", spot.x, spot.y, back.x, back.y,
        (back.x >= spot.x ? 1 : -1), ms, path.rot0 + path.spin * path.ms), after: "held" });
      b.setHeld(step.actor, arrive + ms, weapon);
      done = Math.max(done, arrive + ms);
    } else if (step.after === "gone") {
      done = Math.max(done, dropOnFloor(b, i, step.target, weapon, arrive, FLIGHT.dropFallMs, "drop", { x: spot.x, y: spot.y, rot: path.rot0 + path.spin * path.ms }));
    }
  }
  if (step.after === "held" || weapon === "fists") b.heldNow.set(step.actor, step.after === "held" ? weapon : "fists");
  else b.heldNow.set(step.actor, "fists");
  b.cause = { step: i, at: arrive, actor: step.actor, hitStop };
  b.cursor = Math.max(done, release + restMs) + (swingsAgain(b, i, step.actor) ? 0 : BEAT.recoverMs);
  return { at: s, apply: arrive };
}
