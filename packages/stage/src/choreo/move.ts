/**
 * A Move (brief 3.12, "What each Move looks like"). Every Move starts with the 500 ms banner
 * over its user, then:
 *   Haymaker      power-up clip; the next swing is boosted (attack.ts draws its trail).
 *   Energy Drink  drink clip with the can in the back hand; the heal step follows.
 *   Tarp          throw clip; the tarp flies to the target and drops over it; the snare follows.
 *   Whistle       power-up clip with the whistle, three sound rings from the head; the heal follows.
 *   Firecrackers  throw clip; the crackers burst at every enemy hit, all at one contact moment.
 *   Snatch        dash in, flick clip, the weapon jumps from the target's hand to the user's.
 *                 Stopped by Firm Grip: the tag, and no jump.
 *   Air Horn      power-up clip with the horn, rings across the stage; the flee steps follow.
 *   Body Slam     dash in, slam on the user and slammed on the target together, contact at the
 *                 floor hit with knockout-size shake; the weapon and shield fly off after.
 * Content v2:
 *   Sand in the Eyes  throw clip; a dust cloud bursts on the target's head.
 *   Taunt         the win clip, a beckoning pose; rings from the head. No boost.
 *   Second Wind   power-up clip, a breath; the heal step follows.
 *   Grapple       dash in, the slam clip with the target held in its hit pose, contact at the
 *                 squeeze; the snare step follows (the target stays held, no tarp lands).
 */
import type { ActorId, StepOf } from "@rankzero/core";
import { toStage } from "@rankzero/rig";
import { hitSpot, land, moveBanner, overHead, skillTag } from "../effects";
import { flightMs, makePath } from "../flight";
import { STAGE_W } from "../layout";
import type { Builder } from "../timeline";
import { BEAT, MOVE } from "../tuning";
import type { Placed } from "./index";

type MoveStep = StepOf<"move">;

export function move(b: Builder, step: MoveStep, i: number): Placed {
  const s = b.cursor;
  if (!b.has(step.actor)) return { at: s, apply: s };
  const tr = b.track(step.actor);
  moveBanner(b, step.actor, s, MOVE.bannerMs, b.opts.text.moveName(step.move));
  b.cue(s, i, "move");
  b.bag(tr.side, s, step.bagAfter);
  b.busy(s, s + MOVE.bannerMs);
  const c = s + MOVE.bannerMs;
  switch (step.move) {
    case "haymaker": return powerUp(b, step, i, s, c, undefined);
    case "energy-drink": {
      const end = b.play(step.actor, "drink", c, { prop: "can" }).to;
      b.cursor = end;
      skillTag(b, step.procs, c);
      return { at: s, apply: end };
    }
    case "whistle": return powerUp(b, step, i, s, c, "whistle");
    case "air-horn": return powerUp(b, step, i, s, c, "horn");
    case "tarp": return tarp(b, step, i, s, c);
    case "firecrackers": return firecrackers(b, step, i, s, c);
    case "snatch": return snatch(b, step, i, s, c);
    case "body-slam": return bodySlam(b, step, i, s, c);
    case "sand-in-the-eyes": return sand(b, step, i, s, c);
    case "taunt": return taunt(b, step, i, s, c);
    case "second-wind": {
      const end = b.play(step.actor, "power-up", c).to;
      b.cursor = end;
      skillTag(b, step.procs, c);
      return { at: s, apply: end };
    }
    case "grapple": return grapple(b, step, i, s, c);
    default: {
      const unknown: never = step.move;
      throw new Error(`stage: no staging for the Move ${String(unknown)}`);
    }
  }
}

function powerUp(b: Builder, step: MoveStep, i: number, s: number, c: number, prop: "whistle" | "horn" | undefined): Placed {
  const seg = b.play(step.actor, "power-up", c, prop !== undefined ? { prop } : {});
  let end = seg.to;
  if (prop !== undefined) {
    // sound rings: from the head for the Whistle; from the head and across the stage for the Air Horn
    const head = overHead(b, step.actor, c);
    const p = b.place(step.actor, c);
    b.fx.push({ fx: "rings", from: c, to: c + MOVE.ringsMs, x: 0, y: 0, facing: p.facing, seed: b.opts.cosmeticSeed + i,
      contact: null, follow: step.actor, dy: head.y + 12 - p.y });
    if (prop === "horn") {
      b.fx.push({ fx: "rings", from: c + 80, to: c + 80 + MOVE.ringsMs, x: STAGE_W / 2, y: 130, facing: 1,
        seed: b.opts.cosmeticSeed + i + 1, contact: null });
      b.fleeAt = c + 160;
    }
    end = Math.max(end, c + MOVE.ringsMs);
  } else {
    b.boosted.add(step.actor);
  }
  skillTag(b, step.procs, c);
  b.cursor = end;
  return { at: s, apply: c };
}

