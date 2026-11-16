/**
 * A Move (brief 3.12, "What each Move looks like"). A Move simply happens inside the fight flow
 * (owner, 15 Nov 2026, after a wind-up with a dim, a floor ring and a banner: "I don't like the
 * skill preview. It should just show"). No pause, no dim, no ring, no banner, nobody freezing:
 *
 *   1. As the step starts, the user does the action at once and a small tag with the Move's icon
 *      and name pops over it (900 ms, like a passive's tag). The host lights the card's tile.
 *      Whatever hangs on the back arm (the shield) or fills both hands (a two-hand item) is
 *      slung on the back for the Move (`sling`), so the object and the gesture read: at level 30
 *      three Moves in four were used behind a pallet or a car door that hid the whistle, the
 *      horn, the can and the fist pump. A target that has to show its reaction does the same.
 *   2. The action, with the real object and the Move's own signature (sigs.ts) (owner, 16 Nov
 *      2026: "The effects aren't there"):
 *      Haymaker      he coils into the charge, fist cocked back and glowing, sparks crackling on
 *                    it, speed lines off his back; the next swing glows and bursts on the target.
 *      Energy Drink  he lifts the can and chugs it, head back (drink clip, the can in hand), fizz
 *                    off the can; a green glow and crackle as it kicks in.
 *      Tarp          he throws; the tarp flies over the target, drops and wraps it.
 *      Whistle       he blows the whistle (the whistle in front of his face): teal sound arcs
 *                    from his mouth; the pet sprints to his side, behind him, away from the enemy.
 *      Firecrackers  the lit bundle fizzes in his hand, he throws, it lands at the enemy's feet
 *                    and pops all round it.
 *      Snatch        he dashes in and flicks the weapon out of the enemy's hand into his own.
 *      Air Horn      he holds the horn up and blasts it: sound waves cross the stage in a cone,
 *                    the enemy clamps its hands over its ears in shock marks (rig "ears"), its
 *                    pets jump and run off.
 *      Body Slam     he dashes in, grabs, hauls the enemy over his head and slams it into the
 *                    floor (slam on the user, slammed on the target, contact at the floor hit).
 *      Sand in the Eyes  he throws a handful at the enemy's face; a tan cloud bursts on it and it
 *                    rubs its eyes, groping blind (rig "rub-eyes").
 *      Taunt         two fist pumps and a beckon, shouting (rig "taunt"); the enemy squares up,
 *                    fists shaking, anger marks and steam (rig "angry").
 *      Second Wind   he breathes in deep in a green glow, air pulled into his mouth.
 *      Grapple       he dashes in and squeezes the enemy in a bear hug; it struggles in the hold,
 *                    strain marks and sweat.
 *   3. The visible result: a heal's green number, the snared target under the tarp, the weapon in
 *      the other hand, and a result tag in the host's words with the Move's icon ("-25 AIM",
 *      "SNARED", "2x NEXT HIT").
 * Everything is timed from the log and is a pure function of time like the rest of the stage.
 */
import type { ActorId, MoveId, StepOf } from "@rankzero/core";
import { WEAPON_META, sideOf } from "@rankzero/core";
import { toStage } from "@rankzero/rig";
import { land, moveNameTag, overHead, resultTag, skillTag } from "../effects";
import { flightMs, makePath } from "../flight";
import { CORAL, GREEN, SKY, VOLT } from "../palette";
import { drawnScale, layWay, planWay } from "../footwork";
import { BODY_GAP, SCRAPPER_REACH } from "../layout";
import type { Sig, SigKind } from "../model";
import type { Builder } from "../timeline";
import { drawnBox } from "../bounds";
import { clearLanding } from "./fall";
import { BEAT, MOVE } from "../tuning";
import type { Placed } from "./index";

type MoveStep = StepOf<"move">;

