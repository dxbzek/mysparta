/**
 * The knockout fall (review finding 22), on the real art:
 *  - the body ends with its legs on the floor (the feet were left hanging in the air);
 *  - no pet is under the body once it lies on the floor (it fell onto its own raccoon);
 *  - after the reframe, the body lies inside the view on a phone and on desktops, as far as the
 *    stage itself reaches (a hand was cut off at the edge).
 */
import { describe, expect, it } from "vitest";
import type { BoutLog, FighterSnapshot, PerkId } from "@rankzero/core";
import { simulateFight } from "@rankzero/core";
import { BOUT_FIXTURES, l10Boar, l10Raccoon, l1Knife, l1Pipe } from "@rankzero/core/fixtures";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import { drawnBox } from "../src/bounds";
import { CAMERA, cameraAt } from "../src/camera";
import { SCRAPPER_REACH, STAGE_W } from "../src/layout";
import { OUTRO } from "../src/tuning";
import { playerFor } from "./lib/setup";

const FULL = createRig(gatePack, contentPack);
type Inspect = { joints(pose: unknown, dress: unknown, at: unknown): [number, number][]; rigDef(r: string): { bones: readonly { id: string }[] } };
const INSPECT = (FULL as unknown as { inspect: Inspect }).inspect;
const BONES = INSPECT.rigDef("scrapper").bones.map((b) => b.id);
const kit = (base: FighterSnapshot, id: string, perks: PerkId[]): FighterSnapshot => ({ ...base, id, perks });

const BOUTS: readonly { name: string; log: BoutLog; a: FighterSnapshot; b: FighterSnapshot }[] = [
  { ...BOUT_FIXTURES["bout-all-steps"], name: "bout-all-steps" },
  ...[[4401, l10Boar, l10Raccoon, ["crowbar", "boar", "raccoon", "raccoon"], ["bat", "goose", "stray-dog", "crow"]],
    [4402, l1Pipe, l1Knife, ["pipe", "raccoon", "alley-cat", "crow"], ["pocket-knife", "boar", "stray-dog", "raccoon"]]].map(([seed, a0, b0, pa, pb]) => {
    const a = kit(a0 as FighterSnapshot, `ko:a${String(seed)}`, pa as PerkId[]);
    const b = kit(b0 as FighterSnapshot, `ko:b${String(seed)}`, pb as PerkId[]);
    return { name: `pets bout ${String(seed)}`, log: simulateFight(seed as number, a, b, 1), a, b };
  }),
];

describe("the knockout fall (real art)", () => {
  for (const bout of BOUTS) {
    it(`${bout.name}: legs down, no pet under the body, the body in view`, () => {
      const p = playerFor(bout.log, bout.a, bout.b, FULL);
      const f0 = p.tracks.koFocus;
      expect(f0).not.toBeNull();
      const f = f0!;
      const end = p.timeline.durationMs;
      const frame = p.frame(end);
      const loser = frame.actors.find((a) => a.rig === "scrapper" && a.clip === "ko-fall")!;
      expect(loser).toBeDefined();
      const pose = FULL.samplePose(loser.rig, loser.clip, loser.clipT, loser.aim);
      // legs down: no ankle or knee higher off the floor than the hips (they hung raised over
      // nothing), and the ankles about a lying leg's thickness off it
      const j = INSPECT.joints(pose, loser.dress, loser.place);
      const up = (bone: string): number => loser.floorY - j[BONES.indexOf(bone)]![1];
      // (a knee may sit a little over the hips in its slight bend)
      for (const [bone, slack] of [["footF", 1], ["footB", 1], ["legF.lo", 4], ["legB.lo", 4]] as const) {
        expect(up(bone), `${bone} above the hips`).toBeLessThanOrEqual(up("pelvis") + slack);
      }
      for (const bone of ["footF", "footB"]) expect(up(bone), `${bone} off the floor`).toBeLessThan(11);
      // no pet under him: behind his mark, where the body lies
      const body = drawnBox(FULL, pose, loser.dress, loser.place);
      const zone = f.back === 1 ? { x0: f.x, x1: body.x1 } : { x0: body.x0, x1: f.x };
      for (const a of frame.actors) {
        if (a.rig === "scrapper" || a.clip === "ko") continue;
        const pb = drawnBox(FULL, FULL.samplePose(a.rig, a.clip, a.clipT, a.aim), a.dress, a.place);
        const w = Math.min(pb.x1, zone.x1) - Math.max(pb.x0, zone.x0);
        expect(w, `${a.id} (${a.rig}) under the fallen body`).toBeLessThanOrEqual(1);
      }
      // in view after the reframe: the winner whole, standing over the body (review round 2: the
      // winner was cut at the phone's edge while "X WINS" showed), and the body as far as the stage
      // goes; on a tall phone that cannot hold both, the body's far end gives way (at most a sixth
      // of it), never the winner
      const winner = frame.actors.find((a) => a.rig === "scrapper" && a.id !== loser.id)!;
      expect(winner).toBeDefined();
      expect(f.stand).toBeCloseTo(winner.place.x, 6);
      const wb = drawnBox(FULL, FULL.samplePose(winner.rig, winner.clip, winner.clipT, winner.aim), winner.dress, winner.place);
      for (const view of [{ w: 390, h: 470 }, { w: 760, h: 520 }, { w: 720, h: 480 }]) {
        const cam = cameraAt(p.tracks, end, view, false);
        const x1 = cam.x0 + view.w / cam.k;
        const tag = `${view.w}x${view.h}`;
        expect(wb.x0, `${tag} winner`).toBeGreaterThanOrEqual(cam.x0 - 0.5);
        expect(wb.x1, `${tag} winner`).toBeLessThanOrEqual(x1 + 0.5);
        const far = f.back === 1 ? Math.min(STAGE_W, body.x1) : Math.max(0, body.x0);
        // (the camera keeps the win pose as drawn, `standBox`, behind the winner)
        const both = (f.back === 1 ? far - (f.stand! - f.standBox!.l) : f.stand! + f.standBox!.r - far) <= view.w / cam.k;
        // (and what a pet lying before the body moved the winner off its place by the body: he never
        // stands on a pet, choreo/fall.ts)
        const near = f.back === 1 ? Math.min(f.x, body.x0) : Math.max(f.x, body.x1);
        const moved = Math.max(0, Math.abs(f.stand! - near) - (SCRAPPER_REACH.front * (winner.dress.scale > 0 ? winner.dress.scale : 1) + OUTRO.standGap + 1));
        const slack = both ? 0.5 : (body.x1 - body.x0) / 6 + moved;
        if (f.back === 1) expect(x1, `${tag} body`).toBeGreaterThanOrEqual(far - slack);
        else expect(cam.x0, `${tag} body`).toBeLessThanOrEqual(far + slack);
      }
      expect(f.reach).toBeGreaterThan(0);
      expect(CAMERA.bodyMargin).toBeGreaterThan(0);
    });
  }
});
