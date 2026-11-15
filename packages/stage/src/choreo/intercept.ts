/** Intercept: the actor whose turn it is (`target`) dashes in; at 70% of its dash the defender
 *  (`actor`) steps in and swings first. The dasher takes the hit and backs off. */
import type { StepOf } from "@rankzero/core";
import { evadeEarly, land } from "../effects";
import { aimZone, stopFor } from "../layout";
import type { Builder } from "../timeline";
import { BEAT, OUTCOME } from "../tuning";
import type { Placed } from "./index";

export function intercept(b: Builder, step: StepOf<"intercept">, i: number): Placed {
  const s = b.cursor;
  if (!b.has(step.actor) || !b.has(step.target)) return { at: s, apply: s };
  const dasher = step.target;
  const def = step.actor;
  const atr = b.track(dasher);
  const dtr = b.track(def);
  const from = b.place(dasher, s);
  const dp = b.place(def, s);
  const facing: 1 | -1 = dp.x >= from.x ? 1 : -1;
  // Where the dasher would have stopped for its own swing; it gets 70% of the way there.
  const aWeapon = atr.rig === "scrapper" ? b.heldNow.get(dasher) ?? "fists" : null;
  const own = stopFor(b.rig, { rig: atr.rig, dress: b.dress(dasher), clip: b.swingClip(dasher, aWeapon), facing },
    { rig: dtr.rig, dress: b.dress(def), x: dp.x, facing: dp.facing }, "body");
  const xA = from.x + OUTCOME.interceptAt * (own.x - from.x);
  const yA = dp.y;
  const dist = Math.hypot(xA - from.x, yA - from.y);
  const dashMs = Math.max(BEAT.dashMinMs, Math.round((dist / BEAT.dashSpeed) * 1000));
  const arrive = s + BEAT.anticipationMs + dashMs;
  b.face(dasher, s, facing);
  if (atr.rig === "scrapper") b.play(dasher, "brace", s, { until: s + BEAT.anticipationMs });
  else b.play(dasher, "run", s, { rate: 0, until: s + BEAT.anticipationMs });
  b.move(dasher, s + BEAT.anticipationMs, dashMs, xA, yA, 0, "out");
  b.play(dasher, atr.rig === "scrapper" ? "dash" : "run", s + BEAT.anticipationMs, { until: arrive });
  b.cue(s + BEAT.anticipationMs, i, "dash");
  b.out.add(dasher);

  // The defender's swing lands as the dasher arrives.
  const weapon = dtr.rig === "scrapper" ? step.weapon ?? "fists" : null;
  const clip = b.swingClip(def, weapon);
  const strike = b.strikeOf(b.info(dtr.rig, clip));
  const hitStop = b.hitStopFor(i, step.crit);
  const sw = b.swing({ i, actor: def, target: dasher, clip, dress: b.dress(def, weapon), zone: aimZone(atr.rig, i),
    start: arrive - strike, mode: "step", combo: false, hitStop, slow: i === b.killStep });
  if (dtr.rig !== "scrapper") b.cue(sw.segs[0]!.from, i, "companion", 0, dtr.rig);
  if (step.outcome === "evade") evadeEarly(b, dasher, def, sw.contactAt);
  const ci = land(b, { i, at: sw.contactAt, attacker: def, target: dasher, outcome: step.outcome, damage: step.damage,
    crit: step.crit, hpAfter: step.hpAfter, weapon: step.weapon, hitStop, ...(step.procs !== undefined ? { procs: step.procs } : {}) });
  for (const seg of sw.segs) seg.strikes = ci;
  b.cause = { step: i, at: sw.contactAt, actor: def, hitStop };
  b.cursor = Math.max(sw.end, sw.contactAt + hitStop + 200) + BEAT.recoverMs;
  return { at: s, apply: sw.contactAt };
}