export function move(b: Builder, step: MoveStep, i: number): Placed {
  const s = b.cursor;
  if (!b.has(step.actor)) return { at: s, apply: s };
  // the action starts at once: the bag, the small name tag over the user. No stinger: each Move
  // sounds its own action when it shows and its effect when it lands (contract rev 4; a shared
  // music hit on every Move was an audio banner and made every skill sound the same)
  b.bag(b.track(step.actor).side, s, step.bagAfter);
  moveNameTag(b, step.move, step.actor, s);
  const placed = action(b, step, i, s, s);
  // (a Snatch that takes nothing has no act sound: the hand closes on air, its swing swish is all)
  const noSound = step.move === "snatch" && step.taken === undefined;
  if (!noSound && !b.cues.some((q) => q.step === i && q.beat === "act")) b.moveCue(s, i, step.move, "act");
  // the user's own clips of this Move end where its last one does (the open idle that footwork
  // lays after a walk is not one of them: with it the sling never ended, and after a Grapple or a
  // Body Slam the user's shield stayed on its back for the rest of the bout)
  const end = Math.max(b.cursor, ...b.track(step.actor).segs.filter((g) => g.from >= s && g.busy && g.to !== Infinity).map((g) => g.to));
  sling(b, step.actor, s, end, step.move !== "snatch");
  // at 2x and 3x the clock plays the Move at 1x: from the action to the end of its signature (and
  // at least the name tag), so it can be told apart (clock.ts)
  const sigEnd = b.sigs.filter((g) => g.from >= s && g.actor === step.actor && g.to !== Infinity).reduce((m, g) => Math.max(m, g.to), s);
  b.holds.push([s, Math.min(Math.max(end, sigEnd, s + MOVE.nameTagMs), s + MOVE.holdMaxMs)]);
  return placed;
}

/**
 * The shield (and a two-hand item, unless the hands need it) is slung on the back for a Move's
 * action or a target's reaction, so the gesture reads: on the back arm it covered the chest, the
 * whistle, the horn, the can, the fist pump, the hands at the ears and at the eyes.
 */
export function sling(b: Builder, id: ActorId, from: number, to: number, twoHandToo = true): void {
  if (!b.has(id) || b.track(id).rig !== "scrapper" || to <= from) return;
  const shield = (b.shieldNow.get(id) ?? null) !== null;
  const held = b.heldNow.get(id) ?? "fists";
  const meta = held === "fists" ? undefined : WEAPON_META[held];
  const twoHand = twoHandToo && meta !== undefined && meta.hands === 2 && meta.pair !== true;
  if (shield || twoHand) b.slings.push({ actor: id, from, to, shield, held: twoHand });
}

/** A skill's own picture (sigs.ts paints it): from, to, and what it needs. */
function sig(b: Builder, step: MoveStep, from: number, to: number, extra: Partial<Sig> & { kind?: SigKind } = {}): void {
  b.sigs.push({ kind: step.move, actor: step.actor, target: step.target ?? null, from, to, ...extra });
}

type Span = readonly [from: number, to: number];
/** The three parts of the power-up clip, from its `step` events (clip ms). */
export function powerParts(b: Builder, actor: ActorId): { breath: Span; charge: Span; blow: Span } {
  const info = b.info(b.track(actor).rig, "power-up");
  const d = info.durationMs;
  const marks = info.events.filter((e) => e.name === "step").map((e) => e.t).sort((x, y) => x - y);
  const [m0, m1, m2] = marks.length >= 3 ? marks : MOVE.partShares.map((k) => Math.round(d * k));
  return { breath: [0, m0!], charge: [m0!, m1!], blow: [m2!, d] };
}
/** The clip time of the slam clip's grab pose, from its `step` event. */
function grabTime(b: Builder, actor: ActorId): number {
  const info = b.info(b.track(actor).rig, "slam");
  return info.events.find((e) => e.name === "step")?.t ?? Math.round(b.strikeOf(info) * MOVE.partShares[0]);
}