/** The throw clip from where the user stands, facing the target. Returns the release time and the hand there. */
function throwClip(b: Builder, i: number, actor: ActorId, toward: number, c: number): { release: number; end: number; hand: { x: number; y: number; rot: number } } {
  const tr = b.track(actor);
  const info = b.info(tr.rig, "throw");
  const strike = b.strikeOf(info);
  const me = b.place(actor, c);
  const facing: 1 | -1 = toward >= me.x ? 1 : -1;
  b.face(actor, c, facing);
  const seg = b.play(actor, "throw", c);
  const hand = b.rig.handAnchor(b.rig.samplePose(tr.rig, "throw", strike), b.dress(actor), { x: me.x, y: me.y, facing });
  b.cue(c + strike, i, "throw");
  return { release: c + strike, end: seg.to, hand };
}

function tarp(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const target = step.target ?? step.actor;
  if (!b.has(target)) { b.cursor = c; return { at: s, apply: c }; }
  const tp = b.place(target, c);
  const t = throwClip(b, i, step.actor, tp.x, c);
  const arrive = t.release + MOVE.tarpFlightMs;
  const landing = arrive + MOVE.tarpDropMs;
  const spot = b.place(target, arrive);
  // the tarp flies on an arc to above the target, then drops over it
  b.fx.push({ fx: "tarp", from: t.release, to: landing, x: spot.x, y: spot.y, facing: spot.facing, seed: b.opts.cosmeticSeed + i,
    contact: null, fly: { x0: t.hand.x, y0: t.hand.y + 40, ms: MOVE.tarpFlightMs, arc: 30 } });
  b.tarpLanding = { target, at: landing };
  b.cursor = Math.max(t.end, landing);
  return { at: s, apply: landing };
}

function firecrackers(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const hits = (step.hits ?? []).filter((h) => b.has(h.target));
  if (hits.length === 0) { b.cursor = c; return { at: s, apply: c }; }
  const first = b.place(hits[0]!.target, c);
  const t = throwClip(b, i, step.actor, first.x, c);
  // every cracker lands at one moment: the farthest flight sets it
  let ms = 0;
  for (const h of hits) {
    const p = hitSpot(b, h.target, t.release + 200);
    ms = Math.max(ms, flightMs(Math.hypot(p.x - t.hand.x, p.y - t.hand.y)));
  }
  const at = t.release + ms;
  const kill = i === b.killStep;
  const hitStop = b.hitStopFor(i, false);
  let ci: number | undefined;
  for (const h of hits) {
    const p = hitSpot(b, h.target, at);
    b.fx.push({ fx: "crackers", from: t.release, to: at, x: p.x, y: p.y, facing: 1, seed: b.opts.cosmeticSeed + i,
      contact: null, fly: { x0: t.hand.x, y0: t.hand.y, ms, arc: 26 } });
    ci = land(b, { i, at, attacker: step.actor, target: h.target, outcome: "hit", damage: h.damage, crit: false,
      hpAfter: h.hpAfter, weapon: null, hitStop, burstFx: "crackers", ...(kill ? { bigShake: true } : {}) }, ci);
  }
  skillTag(b, step.procs, at);
  b.cause = { step: i, at, actor: step.actor, hitStop };
  b.cursor = Math.max(t.end, at + hitStop) + BEAT.recoverMs;
  return { at: s, apply: at };
}

function snatch(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const target = step.target;
  if (target === undefined || !b.has(target)) { b.cursor = c; return { at: s, apply: c }; }
  const sw = b.swing({ i, actor: step.actor, target, clip: "flick", dress: b.dress(step.actor), zone: "body", start: c,
    mode: "dash", combo: false, hitStop: 0, slow: false });
  const at = sw.contactAt;
  let apply = at;
  if (step.taken !== undefined) {
    const from = b.handAt(target, at);
    const to = b.handAt(step.actor, at + MOVE.snatchJumpMs);
    const path = makePath("pop", from.x, from.y, to.x, to.y, sw.facing, MOVE.snatchJumpMs, from.rot);
    b.flights.push({ item: step.taken, from: at, to: at + MOVE.snatchJumpMs, path: { ...path, arc: 22, spin: 0 }, after: "held" });
    b.setHeld(target, at, "fists");
    b.heldNow.set(target, "fists");
    b.setHeld(step.actor, at + MOVE.snatchJumpMs, step.taken);
    b.heldNow.set(step.actor, step.taken);
    b.cue(at, i, "whoosh");
    apply = at + MOVE.snatchJumpMs;
  }
  skillTag(b, step.procs, at);
  b.cursor = Math.max(sw.end, apply) + BEAT.recoverMs;
  return { at: s, apply };
}

