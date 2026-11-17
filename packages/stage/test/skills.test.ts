/**
 * Every skill shows what it DOES (owner, 16 Nov 2026, on his phone: "The skill is not even
 * identifiable", then, against bigger name tags: "No it's not about it. The effects aren't
 * there"). On the FULL rig (the one the app swaps in with `loadFullRig`), at level 30:
 *
 *  - every Move plays a clip the rig has (the no-missing-clips guard fails the test on a warning),
 *    its own action clip, and a signature effect that paints real pixels;
 *  - every Move with a target gets a visible reaction on that target;
 *  - a shield or a two-hand item is slung on the back for the Move, so the object and the gesture
 *    read (74% of Moves at level 30 used to happen behind a carried shield);
 *  - every passive has a mark of its own that paints real pixels, and a proc in a bout draws it;
 *  - boosters have no fight moment (RULES: they show on the stat screen), and nothing else is left
 *    without a picture.
 */
import { describe, expect, it } from "vitest";
import type { ActorId, BoutLog, FighterSnapshot, MoveId, SkillId, StepOf } from "@rankzero/core";
import { MOVE_IDS, REALM_SALT, SKILL_IDS, combineSeed, content, rivalSnapshot, simulateFight } from "@rankzero/core";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import type { DrawEnv } from "@rankzero/rig";
import { Path2D, createCanvas } from "@napi-rs/canvas";
import { buildPlayer } from "../src/createFightPlayer";
import type { StagePlayer } from "../src/createFightPlayer";
import { PASSIVES } from "../src/effects";
import { avoidOf, boxOf, birthsFor, layoutLabels, layoutNumbers, numbersFor, screenOf } from "../src/labels";
import { cameraAt } from "../src/camera";
import { PAINTERS, PROC_MARK, bodyOf, drawSig } from "../src/sigs";
import type { Body } from "../src/sigs";
import { optsFor } from "./lib/setup";

const rig = createRig(gatePack, contentPack);

/** Level-30 find-bout candidates that, together, use all twelve Moves (tools/find-bout.ts). The
 *  list changed with sim version 4 (round 2: Moves wait for the end of the opening, so they moved
 *  to other bouts; it was 0, 1, 2, 6, 8, 9, 10) and again with sim version 5 (round 2, second
 *  pass; it was 0, 1, 2, 5, 9, 30, 34). Its Snatch is one that lands: in n 18 Firm Grip resists the
 *  Snatch, which then draws the flick and the FIRM GRIP tag but no snatch streak (open, stage). */
const BOUTS = [0, 3, 4, 9, 16, 28];
const bouts: { n: number; log: BoutLog; a: FighterSnapshot; b: FighterSnapshot; p: StagePlayer }[] = BOUTS.map((n) => {
  const a = rivalSnapshot(REALM_SALT, 30, 2 * n);
  const b = rivalSnapshot(REALM_SALT, 30, 2 * n + 1);
  const log = simulateFight(combineSeed("find-bout", n), a, b, 1);
  return { n, log, a, b, p: buildPlayer(log, a, b, rig, optsFor(log, false, log.seed)) };
});
type MoveStep = StepOf<"move">;
const moveSteps = bouts.flatMap((bt) => bt.log.steps.map((s, i) => ({ bt, s, i })).filter((x): x is { bt: typeof bt; s: MoveStep; i: number } => x.s.t === "move"));

/** The user's own action clip of each Move. */
const ACTION: Record<MoveId, string> = {
  haymaker: "power-up", "energy-drink": "drink", tarp: "throw", whistle: "power-up", firecrackers: "throw", snatch: "flick",
  "air-horn": "power-up", "body-slam": "slam", "sand-in-the-eyes": "throw", taunt: "taunt", "second-wind": "power-up", grapple: "slam",
};
/** The reaction clip of each Move's target (null: the Move has no other actor to react). Firecrackers'
 *  targets flinch (any flinch clip); a Whistle's pet runs to its owner. */
const REACTION: Record<MoveId, string | null> = {
  haymaker: null, "energy-drink": null, "second-wind": null, tarp: "snared", whistle: "run", firecrackers: "flinch", snatch: "hit-light",
  "air-horn": "ears", "body-slam": "slammed", "sand-in-the-eyes": "rub-eyes", taunt: "angry", grapple: "hugged",
};

/** Opaque pixels a draw call leaves on a blank 360 x 240 canvas (at 2 px per unit). */
function inked(draw: (env: DrawEnv) => void): number {
  const cv = createCanvas(720, 480);
  const ctx = cv.getContext("2d");
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  const cache = new Map<string, Path2D>();
  const env = { ctx, path(d: string) { let q = cache.get(d); if (q === undefined) { q = new Path2D(d); cache.set(d, q); } return q; } } as unknown as DrawEnv;
  draw(env);
  const px = ctx.getImageData(0, 0, 720, 480).data;
  let n = 0;
  for (let k = 3; k < px.length; k += 4) if (px[k]! > 40) n++;
  return n;
}

