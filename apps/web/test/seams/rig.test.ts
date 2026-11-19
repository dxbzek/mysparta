/**
 * Test of the rig seam (work package 0). The app gets its rig from `src/seams/rig.ts` and from
 * nowhere else. This test holds for the capsule double today and for the real rig after the
 * seam flips, because it asks only for what the contract and the timing table promise.
 * It is also the reason `pnpm test` cannot pass with no test in this package.
 */
import { describe, expect, it } from "vitest";
import { COMPANION_IDS, STAGE_IDS, WEAPON_IDS, WEAPON_META } from "@rankzero/core";
import { SNAPSHOTS } from "@rankzero/core/fixtures";
import { contentPack, createRig, gatePack, strikeTime, toStage } from "@rankzero/rig";
import type { Dress, Rig } from "@rankzero/rig";
import { loadFullRig, rig } from "../../src/seams/rig";

describe("the rig seam", () => {
  it("hands the app every member of the Rig contract, the optional ones included", () => {
    // `as const`: the list's own names, so a member added to the contract and missing here is a
    // type error (typed as `(keyof Rig)[]`, the check below was always true and missed attackClip)
    const members = ["clipInfo", "samplePose", "drawActor", "handAnchor", "drawProp", "drawStage",
      "strikePoint", "hitPoint", "drawFx", "portrait", "companionPortrait", "icon", "attackClip"] as const satisfies readonly (keyof Rig)[];
    for (const name of members) expect(typeof rig[name], name).toBe("function");
    const complete: Exclude<keyof Rig, (typeof members)[number]> extends never ? true : false = true;
    expect(complete).toBe(true);
    // and every method the real rig has at run time (its test-only `inspect` object aside)
    for (const [name, v] of Object.entries(createRig(gatePack, contentPack))) if (typeof v === "function") expect(typeof (rig as unknown as Record<string, unknown>)[name], name).toBe("function");
  });

  it("forwards the weapon's own attack clip once the full rig is in (review 15 Nov 2026, item 3)", async () => {
    await loadFullRig();
    expect(rig.attackClip?.("boomerang", "throw")).toBe(createRig(gatePack, contentPack).attackClip?.("boomerang", "throw"));
    expect(rig.attackClip?.("boomerang", "throw")).not.toBe("throw");
    expect(rig.attackClip?.("tyre", "throw")).not.toBe("throw");
    expect(rig.attackClip?.(null, "swing")).toBe("swing");
  });

  it("answers clip questions with the timing table: a swing is 280 ms and strikes at 150", () => {
    const swing = rig.clipInfo("scrapper", "swing");
    expect(swing.durationMs).toBe(280);
    expect(swing.loop).toBe(false);
    expect(strikeTime(swing)).toBe(150);
    expect(rig.clipInfo("scrapper", "idle").loop).toBe(true);
    for (const id of COMPANION_IDS) expect(strikeTime(rig.clipInfo(id, "attack")), id).toBe(150);
  });

  it("samples poses that are plain data, equal for equal inputs", () => {
    const pose = rig.samplePose("scrapper", "swing", 150);
    expect(pose.rig).toBe("scrapper");
    // The 16 contract bones come first; the gate rig adds `held` and `hair` after them (RigDef is free-form).
    expect(pose.rot.length).toBeGreaterThanOrEqual(16);
    for (const angle of pose.rot) expect(Number.isFinite(angle)).toBe(true);
    expect(rig.samplePose("scrapper", "swing", 150)).toEqual(pose);
    expect(JSON.parse(JSON.stringify(pose))).toEqual(pose);
  });

  it("says where every weapon strikes and where a target is hit", () => {
    const dress = (held: Dress["held"]): Dress => ({ look: SNAPSHOTS.l1Pipe.look, held, shield: null, scale: 1 });
    for (const id of WEAPON_IDS) {
      const p = rig.strikePoint("scrapper", WEAPON_META[id].clip, dress(id));
      expect(Number.isFinite(p.x) && Number.isFinite(p.y), id).toBe(true);
      expect(p.x, id).toBeGreaterThan(0);
    }
    for (const r of ["scrapper", ...COMPANION_IDS] as const) for (const zone of ["head", "body"] as const) {
      const p = toStage({ x: 290, y: 195, facing: -1 }, rig.hitPoint(r, dress(null), zone));
      expect(p.y, `${r} ${zone}`).toBeLessThan(195);
      expect(p.y, `${r} ${zone}`).toBeGreaterThan(195 - 110);
    }
  });

  it("draws both layers of all five arenas without throwing", () => {
    expect(STAGE_IDS.length).toBe(5);
    // A context that takes any call. The rig lane's own tests check what is drawn.
    const calls: string[] = [];
    const ctx = new Proxy({}, {
      get: (_t, key) => (typeof key === "string" ? () => { calls.push(key); return { width: 0 }; } : undefined),
      set: () => true,
    }) as unknown as Parameters<Rig["drawStage"]>[0]["ctx"];
    for (const id of STAGE_IDS) for (const layer of ["back", "floor"] as const) {
      const before = calls.length;
      rig.drawStage({ ctx, path: (d) => d }, id, layer, 0.5);
      expect(calls.length, `${id} ${layer}`).toBeGreaterThan(before);
    }
  });
});