function action(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  switch (step.move) {
    case "haymaker": return haymaker(b, step, i, s, c);
    case "energy-drink": {
      const end = b.play(step.actor, "drink", c, { prop: "can" }).to;
      sig(b, step, c, end + 120);
      // the can cracks open as it comes up; the gulps as his head goes back
      b.moveCue(c, i, "energy-drink", "act");
      b.moveCue(c + Math.round((end - c) * MOVE.gulpShare), i, "energy-drink", "effect");
      // it kicks in: a green glow round him as he finishes the can
      b.auras.push({ from: c + Math.round((end - c) * 0.6), to: end + 260, actor: step.actor, colour: GREEN });
      // the heal shows as he finishes the gulp
      b.cursor = c + Math.round((end - c) * 0.72);
      skillTag(b, step.procs, c);
      return { at: s, apply: c };
    }
    case "whistle": return blow(b, step, i, s, c, "whistle");
    case "air-horn": return blow(b, step, i, s, c, "horn");
    case "tarp": return tarp(b, step, i, s, c);
    case "firecrackers": return firecrackers(b, step, i, s, c);
    case "snatch": return snatch(b, step, i, s, c);
    case "body-slam": return bodySlam(b, step, i, s, c);
    case "sand-in-the-eyes": return sand(b, step, i, s, c);
    case "taunt": return taunt(b, step, i, s, c);
    case "second-wind": {
      // he breathes in deep in a green glow; the heal step shows its number during it
      const [b0, b1] = powerParts(b, step.actor).breath;
      b.play(step.actor, "power-up", c, { c0: b0, rate: (b1 - b0) / MOVE.breathMs, until: c + MOVE.breathMs });
      b.moveCue(c, i, "second-wind", "act");   // the deep breath in
      b.auras.push({ from: c, to: c + MOVE.breathMs + 150, actor: step.actor, colour: GREEN });
      sig(b, step, c, c + MOVE.breathMs + 150);
      b.cursor = c + 160;
      skillTag(b, step.procs, c);
      return { at: s, apply: c };
    }
    case "grapple": return grapple(b, step, i, s, c);
    default: {
      const unknown: never = step.move;
      throw new Error(`stage: no staging for the Move ${String(unknown)}`);
    }
  }
}

/** The enemy scrapper of an actor, when it is in the bout and standing. */
function enemyOf(b: Builder, id: ActorId): ActorId | null {
  const e: ActorId = sideOf(id) === "a" ? "b0" : "a0";
  return b.has(e) && b.status.get(e) === "up" ? e : null;
}

function haymaker(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const [c0, c1] = powerParts(b, step.actor).charge;
  b.play(step.actor, "power-up", c, { c0, rate: (c1 - c0) / MOVE.chargeMs, until: c + MOVE.chargeMs });
  b.moveCue(c, i, "haymaker", "act");   // the charge crackles on the fist
  // sparks crackle on the cocked fist
  const p = b.place(step.actor, c);
  b.fx.push({ fx: "spark", from: c + 140, to: c + MOVE.chargeMs, x: p.x, y: p.y, facing: p.facing, seed: b.opts.cosmeticSeed + i,
    contact: null, loopMs: 130, track: b.handTrack(step.actor, c + 140, c + MOVE.chargeMs) });
  sig(b, step, c, c + MOVE.chargeMs + 120);
  resultTag(b, "haymaker", step.actor, c + 180, VOLT);
  b.boosted.add(step.actor);
  skillTag(b, step.procs, c);
  b.cursor = c + MOVE.chargeMs;
  return { at: s, apply: c };
}

