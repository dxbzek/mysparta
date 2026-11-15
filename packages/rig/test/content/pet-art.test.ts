/**
 * The pet art review of 15 Nov 2026: the boar read as a hyena and stood too tall, the dog and cat
 * portraits showed a floating head, the goose neck was banded, the dog's and cat's near legs fell
 * into one shadow block and the cat's stripes popped on and off between clips. Every number is
 * measured on what the engine draws (`samplePose`, the frame-tagged shapes of the drawn frame).
 */
import { describe, expect, it } from "vitest";
import type { CompanionId } from "@rankzero/core";
import { COMPANION_IDS } from "@rankzero/core";
import { COMPANION_CLIPS } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
import { apply, frames, modelOf } from "../../src/engine/pose";
import { gatePack } from "../../src/gate/pack";
import { parsePolys } from "../../src/gate/vocab";
import { contentPack } from "../../src/content/pack";
import { PET_UNIT } from "../../src/content/pets";
import { CAT_FRAME } from "../../src/content/pets/alley-cat";
import { DOG_FRAME } from "../../src/content/pets/stray-dog";
import { GOOSE_NECK, gooseNeckPieces, neckCut } from "../../src/content/pets/goose";
import { LIGHT } from "../../src/gate/style";

const rig = createRig(gatePack, contentPack);
const ins = inspectOf(rig);
/** A fighter's height in stage units (the pets' shares are of this). */
const FIGHTER = 84;
/** The owner's cap on any pet's height. */
const CAP = 0.45;

