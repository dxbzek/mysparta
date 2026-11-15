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
import type { PropId } from "@rankzero/core";
import { propBox } from "../bounds";
import { anchorAt, flightKindOf, flightMs, hubFrom, makePath, pointAt } from "../flight";
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

  // The flight: from the hand at the release to the target's hit point at the arrival. A rolled
  // item (the Tyre) turns about its hub, rolls on the floor and meets the target's shins.
  const hand = b.rig.handAnchor(b.rig.samplePose(tr.rig, clip, strike), dress, { x: me.x, y: me.y, facing });
  const kind = flightKindOf(WEAPON_META[weapon]);
  const wheel = kind === "roll" && weapon !== "fists" ? wheelOf(b, weapon) : null;
  const from = wheel !== null ? hubFrom(hand, wheel, facing) : hand;
  const aimAt = (t: number): { x: number; y: number } => {
    if (wheel === null) return hitSpot(b, step.target, t);
    // its hub on its own radius over the target's floor line, its front rim at the shins
    const p = b.place(step.target, t);
    return { x: hitSpot(b, step.target, t, "legs").x - facing * wheel.r * FLIGHT.rollShin, y: p.y - wheel.r };
  };
  let arrive = release + FLIGHT.minMs;
  let spot = aimAt(arrive);
  for (let k = 0; k < 3; k++) {
    arrive = release + flightMs(Math.hypot(spot.x - from.x, spot.y - from.y));
    spot = aimAt(arrive);
  }
  const path = makePath(kind, from.x, from.y, spot.x, spot.y, facing, arrive - release, hand.rot, wheel ?? undefined);
  const keeps = step.after === "held" && kind !== "return";
  b.flights.push({ item: weapon === "fists" ? "pipe" : weapon, from: release, to: arrive, path,
    after: step.after === "gone" ? "floor" : "vanish" });
  if (!keeps) b.setHeld(step.actor, release, "fists");

  const hitStop = b.hitStopFor(i, step.crit);
  if (step.outcome === "evade") evadeEarly(b, step.target, step.actor, arrive, i, { clip: "throw", weapon, combo });
  land(b, { i, at: arrive, attacker: step.actor, target: step.target, outcome: step.outcome, damage: step.damage,
    crit: step.crit, hpAfter: step.hpAfter, weapon: step.weapon, hitStop, ...(step.procs !== undefined ? { procs: step.procs } : {}),
    // a rolled item bursts where its front rim meets the shins
    ...(wheel !== null ? { burstAt: { x: spot.x + facing * wheel.r, y: spot.y } } : {}) });

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
      done = Math.max(done, dropOnFloor(b, i, step.target, weapon, arrive, FLIGHT.dropFallMs, "drop", anchorAt(path, pointAt(path, 1))));
    }
  }
  if (step.after === "held" || weapon === "fists") b.heldNow.set(step.actor, step.after === "held" ? weapon : "fists");
  else b.heldNow.set(step.actor, "fists");
  b.cause = { step: i, at: arrive, actor: step.actor, hitStop };
  b.cursor = Math.max(done, release + restMs) + (swingsAgain(b, i, step.actor) ? 0 : BEAT.recoverMs);
  return { at: s, apply: arrive };
}

/** A rolled item's hub (the middle of its drawn box at no turn, in its own frame) and radius. */
function wheelOf(b: Builder, item: PropId): { x: number; y: number; r: number } {
  const box = propBox(b.rig, item, { x: 0, y: 0, facing: 1, rot: 0 });
  return { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, r: (box.y1 - box.y0) / 2 };
}