describe("every skill shows what it does, on the full rig", () => {
  it("the level-30 bouts use all twelve Moves", () => {
    expect(new Set(moveSteps.map((m) => m.s.move))).toEqual(new Set(MOVE_IDS));
  });

  it("every skill is a Move with a signature, a passive with a mark, or a booster (no fight moment by design)", () => {
    for (const id of SKILL_IDS) {
      const kind = content.skills[id].kind;
      if ((MOVE_IDS as readonly string[]).includes(id)) {
        // Firecrackers keeps the rig's own crackers effect (the lit bundle, the flight, the pops)
        expect(PAINTERS[id as MoveId] !== undefined || id === "firecrackers", id).toBe(true);
      } else if (kind === "passive") {
        expect(PASSIVES.has(id), id).toBe(true);
        expect(PROC_MARK[id], id).toBeDefined();
      } else expect(kind, id).toBe("booster");
    }
  });

  it.each([...MOVE_IDS])("%s: its own action clip, a signature that paints, and the target's reaction", (move) => {
    const uses = moveSteps.filter((m) => m.s.move === move);
    expect(uses.length, move).toBeGreaterThan(0);
    for (const { bt, s, i } of uses) {
      const tr = bt.p.tracks;
      const at = bt.p.timeline.stepAt[i]!;
      const end = bt.p.timeline.stepEnd[i]! + 1500;
      const why = `${move} (n ${bt.n}, step ${i})`;
      const mine = tr.byId.get(s.actor)!.segs.filter((g) => g.from >= at && g.from <= end);
      expect(mine.map((g) => g.clip), why).toContain(ACTION[move]);
      // the signature: a painter's pixels (Firecrackers: the rig's crackers)
      if (move === "firecrackers") {
        const fx = tr.fx.find((f) => f.fx === "crackers" && f.from >= at)!;
        expect(fx, why).toBeDefined();
        const f = bt.p.frame((fx.from + fx.to) / 2).fx.find((e) => e.fx === "crackers")!;
        expect(inked((env) => rig.drawFx(env, "crackers", f.progress, f.at, f.seed)), why).toBeGreaterThan(40);
      } else {
        const sig = tr.sigs.find((g) => g.kind === move && g.actor === s.actor && g.from >= at && g.from <= end);
        expect(sig, why).toBeDefined();
        const mid = sig!.at !== undefined ? sig!.at + 60 : (sig!.from + sig!.to) / 2;
        const fs = bt.p.frame(mid).sigs.find((g) => g.kind === move)!;
        expect(fs, why).toBeDefined();
        const pose = (a: Parameters<typeof bodyOf>[1]) => rig.samplePose(a.rig, a.clip, a.clipT, a.aim);
        expect(inked((env) => drawSig(env, fs, rig, pose)), why).toBeGreaterThan(60);
      }
      // the reaction
      const want = REACTION[move];
      if (want === null) continue;
      const targets: ActorId[] = move === "whistle" ? bt.log.steps.slice(i + 1).filter((x) => x.t === "heal" && x.turn === s.turn).map((x) => (x as StepOf<"heal">).target)
        : move === "air-horn" || move === "taunt" ? [s.actor.startsWith("a") ? "b0" : "a0"]
        : move === "firecrackers" ? (s.hits ?? []).map((h) => h.target)
        : s.target !== undefined ? [s.target] : [];
      if (move === "snatch" && s.taken === undefined) continue;   // resisted: Firm Grip's mark instead
      for (const t of targets) {
        if (!tr.byId.has(t) || tr.byId.get(t)!.rig !== "scrapper" && want !== "run" && want !== "flinch") continue;
        const segs = tr.byId.get(t)!.segs.filter((g) => g.from >= at && g.from <= end);
        const ok = want === "flinch" ? segs.some((g) => g.flinchOf !== undefined) : segs.some((g) => g.clip === want);
        expect(ok, `${why}: ${t} reacts (${want})`).toBe(true);
      }
    }
  });

  it("slings the user's shield on its back for the Move, and draws it there", () => {
    let seen = 0;
    for (const { bt, s, i } of moveSteps) {
      const at = bt.p.timeline.stepAt[i]!;
      const sl = bt.p.tracks.slings.find((g) => g.actor === s.actor && g.from === at);
      const carried = bt.p.frame(at - 1).actors.find((a) => a.id === s.actor)?.dress.shield ?? null;
      if (carried === null) continue;
      seen++;
      expect(sl, `${s.move} n ${bt.n} step ${i}`).toBeDefined();
      const me = bt.p.frame(at + 100).actors.find((a) => a.id === s.actor)!;
      expect(me.dress.shield, `${s.move}: off the arm`).toBeNull();
      expect(me.slung, `${s.move}: on the back`).toContain(carried);
    }
    expect(seen).toBeGreaterThan(5);
  });

  it("every passive's mark paints real pixels", () => {
    const a = bouts[0]!.p.frame(1500).actors.find((x) => x.rig === "scrapper")!;
    const body: Body = bodyOf(rig, a, rig.samplePose(a.rig, a.clip, a.clipT));
    for (const id of PASSIVES) {
      for (const e of [100, 350, 600]) {
        expect(inked((env) => { env.ctx.save(); PROC_MARK[id]!(env.ctx, body, e, 1); env.ctx.restore(); }), `${id} at ${e} ms`).toBeGreaterThan(20);
      }
    }
  });

  it("a passive that procs in a bout draws its mark on its owner", () => {
    const procs = new Map<string, number>();
    for (const bt of bouts) {
      for (const s of bt.log.steps) {
        for (const q of ("procs" in s ? s.procs ?? [] : [])) {
          if (!PASSIVES.has(q.skill) || !bt.p.tracks.byId.has(q.by)) continue;
          const drawn = bt.p.tracks.sigs.some((g) => g.kind === "proc" && g.skill === (q.skill as SkillId) && g.actor === q.by);
          procs.set(q.skill, (procs.get(q.skill) ?? 0) + (drawn ? 1 : 0));
        }
      }
    }
    expect(procs.size).toBeGreaterThan(5);
    for (const [id, n] of procs) expect(n, id).toBeGreaterThan(0);
  });

  it("puts a heal's plus signs on the healed actor, not one more offset away", () => {
    for (const bt of bouts) {
      for (const f of bt.p.tracks.fx.filter((x) => x.fx === "plus")) {
        const fr = bt.p.frame(f.from + 10);
        const who = fr.actors.find((a) => a.id === f.follow)!;
        const e = fr.fx.find((x) => x.fx === "plus")!;
        expect(Math.abs(e.at.x - who.place.x), `n ${bt.n}`).toBeLessThan(1);
      }
    }
  });

  it("on the phone, no two tags cover each other and tags keep off the fighters' heads and chests", () => {
    const view = { w: 390, h: 260 };
    let frames = 0;
    let overlaps = 0;
    let tagged = 0;
    let onBody = 0;
    for (const bt of bouts) {
      const spots = birthsFor(bt.p.tracks, view, false);
      for (let t = 0; t < bt.p.timeline.durationMs; t += 50) {
        const f = bt.p.frame(t);
        const s = screenOf(view, cameraAt(bt.p.tracks, t, view, false));
        const ls = layoutLabels(f, s, spots);
        frames++;
        // a tag over a fighter's head or chest (to the belt) hides the Move's action
        const bodies = avoidOf(f, s);
        for (const l of ls) {
          tagged++;
          const p = boxOf(l);
          if (bodies.some((q) => Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > 2 && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > 2)) onBody++;
        }
        for (let x = 0; x < ls.length; x++) {
          for (let y = x + 1; y < ls.length; y++) {
            const p = boxOf(ls[x]!);
            const q = boxOf(ls[y]!);
            if (Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > 2 && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > 2) overlaps++;
          }
        }
      }
    }
    expect(frames).toBeGreaterThan(500);
    // the layout falls back to its first wish only when the whole canvas is full
    expect(overlaps / frames).toBeLessThan(0.01);
    // (a rider that walks under a tag, or a crowded canvas; with the old head-only box it was 55%)
    expect(onBody / tagged).toBeLessThan(0.15);
  });

  it("on the phone, no damage or heal number lands on a tag (it broke the words: 'EN+59RINK') or on another number", () => {
    const view = { w: 390, h: 260 };
    let pairs = 0;
    let hits = 0;
    let frames = 0;
    let numOnNum = 0;
    const seen: string[] = [];
    for (const bt of bouts) {
      const spots = birthsFor(bt.p.tracks, view, false);
      const nums = numbersFor(bt.p.tracks, view, false);
      for (let t = 0; t < bt.p.timeline.durationMs; t += 25) {
        const f = bt.p.frame(t);
        const s = screenOf(view, cameraAt(bt.p.tracks, t, view, false));
        const ls = layoutLabels(f, s, spots);
        const placed = layoutNumbers(f, s, ls, nums);
        frames++;
        for (let x = 0; x < placed.length; x++) {
          for (let y = x + 1; y < placed.length; y++) {
            const p = boxOf(placed[x]!);
            const q = boxOf(placed[y]!);
            if (Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > 1 && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > 1) numOnNum++;
          }
        }
        for (const n of placed) {
          const p = boxOf(n);
          for (const l of ls) {
            pairs++;
            const q = boxOf(l);
            if (Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > 1 && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > 1) {
              hits++;
              if (seen.length < 8) seen.push(`n ${bt.n} t ${t}: ${n.t.text} on ${l.t.text}`);
            }
          }
        }
      }
    }
    expect(pairs).toBeGreaterThan(200);
    expect(seen, seen.join("; ")).toEqual([]);
    expect(hits).toBe(0);
    // and a number rising into the one before it ("+7" over "-26") only where there is no room
    expect(numOnNum / frames).toBeLessThan(0.005);
  });
});
