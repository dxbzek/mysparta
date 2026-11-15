/**
 * The stray dog and the goose, redrawn from life (15 Nov 2026): the joints bend the way the
 * animal's do, feet stand still on the floor while they carry weight, the dog's legs land in the
 * order of a real trot and a real rotary gallop (Muybridge, Animal Locomotion, plates 706 and
 * 710), the goose's neck is one outline however it bends, and both are at the owner's sizes.
 * Every number is measured on the engine's own pose (`samplePose`), the one the stage draws.
 */
import { describe, expect, it } from "vitest";
import type { CompanionId } from "@rankzero/core";
import { COMPANION_CLIPS } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
import type { Xf } from "../../src/engine/pose";
import { apply, frames, modelOf } from "../../src/engine/pose";
import { gatePack } from "../../src/gate/pack";
import type { Pt } from "../../src/gate/vocab";
import { parsePolys } from "../../src/gate/vocab";
import { contentPack } from "../../src/content/pack";
import { PET_UNIT } from "../../src/content/pets";
import type { Leg } from "../../src/content/pets/anatomy";
import { DOG_GAITS, strayDog } from "../../src/content/pets/stray-dog";
import { GOOSE_GAITS, goose } from "../../src/content/pets/goose";
import { RACCOON_GAITS, raccoon } from "../../src/content/pets/raccoon";
import { CAT_GAITS, alleyCat } from "../../src/content/pets/alley-cat";
import { BOAR_GAITS, boar } from "../../src/content/pets/boar";
import { CROW_GAITS, crow } from "../../src/content/pets/crow";

const rig = createRig(gatePack, contentPack);
const ins = inspectOf(rig);
const FIGHTER = 84;
type Pet = "stray-dog" | "goose" | "raccoon" | "alley-cat" | "boar" | "crow";
const LEGS: Record<Pet, readonly Leg[]> = { "stray-dog": strayDog().anatomy.legs, goose: goose().anatomy.legs, raccoon: raccoon().anatomy.legs,
  "alley-cat": alleyCat().anatomy.legs, boar: boar().anatomy.legs, crow: crow().anatomy.legs };
const QUADS = ["stray-dog", "raccoon", "alley-cat", "boar"] as const;
const BIRDS = ["goose", "crow"] as const;
/** Each pet's share of a fighter's height (owner, 15 Nov 2026), within 3 points. */
const SHARE: Record<Pet, number> = { "stray-dog": 0.30, goose: 0.35, raccoon: 0.22, "alley-cat": 0.25, crow: 0.20, boar: 0.42 };