function sand(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const target = step.target;
  if (target === undefined || !b.has(target)) { b.cursor = c; return { at: s, apply: c }; }
  const tp = b.place(target, c);
  const t = throwClip(b, i, step.actor, tp.x, c);
  const head = toStage(b.place(target, t.release), b.rig.hitPoint(b.track(target).rig, b.dress(target), "head"));
  const ms = flightMs(Math.hypot(head.x - t.hand.x, head.y - t.hand.y));
  const at = t.release + ms;
  b.fx.push({ fx: "dust", from: at, to: at + MOVE.ringsMs, x: head.x, y: head.y, facing: tp.facing, seed: b.opts.cosmeticSeed + i,
    contact: null });
  b.play(target, "hit-light", at);
  skillTag(b, step.procs, at);
  b.cursor = Math.max(t.end, at + MOVE.ringsMs);
  return { at: s, apply: at };
}

function taunt(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const seg = b.play(step.actor, "win", c, { until: c + MOVE.ringsMs });
  const head = overHead(b, step.actor, c);
  const p = b.place(step.actor, c);
  b.fx.push({ fx: "rings", from: c, to: c + MOVE.ringsMs, x: 0, y: 0, facing: p.facing, seed: b.opts.cosmeticSeed + i,
    contact: null, follow: step.actor, dy: head.y + 12 - p.y });
  skillTag(b, step.procs, c);
  b.cursor = Math.max(seg.to, c + MOVE.ringsMs);
  return { at: s, apply: c };
}

function grapple(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const target = step.target;
  const hit = step.hits?.[0];
  if (target === undefined || !b.has(target)) { b.cursor = c; return { at: s, apply: c }; }
  const hitStop = b.hitStopFor(i, false);
  const sw = b.swing({ i, actor: step.actor, target, clip: "slam", dress: b.dress(step.actor), zone: "body", start: c,
    mode: "dash", combo: false, hitStop, slow: i === b.killStep });
  let ci: number | null = null;
  if (hit !== undefined) {
    ci = land(b, { i, at: sw.contactAt, attacker: step.actor, target, outcome: "hit", damage: hit.damage, crit: false,
      hpAfter: hit.hpAfter, weapon: null, hitStop });
    for (const sg of sw.segs) sg.strikes = ci;
  }
  skillTag(b, step.procs, sw.contactAt);
  b.cause = { step: i, at: sw.contactAt, actor: step.actor, hitStop };
  b.cursor = sw.end + BEAT.recoverMs;
  return { at: s, apply: sw.contactAt };
}

function bodySlam(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const target = step.target;
  const hit = step.hits?.[0];
  if (target === undefined || !b.has(target)) { b.cursor = c; return { at: s, apply: c }; }
  const hitStop = b.hitStopFor(i, false);
  const sw = b.swing({ i, actor: step.actor, target, clip: "slam", dress: b.dress(step.actor), zone: "body", start: c,
    mode: "dash", combo: false, hitStop, slow: i === b.killStep });
  // the target's slammed clip runs with the slam, so it hits the floor at the contact
  const ttr = b.track(target);
  const slammed = ttr.rig === "scrapper" ? "slammed" : "hit";
  const info = b.info(ttr.rig, slammed);
  const landAt = info.events.find((e) => e.name === "land")?.t ?? b.strikeOf(info);
  const from = Math.max(c, sw.contactAt - landAt);
  const seg = b.play(target, slammed, from);
  let ci: number | null = null;
  if (hit !== undefined) {
    ci = land(b, { i, at: sw.contactAt, attacker: step.actor, target, outcome: "hit", damage: hit.damage, crit: false,
      hpAfter: hit.hpAfter, weapon: null, hitStop, ownClip: true, bigShake: true });
    for (const sg of sw.segs) sg.strikes = ci;
  }
  skillTag(b, step.procs, sw.contactAt);
  b.cause = { step: i, at: sw.contactAt, actor: step.actor, hitStop };
  b.cursor = Math.max(sw.end, seg.to) + BEAT.recoverMs;
  return { at: s, apply: sw.contactAt };
}
