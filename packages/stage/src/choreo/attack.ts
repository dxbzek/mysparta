/** A melee swing. Swing 0 carries the anticipation and the dash; a combo or Stubborn swing is
 *  the same clip played short (220 ms, strike at 120) with no new dash. A Haymaker swing has a
 *  wide Volt Yellow trail and the heavy flinch. */
import type { StepOf } from "@rankzero/core";
import { evadeEarly, land } from "../effects";
import { aimZone } from "../layout";
import type { Builder } from "../timeline";
import { BEAT } from "../tuning";
import type { Placed } from "./index";

/** True when the next step is another swing of the same actor in the same turn. */
export function swingsAgain(b: Builder, i: number, actor: string): boolean {
  const next = b.log.steps[i + 1];
  return next !== undefined && (next.t === "attack" || next.t === "throw") && next.n > 0 && next.actor === actor;
}

export function attack(b: Builder, step: StepOf<"attack">, i: number): Placed {
  const s = b.cursor;
  if (!b.has(step.actor) || !b.has(step.target)) return { at: s, apply: s };
  const atr = b.track(step.actor);
  const combo = step.n > 0;
  const weapon = atr.rig === "scrapper" ? step.weapon ?? "fists" : null;
  const lead = b.leadFor(weapon, step.n);
  const dress = b.dress(step.actor, weapon, lead);
  const clip = b.swingClip(step.actor, weapon);
  const hitStop = b.hitStopFor(i, step.crit);
  const boosted = step.boosted === true;
  const sw = b.swing({ i, actor: step.actor, target: step.target, clip, dress, zone: aimZone(atr.rig, b.track(step.target).rig, i),
    start: s, mode: combo ? "step" : "dash", combo, hitStop, slow: i === b.killStep });
  if (step.outcome === "evade") evadeEarly(b, step.target, step.actor, sw.contactAt, i, { clip, weapon, combo });
  const ci = land(b, { i, at: sw.contactAt, attacker: step.actor, target: step.target, outcome: step.outcome,
    damage: step.damage, crit: step.crit, hpAfter: step.hpAfter, weapon: step.weapon, hitStop,
    ...(boosted ? { heavy: true } : {}), ...(step.procs !== undefined ? { procs: step.procs } : {}) });
  for (const seg of sw.segs) seg.strikes = ci;
  if (boosted) {
    const swingStart = sw.segs[0]!.from;
    // (the trail draws its arc round a point 56 over `at`: at the floor that is the shoulder; with
    // the old dy of -46 it drew above the head and off the top of a phone's frame)
    b.fx.push({ fx: "trail", from: swingStart, to: sw.contactAt + 120, x: 0, y: 0, facing: sw.facing,
      seed: b.opts.cosmeticSeed + i, contact: null, follow: step.actor, dy: 0 });
    // the cocked fist still glows through the swing, and the blow bursts on the target (sigs.ts)
    b.sigs.push({ kind: "haymaker-swing", actor: step.actor, target: step.outcome === "hit" ? step.target : null, from: swingStart, to: sw.contactAt + 300, at: sw.contactAt });
    b.boosted.delete(step.actor);
  }
  b.cause = { step: i, at: sw.contactAt, actor: step.actor, hitStop };
  b.cursor = sw.end + (swingsAgain(b, i, step.actor) ? 0 : BEAT.recoverMs);
  return { at: s, apply: sw.contactAt };
}