/** The drawn box of a pet's pose, in its art units (y down, the floor at 0). */
function drawnBox(id: CompanionId, clip: string, t: number): { top: number; bottom: number } {
  const p = rig.samplePose(id, clip, t);
  const m = modelOf(ins.rigDef(id));
  const fr = frames(m, p.rot, p.root.x, p.root.y);
  const frame = m.index.has("frame") ? Math.round(p.rot[m.index.get("frame")!]!) : 0;
  let top = Infinity;
  let bottom = -Infinity;
  for (const s of contentPack.companions[id].shapes) {
    const [bone, n] = s.bone.split("@");
    if (n !== undefined && Number(n) !== frame) continue;
    for (const poly of parsePolys(s.d)) for (const q of poly) {
      const y = apply(fr[m.index.get(bone!)!]!, q[0], q[1])[1];
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return { top: top / PET_UNIT[id], bottom: bottom / PET_UNIT[id] };
}

describe("pet sizes, measured on the drawing", () => {
  it("draws every pet no taller than 45% of a fighter, in every clip and every frame", () => {
    const over: string[] = [];
    for (const id of COMPANION_IDS) for (const c of COMPANION_CLIPS) {
      const d = rig.clipInfo(id, c).durationMs;
      for (let t = 0; t <= d; t += 20) {
        const b = drawnBox(id, c, t);
        const h = (b.bottom - b.top) / FIGHTER;
        if (h > CAP) over.push(`${id} ${c}@${t} ${h.toFixed(3)}`);
      }
    }
    expect(over).toEqual([]);
  });
  it("the boar stands about 40% of a fighter, well under the cap", () => {
    const b = drawnBox("boar", "idle", 0);
    expect(-b.top / FIGHTER).toBeGreaterThan(0.36);
    expect(-b.top / FIGHTER).toBeLessThan(0.42);
  });
});

describe("the boar is a wild boar, not a hyena", () => {
  const shapes = contentPack.companions.boar.shapes;
  const rest = modelOf(ins.rigDef("boar"));
  const fr = frames(rest, rest.def.bones.map(() => 0), 0, 0);
  const world = (bone: string, d: string): [number, number][] =>
    parsePolys(d).flatMap((poly) => poly.map((q) => apply(fr[rest.index.get(bone)!]!, q[0], q[1])));
  const barrel = world("body", shapes.find((s) => s.bone === "body" && s.slot === "skin")!.d);
  const top = Math.min(...barrel.map((p) => p[1]));
  const belly = Math.max(...barrel.map((p) => p[1]));
  const xs = barrel.map((p) => p[0]);

  it("hangs a deep barrel low: the legs show for under 45% of the back's height, the body is as deep as the legs are long", () => {
    expect(-belly / -top).toBeLessThan(0.45);
    expect(belly - top).toBeGreaterThan(-belly);
  });
  it("is long and low: the barrel at least 1.1 times as long as the back is high", () => {
    expect((Math.max(...xs) - Math.min(...xs)) / -top).toBeGreaterThan(1.1);
  });
  it("carries its head low: the snout under half the back's height, with tusks", () => {
    const head = shapes.filter((s) => s.bone === "head").flatMap((s) => world("head", s.d));
    const snout = head.reduce((a, p) => (p[0] > a[0] ? p : a));
    expect(-snout[1] / -top).toBeLessThan(0.5);
    expect(shapes.filter((s) => (s.bone === "head" || s.bone === "jaw") && s.slot === "white").length).toBeGreaterThanOrEqual(2);
  });
  it("has a bristle ridge down the back (a dark crest over the barrel)", () => {
    expect(shapes.some((s) => s.bone === "body" && s.slot === "hair")).toBe(true);
  });
});

describe("pets drawn frame by frame: portraits, stripes, legs", () => {
  it("draws the whole standing animal in its portrait, not the head alone", () => {
    for (const id of COMPANION_IDS) {
      const m = modelOf(ins.rigDef(id));
      const p = rig.samplePose(id, "idle", 0);
      const frame = m.index.has("frame") ? Math.round(p.rot[m.index.get("frame")!]!) : 0;
      const drawn = contentPack.companions[id].shapes.filter((s) => {
        const [, n] = s.bone.split("@");
        return s.slot !== "ink" && (n === undefined || Number(n) === frame);
      }).length;
      const outlined = rig.companionPortrait(id).parts.filter((q) => q.stroke !== undefined).length;
      expect(outlined, id).toBe(drawn);
    }
  });
  it("keeps the alley cat's tabby stripes in every drawn frame (run, flee, attack and ko too)", () => {
    const shapes = contentPack.companions["alley-cat"].shapes;
    const all = [...CAT_FRAME.trot, ...CAT_FRAME.gallop, CAT_FRAME.stand, CAT_FRAME.arch, CAT_FRAME.lie];
    // all four in every frame, so none pops on or off when a clip switches frames
    for (const n of all) expect(shapes.filter((s) => s.bone === `body@${n}` && s.slot === "hair").length, `frame ${n}`).toBe(4);
  });
  it("lays the near legs of the standing dog and cat over the body on their own, so they keep a lit side", () => {
    const lit = (id: CompanionId, n: number): number => contentPack.companions[id].shapes.filter((s) => s.bone === `body@${n}` && s.slot === "skin" && s.z > 20 && s.z < 20.02).length;
    // the near foreleg, the near hind leg, and the near hind shank under the hock on its own (the
    // whole hind leg's light offset is set by the thigh, which left the shank in shadow)
    expect(lit("stray-dog", DOG_FRAME.stand)).toBe(3);
    expect(lit("alley-cat", CAT_FRAME.stand)).toBe(3);
    expect(lit("alley-cat", CAT_FRAME.arch)).toBe(3);
  });
  it("shades the goose neck as one tube: each lower piece lies over the one above it", () => {
    const z = (bone: string): number => contentPack.companions.goose.shapes.find((s) => s.bone === bone && s.slot === "skin")!.z;
    expect(z("neck1")).toBeGreaterThan(z("neck2"));
    expect(z("neck2")).toBeGreaterThan(z("neck3"));
    expect(z("head")).toBeGreaterThan(z("neck1"));
  });
  it("shows only lit edges at the goose's neck joints, standing or stretched out, facing either way", () => {
    // the lamp is fixed on the stage (LIGHT, up and left); an edge whose outward normal turns
    // away from it gets a teal shadow strip along it. The edge that shows at a joint is the
    // piece below's cut (it lies on top). Check it with the neck standing (rest) and turned to
    // lie flat out in front (attack, run, ko), each facing right and mirrored to face left.
    const L = [LIGHT.dx, LIGHT.dy];
    const ll = Math.hypot(L[0]!, L[1]!);
    const [neck1, neck2] = gooseNeckPieces();
    for (const [j, piece] of [[GOOSE_NECK.joints[1]!, neck1!], [GOOSE_NECK.joints[2]!, neck2!]] as const) {
      const { J, u, n, c } = neckCut(j);
      // the piece really is cut on that line (a whole edge of it lies on the line)
      const on = piece.filter((p) => Math.abs((p[0] - J[0]) * n[0] + (p[1] - J[1]) * n[1] - c) < 1e-6);
      expect(on.length, `joint ${j}`).toBeGreaterThanOrEqual(2);
      const flat = Math.atan2(0, 1) - Math.atan2(u[1], u[0]);   // turns the neck to point straight ahead
      const turn = (a: number): [number, number] => [n[0] * Math.cos(a) - n[1] * Math.sin(a), n[0] * Math.sin(a) + n[1] * Math.cos(a)];
      for (const [pose, m] of [["standing", turn(0)], ["stretched", turn(flat)]] as const) for (const facing of [1, -1]) {
        const lit = (m[0] * facing * L[0]! + m[1] * L[1]!) / ll;
        expect(lit, `joint ${j} ${pose} facing ${facing}`).toBeGreaterThan(-0.1);
      }
    }
  });
  it("tucks the tail of each upper goose neck piece inside a disc about its joint, so a bent joint never pokes a corner out", () => {
    const pieces = gooseNeckPieces();
    for (const k of [1, 2]) {
      const j = GOOSE_NECK.joints[k]!;
      const { J, u } = neckCut(j);
      const r = GOOSE_NECK.width[j]!;
      for (const p of pieces[k]!) {
        const along = (p[0] - J[0]) * u[0] + (p[1] - J[1]) * u[1];
        if (along < -1e-6) expect(Math.hypot(p[0] - J[0], p[1] - J[1]), `neck${k + 1}`).toBeLessThanOrEqual(r + 1e-6);
      }
    }
  });
});