/** Whistle or Air Horn: the object up at the face, the blast, the rings. */
function blow(b: Builder, step: MoveStep, i: number, s: number, c: number, prop: "whistle" | "horn"): Placed {
  const [w0, w1] = powerParts(b, step.actor).blow;
  b.play(step.actor, "power-up", c, { c0: w0, rate: (w1 - w0) / MOVE.blowMs, until: c + MOVE.blowMs, prop });
  b.moveCue(c, i, step.move, "act");   // the whistle or the horn blast, as the rings leave the mouth
  const head = overHead(b, step.actor, c);
  const p = b.place(step.actor, c);
  // the rings draw 66 above `at`: centred on the mouth, out past the object's end, so the
  // whistle or the horn in front of the face is not under them
  b.fx.push({ fx: "rings", from: c, to: c + MOVE.ringsMs, x: MOVE.ringsOut[prop], y: 0, facing: p.facing, seed: b.opts.cosmeticSeed + i,
    contact: null, follow: step.actor, dy: head.y + 80 - p.y });
  if (prop === "whistle") sig(b, step, c, c + MOVE.blowMs);
  if (prop === "horn") {
    // the blast crosses the stage: rings at a third and two thirds of the way to the enemy, then
    // the enemy scrapper claps its hands over its ears and its pets run (the flee steps follow,
    // at `fleeAt`); the sound waves (sigs.ts) run until `at`, its shock marks while it winces
    const enemy = enemyOf(b, step.actor);
    sig(b, step, c, enemy !== null ? c + 160 + MOVE.earsMs : c + MOVE.blowMs, { target: enemy, at: c + MOVE.blowMs });
    const ex = enemy !== null ? b.place(enemy, c).x : p.x + p.facing * 120;
    for (const k of [1, 2]) {
      b.fx.push({ fx: "rings", from: c + 70 * k, to: c + 70 * k + MOVE.ringsMs, x: p.x + ((ex - p.x) * k) / 3, y: p.y + 4, facing: p.facing,
        seed: b.opts.cosmeticSeed + i + k, contact: null });
    }
    if (enemy !== null) {
      b.play(enemy, "ears", c + 160, { until: c + 160 + MOVE.earsMs, busy: false });
      sling(b, enemy, c + 160, c + 160 + MOVE.earsMs);
      resultTag(b, "air-horn", enemy, c + 200, CORAL);
    }
    b.fleeAt = c + 300;
  }
  skillTag(b, step.procs, c);
  b.cursor = prop === "whistle" ? c + Math.round(MOVE.ringsMs * 0.6) : c + MOVE.blowMs;
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
  b.moveCue(c, i, "tarp", "act");            // the tarp shaken out
  b.moveCue(landing, i, "tarp", "effect");   // it slaps down and wraps the target
  sig(b, step, t.release, arrive + 60, { target, fly: { x0: t.hand.x, y0: t.hand.y, x1: spot.x, y1: spot.y - 40, ms: MOVE.tarpFlightMs, arc: 30 } });
  resultTag(b, "tarp", target, landing + 60, CORAL);
  b.cursor = Math.max(t.end, landing);
  return { at: s, apply: landing };
}

function firecrackers(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const hits = (step.hits ?? []).filter((h) => b.has(h.target));
  if (hits.length === 0) { b.cursor = c; return { at: s, apply: c }; }
  const first = b.place(hits[0]!.target, c);
  const t = throwClip(b, i, step.actor, first.x, c);
  const lit = MOVE.crackersLit;
  const seed = b.opts.cosmeticSeed + i;
  // the lit bundle fizzes in the throwing hand until it leaves it
  b.fx.push({ fx: "crackers", from: c, to: t.release, x: t.hand.x, y: t.hand.y, facing: 1, seed, contact: null,
    track: b.handTrack(step.actor, c, t.release, 25), p0: 0, p1: lit * 0.6 });
  b.moveCue(c, i, "firecrackers", "act");   // the fuse fizzes
  sig(b, step, c, t.release + 60);
  // a bundle flies to each target's feet; they all land at one moment (the farthest sets it)
  let ms = 0;
  for (const h of hits) {
    const p = b.place(h.target, t.release + 200);
    ms = Math.max(ms, flightMs(Math.hypot(p.x - t.hand.x, p.y - 8 - t.hand.y)));
  }
  const at = t.release + ms;
  const hitStop = b.hitStopFor(i, false);
  let ci: number | undefined;
  for (const h of hits) {
    const p = b.place(h.target, at);
    b.fx.push({ fx: "crackers", from: t.release, to: at, x: p.x, y: p.y - 8, facing: 1, seed, contact: null,
      fly: { x0: t.hand.x, y0: t.hand.y, ms, arc: 26 }, p0: lit * 0.6, p1: lit });
    ci = land(b, { i, at, attacker: step.actor, target: h.target, outcome: "hit", damage: h.damage, crit: false,
      hpAfter: h.hpAfter, weapon: null, hitStop, burstFx: "crackers", move: "firecrackers" }, ci);
  }
  skillTag(b, step.procs, at);
  b.cause = { step: i, at, actor: step.actor, hitStop };
  b.cursor = Math.max(t.end, at + hitStop) + BEAT.recoverMs;
  return { at: s, apply: at };
}

