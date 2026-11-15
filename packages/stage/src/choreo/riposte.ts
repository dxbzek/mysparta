/** Riposte: after the attacker's recover, the defender swings back before the attacker dashes
 *  home. The defender takes a short step to where its strike meets the attacker. */
import type { StepOf } from "@rankzero/core";
import { evadeEarly, land } from "../effects";
import { aimZone } from "../layout";
import type { Builder } from "../timeline";
import { BEAT } from "../tuning";
import type { Placed } from "./index";

export function riposte(b: Builder, step: StepOf<"riposte">, i: number): Placed {
  const s = b.cursor;
  if (!b.has(step.actor) || !b.has(step.target)) return { at: s, apply: s };
  const dtr = b.track(step.actor);
  const weapon = dtr.rig === "scrapper" ? step.weapon ?? "fists" : null;
  const clip = b.swingClip(step.actor, weapon);
  const hitStop = b.hitStopFor(i, step.crit);
  const sw = b.swing({ i, actor: step.actor, target: step.target, clip, dress: b.dress(step.actor, weapon),
    zone: aimZone(b.track(step.target).rig, i), start: s, mode: "step", combo: false, hitStop, slow: i === b.killStep });
  if (dtr.rig !== "scrapper") b.cue(s, i, "companion", 0, dtr.rig);
  if (step.outcome === "evade") evadeEarly(b, step.target, step.actor, sw.contactAt);
  const ci = land(b, { i, at: sw.contactAt, attacker: step.actor, target: step.target, outcome: step.outcome,
    damage: step.damage, crit: step.crit, hpAfter: step.hpAfter, weapon: step.weapon, hitStop,
    ...(step.procs !== undefined ? { procs: step.procs } : {}) });
  for (const seg of sw.segs) seg.strikes = ci;
  b.cause = { step: i, at: sw.contactAt, actor: step.actor, hitStop };
  b.cursor = sw.end + BEAT.recoverMs;
  return { at: s, apply: sw.contactAt };
}
