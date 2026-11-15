/**
 * The content clips drawn for the Moves (calm fight, skills pass): power-up (breath, charge,
 * blow), drink, slam, slammed and snared. Every 60 fps frame of each, on the full rig: every
 * bone with a limit stays inside it, no bone turns more than 45 degrees and no forearm or hand
 * more than ANATOMY.turnPerFrame in one frame, and the events the stage reads are there.
 */
import { describe, expect, it } from "vitest";
import type { ContentClip } from "../../src/contracts";
import { createRig } from "../../src/engine/createRig";
import { CONTENT_CLIPS } from "../../src/content/clips";
import { contentPack } from "../../src/content/pack";
import { gatePack } from "../../src/gate/pack";
import { ANATOMY, SCRAPPER_RIG } from "../../src/gate/skeleton";
import { measure, report } from "../gate/anatomy";

const rig = createRig(gatePack, contentPack);
const S = "scrapper" as const;
const bones = SCRAPPER_RIG.bones;
const DRAWN: ContentClip[] = ["drink", "power-up", "slam", "slammed", "snared"];

function frames(clip: string): number[] {
  const d = rig.clipInfo(S, clip).durationMs;
  const out: number[] = [];
  for (let t = 0; t <= d; t += 1000 / 60) out.push(t);
  return out;
}

describe("Move clips", () => {
  it("draws the five Move clips in the content pack", () => {
    for (const c of DRAWN) expect(CONTENT_CLIPS[c], c).toBeDefined();
  });

  it.each(DRAWN)("%s: every bone with a limit stays inside it, in every frame", (clip) => {
    for (const t of frames(clip)) {
      const p = rig.samplePose(S, clip, t);
      bones.forEach((b, i) => {
        if (b.limit === undefined) return;
        expect(p.rot[i]!, `${clip} ${b.id} at ${Math.round(t)}`).toBeGreaterThanOrEqual(b.limit[0] - 1e-6);
        expect(p.rot[i]!, `${clip} ${b.id} at ${Math.round(t)}`).toBeLessThanOrEqual(b.limit[1] + 1e-6);
      });
    }
  });

  it.each(DRAWN)("%s: no bone turns more than 45 degrees, no forearm or hand more than the rig's limit, in one frame", (clip) => {
    const ps = frames(clip).map((t) => rig.samplePose(S, clip, t));
    for (let i = 1; i < ps.length; i++) ps[i]!.rot.forEach((v, b) => {
      expect(Math.abs(v - ps[i - 1]!.rot[b]!), `${clip} ${bones[b]!.id} frame ${i}`).toBeLessThanOrEqual(45);
    });
    const rep = report(ps.map((p) => measure(p)));
    expect(rep.foreTurnMax, clip).toBeLessThanOrEqual(ANATOMY.turnPerFrame);
    expect(rep.handTurnMax, clip).toBeLessThanOrEqual(ANATOMY.turnPerFrame);
  });

  it("carries the events the stage reads: the power-up parts, the slam's grab and contact, the slammed landing", () => {
    expect(rig.clipInfo(S, "power-up").events.filter((e) => e.name === "step").length).toBe(3);
    expect(rig.clipInfo(S, "power-up").loop).toBe(false);
    expect(rig.clipInfo(S, "slam").events.map((e) => e.name).sort()).toEqual(["contact", "step"]);
    expect(rig.clipInfo(S, "slammed").events.map((e) => e.name)).toEqual(["land"]);
    expect(rig.clipInfo(S, "snared").loop).toBe(true);
  });
});
