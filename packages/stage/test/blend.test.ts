/**
 * The pose crossfade (fight screen v2): drawn on the real gate rig, no forearm or hand turns more
 * than the rig's own limit (ANATOMY.turnPerFrame, 25 degrees) from one 60 fps frame to the next,
 * anywhere in the bout-gate and bout-all-steps timelines, except where the clip itself moves that
 * fast between two frames with no cut (the strike of an aimed punch or swing; that is the rig's
 * motion, listed by the scan, and the stage may add at most SLACK degrees on top while a crossfade
 * fades out). With the crossfade off (a planted fault) the same scan finds the jumps at the cuts.
 */
import { describe, expect, it } from "vitest";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import type { BoutFixtureName } from "@rankzero/core/fixtures";
import { SCRAPPER_BONES, createRig, gatePack } from "@rankzero/rig";
import { arc, mixPose, poseAt } from "../src/blend";
import { clipTime, segAt } from "../src/track";
import { buildPlayer } from "../src/createFightPlayer";
import { optsFor } from "./lib/setup";

const rig = createRig(gatePack);
const LIMIT = 25;
const BONES = ["armF.lo", "handF", "armB.lo", "handB"] as const;
const idx = BONES.map((b) => SCRAPPER_BONES.indexOf(b));
const FRAME = 1000 / 60;
const SLACK = 8;

/** The worst frame-to-frame turn the stage adds beyond the limit, and the clip's own fast frames. */
function worstTurn(name: BoutFixtureName, blend = true): { deg: number; at: number; id: string; bone: string; rigOwn: string[] } {
  const fx = BOUT_FIXTURES[name];
  const p = buildPlayer(fx.log, fx.a, fx.b, rig, optsFor(fx.log));
  let worst = { deg: 0, at: 0, id: "", bone: "", rigOwn: [] as string[] };
  for (const tr of p.tracks.actors) {
    if (tr.rig !== "scrapper") continue;
    let prev: readonly number[] | null = null;
    for (let t = 0; t <= p.timeline.durationMs; t += FRAME) {
      if (t < tr.showFrom || t >= tr.goneAt) { prev = null; continue; }
      const rot = poseAt(rig, tr, t, blend).rot;
      if (prev !== null) {
        // the clip's own motion over this frame, on the same segment (no cut in it)
        const seg = segAt(tr, t);
        const own = seg === null ? null : [rig.samplePose("scrapper", seg.clip, clipTime(seg, Math.max(seg.from, t - FRAME)), seg.aim).rot,
          rig.samplePose("scrapper", seg.clip, clipTime(seg, t), seg.aim).rot] as const;
        idx.forEach((i, k) => {
          const d = Math.abs(arc(prev![i]!, rot[i]!));
          const o = own === null ? 0 : Math.abs(arc(own[0][i]!, own[1][i]!));
          if (o > LIMIT) worst.rigOwn.push(`${tr.id} ${seg!.clip} ${BONES[k]} ${o.toFixed(0)} deg at ${Math.round(t)} ms`);
          const over = d - Math.max(LIMIT, o + SLACK);
          if (d > LIMIT && over > worst.deg - LIMIT) worst = { ...worst, deg: Math.max(LIMIT, o + SLACK) === LIMIT ? d : LIMIT + over, at: Math.round(t), id: tr.id, bone: BONES[k]! };
        });
      }
      prev = rot;
    }
  }
  return worst;
}

describe("pose crossfade", () => {
  it("blends by the shortest arc", () => {
    expect(arc(170, -170)).toBe(20);
    expect(arc(-170, 170)).toBe(-20);
    const p = rig.samplePose("scrapper", "idle", 0);
    const q = rig.samplePose("scrapper", "punch", 150);
    expect(mixPose(p, q, 0).rot).toEqual(p.rot);
    expect(mixPose(p, q, 1)).toBe(q);
  });

  it.each(["bout-gate", "bout-all-steps"] as const)("%s: no forearm or hand turns more than 25 degrees in one frame", (name) => {
    const w = worstTurn(name);
    if (w.rigOwn.length > 0) console.info(`${name}: ${w.rigOwn.length} frames where the clip itself turns a forearm or hand more than ${LIMIT} degrees (rig): ${w.rigOwn.join("; ")}`);
    expect(w.deg, `${w.id} ${w.bone} at ${w.at} ms`).toBeLessThanOrEqual(LIMIT);
  });

  it("would catch the cuts with the crossfade off (planted fault)", () => {
    expect(worstTurn("bout-gate", false).deg).toBeGreaterThan(LIMIT);
  });

  it("is a pure function of t", () => {
    const fx = BOUT_FIXTURES["bout-gate"];
    const p = buildPlayer(fx.log, fx.a, fx.b, rig, optsFor(fx.log));
    const tr = p.tracks.actors[0]!;
    for (const t of [1600, 2400, 5100, 9000]) expect(poseAt(rig, tr, t)).toEqual(poseAt(rig, tr, t));
  });
});