function snatch(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const target = step.target;
  if (target === undefined || !b.has(target)) { b.cursor = c; return { at: s, apply: c }; }
  // it stops at arm's length and flicks the weapon out of the hand (review round 2: the dash ran
  // into the body and the two fighters stacked into one shape)
  const sw = b.swing({ i, actor: step.actor, target, clip: "flick", dress: b.dress(step.actor), zone: "body", start: c,
    mode: "dash", combo: false, hitStop: 0, slow: false,
    minRoom: (BODY_GAP.body + MOVE.snatchReach) * Math.max(drawnScale(b, step.actor), drawnScale(b, target)) + b.lungeOf(step.actor, "flick") });
  const at = sw.contactAt;
  let apply = at;
  // the robbed hand shows: the target's shield goes on its back for the moment of the snatch
  sling(b, target, at - 260, at + MOVE.snatchJumpMs + 160, false);
  if (step.taken !== undefined) {
    const from = b.handAt(target, at);
    const to = b.handAt(step.actor, at + MOVE.snatchJumpMs);
    const path = makePath("pop", from.x, from.y, to.x, to.y, sw.facing, MOVE.snatchJumpMs, from.rot);
    b.flights.push({ item: step.taken, from: at, to: at + MOVE.snatchJumpMs, path: { ...path, arc: 22, spin: 0 }, after: "held" });
    sig(b, step, at, at + MOVE.snatchJumpMs + 120, { fly: { x0: from.x, y0: from.y, x1: to.x, y1: to.y, ms: MOVE.snatchJumpMs, arc: 22 } });
    b.setHeld(target, at, "fists");
    b.heldNow.set(target, "fists");
    b.setHeld(step.actor, at + MOVE.snatchJumpMs, step.taken);
    b.heldNow.set(step.actor, step.taken);
    b.moveCue(at, i, "snatch", "act");   // the grab on the weapon (only when there is one to grab)
    b.cue(at, i, "whoosh", 0, step.taken);
    // the robbed hand jerks back, empty
    b.play(target, "hit-light", at, { busy: false });
    b.knockStep(target, at, false, sw.facing);
    resultTag(b, "snatch", step.actor, at + MOVE.snatchJumpMs, VOLT);
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
  // the handful leaves the hand as a few puffs, one after another, and bursts on the face
  for (let k = 0; k < 3; k++) {
    const from = t.release + k * MOVE.sandGapMs;
    b.fx.push({ fx: "dust", from, to: from + ms, x: head.x, y: head.y + (k - 1) * 3, facing: tp.facing, seed: b.opts.cosmeticSeed + i + k,
      contact: null, fly: { x0: t.hand.x, y0: t.hand.y, ms, arc: 8 }, p0: 0.15, p1: 0.45 });
  }
  const at = t.release + ms;
  b.moveCue(c, i, "sand-in-the-eyes", "act");      // the handful scooped up
  b.moveCue(at, i, "sand-in-the-eyes", "effect");  // the sand bursts on the face
  // it bursts on the face in a tan cloud (sigs.ts; the floor's dust kick drew above the head, in
  // the tag row), and it rubs its eyes, groping blind
  b.play(target, "rub-eyes", at, { until: at + MOVE.rubMs, busy: false });
  sling(b, target, at, at + MOVE.rubMs);
  sig(b, step, at, at + MOVE.rubMs, { target, at });
  resultTag(b, "sand-in-the-eyes", target, at + 80, CORAL);
  skillTag(b, step.procs, at);
  b.cursor = Math.max(t.end, at + 360);
  return { at: s, apply: at };
}

function taunt(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  // two fist pumps and a beckon, shouting (rig "taunt"; it was the win celebration, which read as
  // standing there with a raised fist)
  // (no sound rings: those are the Whistle's and the Air Horn's picture; the shout is a balloon)
  const seg = b.play(step.actor, "taunt", c, { until: c + MOVE.tauntMs });
  sig(b, step, c, c + MOVE.tauntMs - 80);
  b.moveCue(c + MOVE.tauntShoutMs, i, "taunt", "act");   // the shout, with the rings from his mouth
  // it works: the enemy squares up, fists shaking, anger marks and steam
  const enemy = enemyOf(b, step.actor);
  if (enemy !== null) {
    const a0 = c + 260;
    b.play(enemy, "angry", a0, { until: a0 + MOVE.angryMs, busy: false });
    b.moveCue(a0 + MOVE.angrySnortMs, i, "taunt", "effect");   // the enemy's angry snort
    sling(b, enemy, a0, a0 + MOVE.angryMs);
    b.sigs.push({ kind: "angry", actor: enemy, target: null, from: a0, to: a0 + MOVE.angryMs });
  }
  resultTag(b, "taunt", step.actor, c + 160, SKY);
  skillTag(b, step.procs, c);
  b.cursor = Math.max(seg.to, c + MOVE.ringsMs);
  return { at: s, apply: c };
}

/** Body Slam and Grapple close in the same way: a dash to stand right against the target. */
function closeIn(b: Builder, i: number, actor: ActorId, target: ActorId, c: number, gap: number): { at: number; facing: 1 | -1 } {
  const me = b.place(actor, c);
  const tp = b.place(target, c);
  const facing: 1 | -1 = tp.x >= me.x ? 1 : -1;
  const stopX = tp.x - facing * gap;
  const feet = b.track(actor).rig === "scrapper" && b.internal.easedDash !== true;
  // real footwork (footwork.ts): the run or the shuffle, set at the target when it ends
  const way = feet ? planWay(b, actor, stopX - me.x, tp.y - me.y, true) : null;
  const dashMs = way !== null ? way.ms : Math.max(BEAT.dashMinMs, Math.round((Math.abs(stopX - me.x) / BEAT.dashSpeed) * 1000));
  b.face(actor, c, facing);
  // (a shuffle needs no brace before it: its own dip is the wind-up)
  if (way?.kind !== "hop") {
    b.play(actor, "brace", c, { rate: way !== null ? b.info("scrapper", "brace").durationMs / BEAT.anticipationMs : 1, until: c + BEAT.anticipationMs });
  }
  if (way !== null) layWay(b, actor, c + BEAT.anticipationMs, stopX, tp.y, way);
  else {
    b.move(actor, c + BEAT.anticipationMs, dashMs, stopX, tp.y, 0, "inOut");
    b.play(actor, "dash", c + BEAT.anticipationMs, { until: c + BEAT.anticipationMs + dashMs });
  }
  b.cue(c + BEAT.anticipationMs, i, "dash");
  b.out.add(actor);
  if (b.track(target).rig === "scrapper" && b.status.get(target) === "up") {
    b.play(target, "brace", c + BEAT.anticipationMs, { until: c + BEAT.anticipationMs + dashMs, busy: false });
  }
  return { at: c + BEAT.anticipationMs + dashMs, facing };
}

function grapple(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const target = step.target;
  const hit = step.hits?.[0];
  if (target === undefined || !b.has(target)) { b.cursor = c; return { at: s, apply: c }; }
  const g = closeIn(b, i, step.actor, target, c, MOVE.hugGap).at;
  // the grab (the slam clip's reach in), then the squeeze: the bear hug (rig "hug": arms locked
  // round its ribs, heaving), the target in the hold (rig "hugged": bent back, arms flung up, legs
  // kicking). A pet has no such clip: it holds its snared pose.
  const grab = grabTime(b, step.actor);
  const pair = b.track(step.actor).rig === "scrapper" && b.track(target).rig === "scrapper";
  b.play(step.actor, "slam", g, { until: g + grab });
  if (pair) b.play(step.actor, "hug", g + grab, { until: g + grab + MOVE.squeezeMs });
  else b.play(step.actor, "slam", g + grab, { c0: grab, rate: 0, until: g + grab + MOVE.squeezeMs });
  b.moveCue(g + grab, i, "grapple", "act");   // the grab: a grunt and the cloth bunching
  b.play(target, pair ? "hugged" : "snared", g + grab, { until: g + grab + MOVE.squeezeMs, busy: false });
  // the hug lifts it off its feet for the squeeze, and it drops back (review round 2: two bodies
  // standing flat, stacked, read as two people back to back)
  if (b.track(target).rig === "scrapper") {
    b.nudge({ actor: target, key: "lift", from: g + grab, outMs: MOVE.hugLiftMs, holdMs: Math.max(0, MOVE.squeezeMs - 2 * MOVE.hugLiftMs),
      backMs: MOVE.hugLiftMs, dx: 0, arc: MOVE.hugLift, contact: null });
  }
  sling(b, target, g, g + grab + MOVE.squeezeMs);
  sig(b, step, g + grab - 60, g + grab + MOVE.squeezeMs, { target });
  const at = g + grab + MOVE.squeezeHitMs;
  if (hit !== undefined) {
    land(b, { i, at, attacker: step.actor, target, outcome: "hit", damage: hit.damage, crit: false,
      hpAfter: hit.hpAfter, weapon: null, hitStop: 0, ownClip: true, move: "grapple" });
  }
  resultTag(b, "grapple", target, at + 80, CORAL);
  skillTag(b, step.procs, at);
  b.cause = { step: i, at, actor: step.actor, hitStop: 0 };
  b.cursor = g + grab + MOVE.squeezeMs;
  return { at: s, apply: at };
}

function bodySlam(b: Builder, step: MoveStep, i: number, s: number, c: number): Placed {
  const target = step.target;
  const hit = step.hits?.[0];
  if (target === undefined || !b.has(target)) { b.cursor = c; return { at: s, apply: c }; }
  const g = closeIn(b, i, step.actor, target, c, MOVE.grappleGap).at;
  const seg = b.play(step.actor, "slam", g);
  const at = g + b.strikeOf(b.info(b.track(step.actor).rig, "slam"));
  b.moveCue(g + grabTime(b, step.actor), i, "body-slam", "act");   // the heave
  // the target's slammed clip runs with the slam, so it hits the floor at the contact
  const ttr = b.track(target);
  const slammed = ttr.rig === "scrapper" ? "slammed" : "hit";
  const info = b.info(ttr.rig, slammed);
  const landAt = info.events.find((e) => e.name === "land")?.t ?? b.strikeOf(info);
  const tseg = b.play(target, slammed, Math.max(g, at - landAt));
  // nothing lies under it where it lands: its pets run clear first (choreo/fall.ts)
  if (ttr.rig === "scrapper") {
    const tp = b.place(target, at);
    const box = drawnBox(b.rig, b.rig.samplePose(ttr.rig, slammed, landAt), b.dress(target), { x: tp.x, y: tp.y, facing: tp.facing });
    // (and not under the slammer either: the strip runs from his back to the far end of the body,
    // or the boar ran out from under the body and stood in the slammer's legs)
    const me = b.place(step.actor, at);
    const s0 = drawnScale(b, step.actor);
    const [l, r] = me.facing === 1 ? [SCRAPPER_REACH.back * s0, SCRAPPER_REACH.front * s0] : [SCRAPPER_REACH.front * s0, SCRAPPER_REACH.back * s0];
    clearLanding(b, at - MOVE.slamClearLead, { x0: Math.min(box.x0, me.x - l), x1: Math.max(box.x1, me.x + r) }, step.actor);
  }
  const hitStop = b.hitStopFor(i, false);
  if (hit !== undefined) {
    const ci = land(b, { i, at, attacker: step.actor, target, outcome: "hit", damage: hit.damage, crit: false,
      hpAfter: hit.hpAfter, weapon: null, hitStop, ownClip: true, move: "body-slam" });
    seg.strikes = ci;
  }
  sling(b, target, g, at + 300);
  sig(b, step, g, at + 420, { target, at });
  // the floor takes the blow
  const p = b.place(target, at);
  b.fx.push({ fx: "dust", from: at, to: at + 420, x: p.x - p.facing * 20, y: p.y, facing: p.facing, seed: b.opts.cosmeticSeed + i, contact: null });
  b.cue(at, i, "landing");
  resultTag(b, "body-slam", target, at + 80, CORAL);
  skillTag(b, step.procs, at);
  b.cause = { step: i, at, actor: step.actor, hitStop };
  // the slammer steps back to fighting distance while its target gets up (the checker, level 30
  // n 25: the two stood stacked through the get-up and the next blow)
  let set = seg.to;
  if (ttr.rig === "scrapper" && b.track(step.actor).rig === "scrapper" && b.internal.easedDash !== true) {
    const me = b.place(step.actor, seg.to);
    const tp = b.place(target, seg.to);
    const away: 1 | -1 = me.x <= tp.x ? -1 : 1;
    const bounds = b.frameBounds(step.actor);
    const x = Math.min(bounds.x1, Math.max(bounds.x0, tp.x + away * BODY_GAP.body * Math.max(drawnScale(b, step.actor), drawnScale(b, target))));
    if (away * (x - me.x) > 0.5) {
      const way = planWay(b, step.actor, x - me.x, 0, false, seg.to);
      if (way.kind !== "still") set = layWay(b, step.actor, seg.to, x, me.y, way);
    }
  }
  b.cursor = Math.max(set, tseg.to) + BEAT.recoverMs;
  return { at: s, apply: at };
}
