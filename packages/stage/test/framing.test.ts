/**
 * Review round 2 (16 Nov 2026), on the app's phone canvas (390 x 467 CSS px) and the full rig, in
 * real level-30 and level-3 bouts the reviewer recorded:
 *  - the knockout's last shot holds the winner whole, standing over the body (it was cut at the
 *    edge while "X WINS" showed);
 *  - fighters never step out of the frame to swing a long weapon (a broom's riposte came from off
 *    the screen); a dodge's hop stops at the frame;
 *  - two fighters' bodies, as the clips draw them (their lunge included), never stack into one;
 *  - a shield put aside for a Move goes back on the arm only once the arm is back in its guard;
 *  - the Grapple's bear hug keeps both bodies readable and lifts the held one off its feet;
 *  - a Body Slam never lands its target on a pet;
 *  - a pet's tag never lands on a fighter's body;
 *  - at 2x and 3x the clock plays every Move at 1x.
 */
import { describe, expect, it } from "vitest";
import type { BoutLog, FighterSnapshot } from "@rankzero/core";
import { REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import { poseAt } from "../src/blend";
import { drawnBox } from "../src/bounds";
import { CAMERA, cameraAt, frameSpan } from "../src/camera";
import { advance, createFightClock, realAt } from "../src/clock";
import { buildPlayer } from "../src/createFightPlayer";
import type { StagePlayer } from "../src/createFightPlayer";
import type { FrameActor } from "../src/frame";
import { AVOID, avoidOf, birthsFor, layoutLabels, screenOf } from "../src/labels";
import { BLEND, MOVE } from "../src/tuning";
import { optsFor } from "./lib/setup";

const rig = createRig(gatePack, contentPack);
const PHONE = { w: 390, h: 467 };
/** The phone canvas once the fight screen caps the stage at 9:10 (the web lane's round 2 layout). */
const PHONE_SHORT = { w: 390, h: 351 };

const cache = new Map<string, { log: BoutLog; a: FighterSnapshot; b: FighterSnapshot; p: StagePlayer }>();
function bout(level: number, n: number) {
  const key = `${level}:${n}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const a = rivalSnapshot(REALM_SALT, level, 2 * n);
  const b = rivalSnapshot(REALM_SALT, level, 2 * n + 1);
  const log = simulateFight(combineSeed("find-bout", n), a, b, 1);
  const r = { log, a, b, p: buildPlayer(log, a, b, rig, optsFor(log, false, log.seed)) };
  cache.set(key, r);
  return r;
}
/** The reviewer's bouts: level 30 n 1 (Grapple, Sand, the car door), level 3 n 1 (the broom's
 *  riposte), level 30 n 0 (Snatch, Tarp), n 10 (Air Horn, Taunt, Whistle), n 25 (Body Slam, a boar). */
const BOUTS: readonly [number, number][] = [[30, 1], [3, 1], [30, 0], [30, 10], [30, 25]];
/** More bouts where a long weapon goes for a pet (the fix pass's own scan of 45 bouts: a fighter
 *  backed to the frame's edge, level 30 n 6, level 10 n 9; and level 10 n 8, where the pet's give
 *  of ground was laid from its mark, not from where it had run to, and the attacker stood in its
 *  owner). */
const WIDE: readonly [number, number][] = [...BOUTS, [30, 6], [10, 9], [10, 8], [10, 12]];

const box = (p: StagePlayer, a: FrameActor, t: number) => drawnBox(rig, poseAt(rig, p.tracks.byId.get(a.id)!, t), a.dress, a.place);
const view = (p: StagePlayer, t: number, canvas = PHONE) => { const c = cameraAt(p.tracks, t, canvas, false); return { x0: c.x0, x1: c.x0 + canvas.w / c.k }; };

describe("review round 2: framing and skill effects on the phone", () => {
  it.each(BOUTS)("level %i n %i: the last shot holds the winner whole, over the body", (level, n) => {
    const { log, p } = bout(level, n);
    const end = p.timeline.durationMs;
    const f = p.frame(end);
    const v = view(p, end);
    const winner = f.actors.find((a) => a.id === (log.result.winner === "a" ? "a0" : "b0"))!;
    const wb = box(p, winner, end);
    // (the win pose may raise its weapon a little past its body box: 4 units)
    expect(wb.x0, "winner's left edge").toBeGreaterThanOrEqual(v.x0 - 4);
    expect(wb.x1, "winner's right edge").toBeLessThanOrEqual(v.x1 + 4);
    const ko = p.tracks.koFocus!;
    expect(Math.abs(winner.place.x - ko.x), "stands over the body, not at its home mark").toBeLessThan(80);
  });

  it.each(WIDE)("level %i n %i: a fighter's body stays in the frame before the knockout", (level, n) => {
    const { p } = bout(level, n);
    const ko = p.tracks.koFocus?.at ?? p.timeline.durationMs;
    const out: string[] = [];
    for (const canvas of [PHONE, PHONE_SHORT]) {
      for (let t = 1500; t < ko; t += 50) {
        const v = view(p, t, canvas);
        for (const a of p.frame(t).actors) {
          if (a.rig !== "scrapper" || a.clip.startsWith("ko")) continue;
          // its middle at least CAMERA.excursion inside: the body without the back arm's shield
          // (the old riposte stood with its middle 11 px outside). The tall canvas shows 200 units
          // at most: when both fighters stood far off their marks in one bout (level 30 n 25: 204
          // units) each gives up to 4 of them
          const k = (CAMERA.excursion - (canvas === PHONE ? 4 : 0)) * (a.dress.scale > 0 ? a.dress.scale : 1) - 0.5;
          if (a.place.x < v.x0 + k || a.place.x > v.x1 - k) out.push(`${canvas.h} ${t} ${a.id} ${a.clip} at ${a.place.x.toFixed(0)} (view ${v.x0.toFixed(0)}-${v.x1.toFixed(0)})`);
        }
      }
    }
    expect(out.slice(0, 5)).toEqual([]);
  });

  it("the frame is one fixed frame: it does not move before the knockout, and it stays close to the marks", () => {
    for (const [level, n] of WIDE) {
      const { p } = bout(level, n);
      const ko = p.tracks.koFocus?.at ?? p.timeline.durationMs;
      const c0 = cameraAt(p.tracks, 0, PHONE, false);
      for (let t = 0; t < ko; t += 500) expect(cameraAt(p.tracks, t, PHONE, false), `${level}/${n} at ${t}`).toEqual(c0);
      const must = frameSpan(p.tracks).must!;
      // the scrappers' marks are 140 and 220, their own room 40 each side: no more than 30 further
      expect(must.x0, `${level}/${n}`).toBeGreaterThanOrEqual(70);
      expect(must.x1, `${level}/${n}`).toBeLessThanOrEqual(290);
    }
  });

  it("after a Move the user's shield is back on its arm, and a pinned target's is off it until it is free", () => {
    const { log, p } = bout(30, 1);
    // (the sling of a Move with a walk in it never ended: after her Grapple the lid stayed on her back)
    for (const g of p.tracks.slings) expect(g.to, `${g.actor} from ${g.from}`).not.toBe(Infinity);
    const i = log.steps.findIndex((s) => s.t === "move" && s.move === "grapple");
    const step = log.steps[i]! as { actor: string; target: string };
    const hold = p.timeline.holds!.find((h) => h[0] === p.timeline.stepAt[i])!;
    const after = p.frame(hold[1] + 2 * BLEND.maxMs).actors.find((a) => a.id === step.actor)!;
    expect(after.dress.shield, "the hugger's shield is back").not.toBeNull();
    expect(after.slung ?? []).toEqual([]);
    // pinned by the hold (the snare step after the Grapple): hands at the face, the car door stays off
    const j = log.steps.findIndex((s, k) => k > i && s.t === "snare");
    const k = log.steps.findIndex((s, q) => q > j && s.t === "free");
    expect(j).toBeGreaterThan(i);
    for (let t = p.timeline.stepAt[i]! + 600; t < p.timeline.stepAt[k]!; t += 40) {
      const a = p.frame(t).actors.find((x) => x.id === step.target)!;
      expect(a.dress.shield, `${t}: the pinned one's shield stays slung (no flick back between the hold and the pin)`).toBeNull();
    }
    const freed = p.frame(p.timeline.stepAt[k]! + BLEND.maxMs + 400).actors.find((x) => x.id === step.target)!;
    expect(freed.dress.shield).not.toBeNull();
  });

  it.each(WIDE)("level %i n %i: two standing fighters' bodies never stack (posed roots 24 units apart)", (level, n) => {
    const { p } = bout(level, n);
    const ko = p.tracks.koFocus?.at ?? p.timeline.durationMs;
    const bad: string[] = [];
    for (let t = 1500; t < ko; t += 25) {
      const sc = p.frame(t).actors.filter((a) => a.rig === "scrapper");
      if (sc.length !== 2 || sc.some((a) => ["slam", "slammed", "ko-fall"].includes(a.clip))) continue;
      const root = (a: FrameActor) => a.place.x + a.place.facing * poseAt(rig, p.tracks.byId.get(a.id)!, t).root.x * (a.dress.scale > 0 ? a.dress.scale : 1);
      const d = Math.abs(root(sc[0]!) - root(sc[1]!));
      if (d < 24) bad.push(`${t}: ${sc[0]!.clip}/${sc[1]!.clip} ${d.toFixed(1)}`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it("a shield slung for a Move stays slung through the crossfade back to the guard", () => {
    let seen = 0;
    for (const [level, n] of BOUTS) {
      const { p } = bout(level, n);
      for (const g of p.tracks.slings) {
        if (!g.shield || g.to === Infinity) continue;
        const t = g.to + BLEND.maxMs / 2;
        const a = p.frame(t).actors.find((x) => x.id === g.actor);
        if (a === undefined || a.clip.startsWith("ko")) continue;
        const had = p.frame(g.from + 1).actors.find((x) => x.id === g.actor)?.slung ?? [];
        if (had.length === 0) continue;
        // (a shield knocked off meanwhile is on the floor, not slung)
        if (p.tracks.byId.get(g.actor)!.shields.some((c) => c.from > g.from && c.from <= t)) continue;
        seen++;
        expect(a.dress.shield, `${level}/${n} ${g.actor} at ${t}: still off the arm`).toBeNull();
        expect(a.slung, `${level}/${n} ${g.actor} at ${t}`).toEqual(had);
      }
    }
    expect(seen).toBeGreaterThan(3);
  });

  it("the Grapple: both bodies read (roots apart) and the held one is lifted off its feet", () => {
    const { log, p } = bout(30, 1);
    const i = log.steps.findIndex((s) => s.t === "move" && s.move === "grapple");
    expect(i).toBeGreaterThanOrEqual(0);
    const sig = p.tracks.sigs.find((g) => g.kind === "grapple")!;
    const mid = (sig.from + sig.to) / 2;
    const f = p.frame(mid);
    const step = log.steps[i]! as { actor: string; target: string };
    const me = f.actors.find((a) => a.id === step.actor)!;
    const them = f.actors.find((a) => a.id === step.target)!;
    expect(Math.abs(me.place.x - them.place.x)).toBeGreaterThanOrEqual(MOVE.hugGap - 0.5);
    expect(them.floorY - them.place.y, "lifted").toBeGreaterThan(MOVE.hugLift * 0.8);
    // its own picture: the hugger's arms round the held one (rig "hug"), the held one bent back
    // with its arms flung up (rig "hugged"), not the Body Slam's grab and the tarp's snared pose
    expect([me.clip, them.clip]).toEqual(["hug", "hugged"]);
    const handOf = (a: FrameActor) => rig.handAnchor(poseAt(rig, p.tracks.byId.get(a.id)!, mid), a.dress, a.place);
    // the hugger's hand is round the held one's body, well past its own front
    expect(me.place.facing * (handOf(me).x - me.place.x), "arms reach round the other").toBeGreaterThan(MOVE.hugGap * 0.6);
    expect(them.place.y - handOf(them).y, "the held one's arm is flung up over its head").toBeGreaterThan(80);
  });

  it("a Body Slam lands its target clear of every pet", () => {
    const { log, p } = bout(30, 25);
    let seen = 0;
    log.steps.forEach((s, i) => {
      if (s.t !== "move" || s.move !== "body-slam" || s.target === undefined) return;
      const sig = p.tracks.sigs.find((g) => g.kind === "body-slam" && g.from >= p.timeline.stepAt[i]!)!;
      for (const t of [sig.at! + 40, sig.at! + 200]) {
        const f = p.frame(t);
        const body = f.actors.find((a) => a.id === s.target)!;
        const bb = box(p, body, t);
        const me = f.actors.find((a) => a.id === s.actor)!;
        for (const pet of f.actors.filter((a) => a.rig !== "scrapper")) {
          const pb = box(p, pet, t);
          const w = Math.min(pb.x1, bb.x1) - Math.max(pb.x0, bb.x0);
          expect(w, `${pet.id} under the slammed ${s.target} at ${t}`).toBeLessThanOrEqual(1);
          // nor in the slammer's legs (the boar ran out from under the body to stand under him)
          expect(Math.abs(pet.place.x - me.place.x), `${pet.id} under the slammer at ${t}`).toBeGreaterThan(20);
        }
        seen++;
      }
    });
    expect(seen).toBeGreaterThan(0);
  });

  it("a pet's tag never lands on a standing fighter's body", () => {
    let seen = 0;
    for (const [level, n] of BOUTS) {
      const { p } = bout(level, n);
      const spots = birthsFor(p.tracks, PHONE, false);
      for (const [idx, g] of p.tracks.tags.entries()) {
        if (g.follow === undefined || g.follow.endsWith("0") || (g.kind !== "tag" && g.kind !== "sticker")) continue;
        const t = g.from + 1;
        const f = p.frame(t);
        if (!f.actors.some((a) => a.id === g.follow)) continue;
        const s = screenOf(PHONE, cameraAt(p.tracks, t, PHONE, false));
        const label = layoutLabels(f, s, spots).find((l) => l.t.idx === idx);
        if (label === undefined) continue;
        seen++;
        const lb = { x0: label.x - label.w / 2, x1: label.x + label.w / 2, y0: label.y - label.h / 2, y1: label.y + label.h / 2 };
        for (const q of avoidOf(f, s, AVOID.feet)) {
          const hit = lb.x0 < q.x1 && lb.x1 > q.x0 && lb.y0 < q.y1 && lb.y1 > q.y0;
          expect(hit, `${level}/${n} "${g.text}" over ${g.follow} at ${t} lands on a fighter`).toBe(false);
        }
      }
    }
    expect(seen).toBeGreaterThan(3);
  });

  it("at 2x and 3x the clock plays every Move at 1x, and everything else at the speed", () => {
    const { log, p } = bout(30, 10);
    const holds = p.timeline.holds ?? [];
    log.steps.forEach((s, i) => {
      if (s.t !== "move") return;
      const at = p.timeline.stepAt[i]!;
      const h = holds.find((x) => at >= x[0] && at < x[1]);
      expect(h, `${s.move} at ${at} held`).toBeDefined();
      expect(h![1] - at, `${s.move}: at least its name tag`).toBeGreaterThanOrEqual(MOVE.nameTagMs - 1);
    });
    for (const speed of [2, 3] as const) {
      const clock = createFightClock(p.timeline.durationMs, holds);
      clock.speed = speed;
      const h = holds[0]!;
      // walk to the hold's start, then through it in 16 ms frames
      clock.seek(h[0]);
      const t0 = clock.t;
      let real = 0;
      while (clock.t < h[1] - 1e-6) { clock.tick(16); real += 16; }
      expect(real, `${speed}x`).toBeGreaterThanOrEqual(h[1] - t0 - 16);
      // outside a hold: the speed
      const gap = holds.length > 1 ? [h[1], holds[1]![0]] : [h[1], p.timeline.durationMs];
      if (gap[1]! - gap[0]! > 200) {
        clock.seek(gap[0]!);
        clock.tick(50);
        expect(clock.t - gap[0]!).toBeCloseTo(50 * speed, 6);
      }
      // the recorder's map agrees with the clock
      expect(advance(0, realAt(h[1], speed, holds), speed, holds)).toBeCloseTo(h[1], 4);
    }
    // 1x is untouched
    const one = createFightClock(p.timeline.durationMs, holds);
    one.tick(100);
    expect(one.t).toBe(100);
  });
});