function framesAt(id: CompanionId, clip: string, t: number): { fr: Xf[]; index: ReadonlyMap<string, number> } {
  const p = rig.samplePose(id, clip, t);
  const m = modelOf(ins.rigDef(id));
  return { fr: frames(m, p.rot, p.root.x, p.root.y), index: m.index };
}
/** Where a foot's contact point (the front of its sole) is on the stage, y = 0 the floor (pack units). */
function contact(id: Pet, clip: string, leg: string, t: number): Pt {
  const l = LEGS[id].find((q) => q.name === leg)!;
  const { fr, index } = framesAt(id, clip, t);
  return apply(fr[index.get(`${leg}.${l.end}`)!]!, l.contact[0] * PET_UNIT[id], l.contact[1] * PET_UNIT[id]);
}
/** The lowest drawn point of a foot, in art units (the content pack hands a pet over PET_UNIT times larger). */
function footLow(id: Pet, clip: string, leg: string, t: number): number {
  const l = LEGS[id].find((q) => q.name === leg)!;
  const { fr, index } = framesAt(id, clip, t);
  const f = fr[index.get(`${leg}.${l.end}`)!]!;
  return Math.max(...l.sole.map((p) => apply(f, p[0] * PET_UNIT[id], p[1] * PET_UNIT[id])[1])) / PET_UNIT[id];
}
const inside = (p: Pt, poly: readonly Pt[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
const limitOf = (id: CompanionId, bone: string): readonly [number, number] => ins.rigDef(id).bones.find((b) => b.id === bone)!.limit!;

describe("pets drawn from life: joints bend the animal's way", () => {
  it("dog: stifle forward, hock back (the visible backward bend is the ankle), elbow back, wrist folding the paw back", () => {
    for (const s of ["B", "F"]) {
      expect(limitOf("stray-dog", `hind${s}.lo`)[0], "stifle only bends one way").toBeGreaterThan(0);
      expect(limitOf("stray-dog", `hind${s}.paw`)[1], "hock only bends the other way").toBeLessThan(0);
      expect(limitOf("stray-dog", `fore${s}.lo`)[1], "elbow").toBeLessThanOrEqual(0);
      expect(limitOf("stray-dog", `fore${s}.paw`)[1], "wrist folds the paw right back in the swing").toBeGreaterThan(90);
      expect(limitOf("stray-dog", `fore${s}.paw`)[0], "wrist hardly bends forward").toBeGreaterThan(-50);
    }
  });
  it("raccoon, cat and boar bend like the dog: stifle forward, hock back, elbow back, wrist folding back", () => {
    for (const id of ["raccoon", "alley-cat", "boar"] as const) for (const s of ["B", "F"]) {
      expect(limitOf(id, `hind${s}.lo`)[0], `${id} stifle`).toBeGreaterThan(0);
      expect(limitOf(id, `hind${s}.paw`)[1], `${id} hock`).toBeLessThan(0);
      expect(limitOf(id, `fore${s}.lo`)[1], `${id} elbow`).toBeLessThanOrEqual(0);
      expect(limitOf(id, `fore${s}.paw`)[1], `${id} wrist`).toBeGreaterThan(90);
    }
  });
  it("goose and crow: the heel (ankle) points back, like a dog's hock", () => {
    for (const id of BIRDS) for (const s of ["B", "F"]) expect(limitOf(id, `leg${s}.lo`)[1], id).toBeLessThan(0);
  });
  it("every clip of all six, sampled every 5 ms, stays inside those limits (so no joint ever bends backward)", () => {
    const bad: string[] = [];
    for (const id of [...QUADS, ...BIRDS]) for (const c of COMPANION_CLIPS) {
      const d = rig.clipInfo(id, c).durationMs;
      for (let t = 0; t <= d; t += 5) {
        const p = rig.samplePose(id, c, t);
        ins.rigDef(id).bones.forEach((b, i) => { if (b.limit !== undefined && (p.rot[i]! < b.limit[0] - 1e-6 || p.rot[i]! > b.limit[1] + 1e-6)) bad.push(`${id} ${c} ${b.id} ${p.rot[i]!.toFixed(0)} @${t}`); });
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("pets drawn from life: feet planted while they carry weight", () => {
  const cases = [
    ["stray-dog", "run", DOG_GAITS.run, ["hindB", "hindF", "foreB", "foreF"]],
    ["stray-dog", "flee", DOG_GAITS.flee, ["hindB", "hindF", "foreB", "foreF"]],
    ["goose", "run", GOOSE_GAITS.run, ["legB", "legF"]],
    ["goose", "flee", GOOSE_GAITS.flee, ["legB", "legF"]],
    ["raccoon", "run", RACCOON_GAITS.run, ["hindB", "hindF", "foreB", "foreF"]],
    ["raccoon", "flee", RACCOON_GAITS.flee, ["hindB", "hindF", "foreB", "foreF"]],
    ["alley-cat", "run", CAT_GAITS.run, ["hindB", "hindF", "foreB", "foreF"]],
    ["alley-cat", "flee", CAT_GAITS.flee, ["hindB", "hindF", "foreB", "foreF"]],
    ["boar", "run", BOAR_GAITS.run, ["hindB", "hindF", "foreB", "foreF"]],
    ["boar", "flee", BOAR_GAITS.flee, ["hindB", "hindF", "foreB", "foreF"]],
    ["crow", "run", CROW_GAITS.run, ["legB", "legF"]],
  ] as const;
  for (const [id, clip, gait, legs] of cases) {
    it(`${id} ${clip}: each foot in stance is on the floor and slides back at one steady speed (the body travels over it)`, () => {
      const d = rig.clipInfo(id, clip).durationMs;
      const speeds: number[] = [];
      for (const leg of legs) {
        const down = (gait as Record<string, number>)[leg]!;
        const pts: [number, number][] = [];
        for (let k = 1; k < 20; k++) {
          const u = down + gait.duty * (0.05 + (0.9 * k) / 20);
          const t = (u % 1) * d;
          const c = contact(id, clip, leg, t);
          expect(Math.abs(c[1]) / PET_UNIT[id], `${leg} on the floor @${t.toFixed(0)}`).toBeLessThan(0.08);
          pts.push([u * d, c[0]]);
        }
        // a straight line through x(t): no skating back and forth
        const n = pts.length;
        const mt = pts.reduce((a, p) => a + p[0], 0) / n;
        const mx = pts.reduce((a, p) => a + p[1], 0) / n;
        const slope = pts.reduce((a, p) => a + (p[0] - mt) * (p[1] - mx), 0) / pts.reduce((a, p) => a + (p[0] - mt) ** 2, 0);
        for (const p of pts) expect(Math.abs(mx + slope * (p[0] - mt) - p[1]) / PET_UNIT[id], `${leg} slides evenly`).toBeLessThan(0.15);
        expect(slope, `${leg} moves back under the body`).toBeLessThan(0);
        speeds.push(slope);
      }
      for (const s of speeds) expect(Math.abs(s / speeds[0]! - 1), `${id} ${clip}: every planted foot at the body's one speed`).toBeLessThan(0.05);
    });
  }
  it("dog attack: the hind feet stay where they stand through the lunge, the bite and the shake", () => {
    for (const leg of ["hindB", "hindF"]) {
      const c0 = contact("stray-dog", "attack", leg, 0);
      for (let t = 0; t <= 280; t += 10) {
        const c = contact("stray-dog", "attack", leg, t);
        expect(Math.hypot(c[0] - c0[0], c[1] - c0[1]) / PET_UNIT["stray-dog"], `${leg} @${t}`).toBeLessThan(0.15);
      }
    }
  });
  it("planted fault: a stance foot moved off its line is caught", () => {
    const pts = [0, 1, 2, 3].map((k) => [k, -k + (k === 2 ? 0.6 : 0)] as const);
    const mt = 1.5;
    const mx = pts.reduce((a, p) => a + p[1], 0) / 4;
    const slope = pts.reduce((a, p) => a + (p[0] - mt) * (p[1] - mx), 0) / pts.reduce((a, p) => a + (p[0] - mt) ** 2, 0);
    expect(Math.max(...pts.map((p) => Math.abs(mx + slope * (p[0] - mt) - p[1])))).toBeGreaterThan(0.15);
  });
});

describe("pets drawn from life: footfall order of the real gaits", () => {
  /** Shares of the cycle at which each foot touches down, measured: its lowest point comes down
   *  to the floor after being clear of it. */
  function touchdowns(id: Pet, clip: string, legs: readonly string[]): Record<string, number> {
    const d = rig.clipInfo(id, clip).durationMs;
    const out: Record<string, number> = {};
    const N = 240;
    for (const leg of legs) {
      const y = Array.from({ length: N }, (_, k) => footLow(id, clip, leg, (k * d) / N));
      for (let k = 0; k < N; k++) {
        const prev = y[(k - 1 + N) % N]!;
        if (y[k]! > -0.06 && prev <= -0.06) { out[leg] = k / N; break; }
      }
      expect(out[leg], `${id} ${clip} ${leg} lands once a cycle`).toBeDefined();
    }
    return out;
  }
  const gap = (a: number, b: number): number => { const g = (b - a + 1) % 1; return g; };
  it("dog run is a trot: diagonal pairs land together, half a stride apart (plate 706)", () => {
    const td = touchdowns("stray-dog", "run", ["hindB", "hindF", "foreB", "foreF"]);
    const near = (a: number, b: number): number => Math.min(gap(a, b), gap(b, a));
    expect(near(td.hindB!, td.foreF!), "far hind with near fore").toBeLessThan(0.06);
    expect(near(td.hindF!, td.foreB!), "near hind with far fore").toBeLessThan(0.06);
    expect(Math.abs(gap(td.hindB!, td.hindF!) - 0.5), "the pairs alternate").toBeLessThan(0.06);
    expect(Math.abs(gap(td.foreF!, td.foreB!) - 0.5)).toBeLessThan(0.06);
  });
  it("dog flee is a rotary gallop: far hind, near hind, near fore, far fore, with two flights (plate 710)", () => {
    const td = touchdowns("stray-dog", "flee", ["hindB", "hindF", "foreB", "foreF"]);
    const order = ["hindB", "hindF", "foreF", "foreB"].map((l) => gap(td.hindB!, td[l]!));
    for (let i = 1; i < order.length; i++) expect(order[i]!, `rotary order ${i}`).toBeGreaterThan(order[i - 1]!);
    // flights: some moments with every foot clear of the floor, stretched out and gathered
    const d = rig.clipInfo("stray-dog", "flee").durationMs;
    const flying = Array.from({ length: 96 }, (_, k) => k / 96).filter((u) => rig.samplePose("stray-dog", "flee", u * d).lift > 0.3);
    expect(flying.some((u) => u > 0.3 && u < 0.6), "the stretched flight").toBe(true);
    expect(flying.some((u) => u > 0.8 || u < 0.05), "the gathered flight").toBe(true);
  });
  it("raccoon, cat and boar run in a trot too: diagonal pairs together, the pairs half a stride apart", () => {
    for (const id of ["raccoon", "alley-cat", "boar"] as const) {
      const td = touchdowns(id, "run", ["hindB", "hindF", "foreB", "foreF"]);
      const near = (a: number, b: number): number => Math.min(gap(a, b), gap(b, a));
      expect(near(td.hindB!, td.foreF!), id).toBeLessThan(0.06);
      expect(near(td.hindF!, td.foreB!), id).toBeLessThan(0.06);
      expect(Math.abs(gap(td.hindB!, td.hindF!) - 0.5), id).toBeLessThan(0.06);
    }
  });
  it("their flee is a gallop: both hind feet, then both fore, and the cat and the raccoon fly (plate 718)", () => {
    for (const id of ["raccoon", "alley-cat", "boar"] as const) {
      const td = touchdowns(id, "flee", ["hindB", "hindF", "foreB", "foreF"]);
      const order = ["hindB", "hindF", "foreF", "foreB"].map((l) => gap(td.hindB!, td[l]!));
      for (let i = 1; i < order.length; i++) expect(order[i]!, `${id} order ${i}`).toBeGreaterThan(order[i - 1]!);
    }
    for (const id of ["raccoon", "alley-cat"] as const) {
      const d = rig.clipInfo(id, "flee").durationMs;
      expect(Array.from({ length: 96 }, (_, k) => k / 96).some((u) => rig.samplePose(id, "flee", u * d).lift > 0.3), id).toBe(true);
    }
  });
  it("crow: hops with both feet together, off the floor between hops; flies its flee", () => {
    const td = touchdowns("crow", "run", ["legB", "legF"]);
    expect(Math.min(gap(td.legB!, td.legF!), gap(td.legF!, td.legB!))).toBeLessThan(0.05);
    const d = rig.clipInfo("crow", "run").durationMs;
    expect(Array.from({ length: 48 }, (_, k) => (k * d) / 48).some((t) => rig.samplePose("crow", "run", t).lift > 1.5)).toBe(true);
    const f = rig.clipInfo("crow", "flee").durationMs;
    for (let t = 0; t < f; t += 20) expect(rig.samplePose("crow", "flee", t).lift, `flying @${t}`).toBeGreaterThan(3);
  });
  it("goose waddle: the feet alternate, half a stride apart", () => {
    for (const c of ["run", "flee"]) {
      const td = touchdowns("goose", c, ["legB", "legF"]);
      expect(Math.abs(gap(td.legB!, td.legF!) - 0.5), c).toBeLessThan(0.06);
    }
  });
  it("planted fault: a pace (both legs of one side together) is not a trot", () => {
    const pace = { hindB: 0, foreB: 0.02, hindF: 0.5, foreF: 0.52 };
    expect(Math.min(gap(pace.hindB, pace.foreF), gap(pace.foreF, pace.hindB))).toBeGreaterThan(0.06);
  });
});

describe("pets drawn from life: one outline, real sizes", () => {
  it("draws each animal's body masses in one outline group, and the goose neck with no stripes", () => {
    const groupOf = (id: CompanionId, bones: string[]): Set<number> =>
      new Set(contentPack.companions[id].shapes.filter((s) => bones.includes(s.bone) && s.slot !== "ink").map((s) => Math.floor(s.z)));
    expect([...groupOf("stray-dog", ["hips", "body", "chest", "neck", "head", "jaw"])]).toEqual([20]);
    expect([...groupOf("goose", ["body", "tail", "neck1", "neck2", "neck3", "head", "jaw"])]).toEqual([20]);
    for (const id of ["raccoon", "alley-cat", "boar"] as const) expect([...groupOf(id, ["hips", "body", "chest", "neck", "head", "jaw"])], id).toEqual([20]);
    expect([...groupOf("crow", ["body", "tail", "neck", "head", "jaw"])]).toEqual([20]);
    expect(contentPack.companions.goose.shapes.filter((s) => /^neck/.test(s.bone) && s.slot === "ink")).toEqual([]);
  });
  it("keeps the goose neck one tube in every pose: each neck joint lies inside both pieces it joins", () => {
    const shapes = contentPack.companions.goose.shapes;
    const chain = ["neck1", "neck2", "neck3", "head"];
    const bad: string[] = [];
    for (const c of COMPANION_CLIPS) {
      const d = rig.clipInfo("goose", c).durationMs;
      for (let t = 0; t <= d; t += 10) {
        const { fr, index } = framesAt("goose", c, t);
        const polyOf = (bone: string): Pt[] => {
          const s = shapes.find((q) => q.bone === bone && q.slot === "skin")!;
          return parsePolys(s.d)[0]!.map((p) => apply(fr[index.get(bone)!]!, p[0], p[1]));
        };
        for (let k = 1; k < chain.length; k++) {
          const f = fr[index.get(chain[k]!)!]!;
          const j: Pt = [f.e, f.f];
          if (!inside(j, polyOf(chain[k - 1]!)) || !inside(j, polyOf(chain[k]!))) bad.push(`${c} @${t} ${chain[k]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
  it("stands at the owner's sizes: dog 30%, goose 35%, raccoon 22%, cat 25%, crow 20%, boar under 45% of a fighter", () => {
    const height = (id: CompanionId): number => {
      const p = rig.samplePose(id, "idle", 0);
      const m = modelOf(ins.rigDef(id));
      const fr = frames(m, p.rot, p.root.x, p.root.y);
      let top = 0;
      for (const s of contentPack.companions[id].shapes) for (const poly of parsePolys(s.d)) for (const q of poly) top = Math.min(top, apply(fr[m.index.get(s.bone)!]!, q[0], q[1])[1]);
      return -top / FIGHTER / PET_UNIT[id];
    };
    for (const id of [...QUADS, ...BIRDS]) expect(Math.abs(height(id) - SHARE[id]), `${id} ${height(id).toFixed(3)}`).toBeLessThan(0.03);
    expect(height("boar")).toBeLessThan(0.45);
  });
  it("the crow reads on the dark arena: blue-grey sheen on its back, wings and head, and a pale eye", () => {
    const shapes = contentPack.companions.crow.shapes;
    for (const b of ["body", "head", "wingF"]) expect(shapes.some((s) => s.bone === b && s.slot === "accent"), b).toBe(true);
    expect(shapes.some((s) => s.bone === "head" && s.slot === "white")).toBe(true);
  });
  it("the goose wing fans open: three blades, each turned further from the last when the wing is spread", () => {
    const p = rig.samplePose("goose", "attack", 100);
    const def = ins.rigDef("goose");
    const at = (id: string): number => p.rot[def.bones.findIndex((b) => b.id === id)]!;
    expect(at("wingF")).toBeGreaterThan(40);
    expect(at("wingF.mid")).toBeLessThan(-15);
    expect(at("wingF.tip")).toBeLessThan(-15);
  });
});
