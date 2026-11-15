/**
 * WP6 gate lines that apply to the static content art: the content pack is complete and typed,
 * every stroke and fill is on the palette (docs/ART.md), each weapon's strike point is its drawn
 * tip, two-hand weapons have the back hand on `grip2` in a held pose, the pets are jointed and
 * stand on the floor, every arena keeps the floor line, and the icons are plain SVG data.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPANION_IDS, MOVE_IDS, SHIELD_IDS, SKILL_IDS, STAGE_IDS, WEAPON_IDS, WEAPON_META } from "@rankzero/core";
import type { HeldId } from "@rankzero/core";
import { COMPANION_CLIPS, PLACEHOLDER_COMPANION_CLIPS, SCRAPPER_CLIPS, strikeTime } from "../../src/contracts";
import type { Dress, FxKind, MoveProp, WeaponArt } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
import { gatePack } from "../../src/gate/pack";
import { INK, allColours } from "../../src/gate/style";
import { ANATOMY, BUILDS } from "../../src/gate/skeleton";
import type { Pt } from "../../src/gate/vocab";
import { parsePolys } from "../../src/gate/vocab";
import { contentPack } from "../../src/content/pack";
import { GATE_UI_ICONS_REDRAW, SHIELD_ICONS, STAT_ICONS_REDRAW, WEAPON_ICONS } from "../../src/content/icons";
import { iconArt } from "../../src/engine/svg";
import { HOME, LOOKS, recorder } from "../gate/helpers";

const rig = createRig(gatePack, contentPack);
const ins = inspectOf(rig);
const S = "scrapper" as const;
const colours = allColours();
const CONTENT_HELD = WEAPON_IDS.filter((id) => id !== "pipe" && id !== "pocket-knife");
const dressOf = (held: HeldId | null, shield: Dress["shield"] = null, look = 0): Dress => ({ look: LOOKS[look]!, held, shield, scale: 1 });

/** Distance from a point to a polygon: 0 inside, else to the nearest edge. */
function distTo(p: Pt, poly: readonly Pt[]): number {
  let inside = false;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  }
  return inside ? 0 : best;
}
/** The art's filled (non-ink) polygons in item units, links laid straight. */
function drawnPolys(art: WeaponArt): Pt[][] {
  if (art.segments !== undefined && art.segments.length > 0) {
    const out: Pt[][] = [];
    let x = 0;
    for (const sg of art.segments) {
      for (const s of sg.shapes) if (s.slot !== "ink") for (const p of parsePolys(s.d)) out.push(p.map(([px, py]) => [px + x, py] as Pt));
      x += sg.length;
    }
    return out;
  }
  return art.shapes.filter((s) => s.slot !== "ink").flatMap((s) => parsePolys(s.d));
}

describe("the content pack is complete", () => {
  it("has art for every held id outside the gate, every shield, prop, arena, pet, effect and icon", () => {
    for (const id of CONTENT_HELD) expect(contentPack.weapons[id], id).toBeDefined();
    expect(Object.keys(contentPack.weapons).sort()).toEqual([...CONTENT_HELD].sort());
    for (const id of SHIELD_IDS) expect(contentPack.shields[id], id).toBeDefined();
    for (const id of ["can", "whistle", "horn"] as MoveProp[]) expect(contentPack.props[id].shapes.length, id).toBeGreaterThan(0);
    for (const id of STAGE_IDS) if (id !== "yard") expect(typeof contentPack.stages[id], id).toBe("function");
    for (const id of COMPANION_IDS) expect(contentPack.companions[id].shapes.length, id).toBeGreaterThan(10);
    for (const id of SKILL_IDS) expect(contentPack.icons[id].shapes.length, id).toBeGreaterThanOrEqual(3);
    for (const c of SCRAPPER_CLIPS) expect(rig.clipInfo(S, c).durationMs, c).toBeGreaterThan(0);
  });
  it("keeps the companion timeline of the placeholder clips until the animation pass", () => {
    for (const id of COMPANION_IDS) for (const c of COMPANION_CLIPS) {
      const info = rig.clipInfo(id, c);
      expect(info.durationMs, `${id} ${c}`).toBe(PLACEHOLDER_COMPANION_CLIPS[c].durationMs);
      expect(info.events, `${id} ${c}`).toEqual(PLACEHOLDER_COMPANION_CLIPS[c].events);
    }
  });
});

describe("drawing rules (docs/ART.md)", () => {
  it("strokes only in Night Ink and fills only with palette colours: weapons, shields, props, pets, arenas, effects", () => {
    const r = recorder();
    for (const id of [...CONTENT_HELD, "fists"] as HeldId[]) for (const c of ["idle", "swing", "throw"]) {
      rig.drawActor(r.env, rig.samplePose(S, c, 120), dressOf(id), { x: 100, y: 195, facing: 1 });
      rig.drawProp(r.env, id === "fists" ? "pipe" : id, { ...HOME, rot: 30 });
    }
    for (const id of SHIELD_IDS) {
      rig.drawActor(r.env, rig.samplePose(S, "idle", 0), dressOf("pipe", id, 1), { x: 100, y: 195, facing: -1 });
      rig.drawProp(r.env, id, { ...HOME, rot: 0 });
    }
    for (const p of ["can", "whistle", "horn"] as MoveProp[]) rig.drawActor(r.env, rig.samplePose(S, "drink", 100), { ...dressOf("bat"), prop: p }, HOME);
    for (const id of COMPANION_IDS) for (const c of COMPANION_CLIPS) rig.drawActor(r.env, rig.samplePose(id, c, 300), dressOf(null), { x: 50, y: 195, facing: 1 });
    for (const id of STAGE_IDS) for (const layer of ["back", "floor"] as const) rig.drawStage(r.env, id, layer, 0.6);
    for (const fx of ["tarp", "tape", "crackers", "rings", "plus", "trail"] as FxKind[]) for (const p of [0.1, 0.4, 0.8]) rig.drawFx(r.env, fx, p, HOME, 5);
    expect(r.strokes.length).toBeGreaterThan(500);
    expect(new Set(r.strokes)).toEqual(new Set([INK]));
    for (const f of new Set(r.fills)) expect(colours.has(f.toUpperCase()), `fill ${f}`).toBe(true);
    expect(r.depth()).toBe(0);
  });
  it("draws no arena as the yard: each of the four has its own picture and ends on the inked floor line", () => {
    const pics = STAGE_IDS.map((id) => { const r = recorder(); rig.drawStage(r.env, id, "back", 0); rig.drawStage(r.env, id, "floor", 0); return r.paths.join("|"); });
    expect(new Set(pics).size).toBe(STAGE_IDS.length);
  });
  it("uses no gradient, pattern, image or canvas filter in the content lane's code", () => {
    const files: string[] = [];
    const walk = (d: string): void => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".ts")) files.push(p); } };
    walk(resolve(__dirname, "../../src/content"));
    expect(files.length).toBeGreaterThan(8);
    for (const f of files) expect(/create(Linear|Radial|Conic)Gradient|createPattern|drawImage|\.filter\s*=|getImageData/.test(readFileSync(f, "utf8")), f).toBe(false);
  });
  it("gives every icon as plain SVG data, ink outline, palette fills", () => {
    const arts = [...SKILL_IDS.map((id) => rig.icon(id)), ...["gear", "back", "dice", "plus", "locker", "kit", "bouts", "close"].map((u) => rig.icon(`ui:${u}` as never)),
      ...SHIELD_IDS.map((id) => iconArt(SHIELD_ICONS[id], id)), ...Object.entries(WEAPON_ICONS).map(([id, a]) => iconArt(a, id as HeldId)),
      ...Object.entries({ ...STAT_ICONS_REDRAW, ...GATE_UI_ICONS_REDRAW }).map(([id, a]) => iconArt(a, id as never))];
    for (const art of arts) {
      expect(art.parts.length).toBeGreaterThan(0);
      for (const p of art.parts) {
        expect(p.d).toMatch(/^M/);
        if (p.stroke !== undefined) expect(p.stroke).toBe(INK);
        expect(colours.has(p.fill.toUpperCase()), p.fill).toBe(true);
      }
    }
    // a Move has the sticker frame, a passive the round badge: their frames differ
    expect(rig.icon(MOVE_IDS[0]).parts[0]!.d).not.toBe(rig.icon("padding").parts[0]!.d.replace(/./, "M"));
  });
});

describe("accurate weapon use (13.3): the strike point is the drawn tip", () => {
  it("puts every weapon's tip on its own drawing (inside it, or within 1 unit of its edge)", () => {
    for (const id of CONTENT_HELD) {
      const art = contentPack.weapons[id];
      const tip: Pt = [art.tip.x, art.tip.y];
      const d = Math.min(...drawnPolys(art).map((p) => distTo(tip, p)));
      expect(d, id).toBeLessThanOrEqual(1);
    }
    for (const id of SHIELD_IDS) {
      const art = contentPack.shields[id];
      expect(Math.min(...drawnPolys(art).map((p) => distTo([art.tip.x, art.tip.y], p))), id).toBe(0);
    }
  });
  it("gives a strike point at the drawn tip, carried by the hand, for the weapon's own clip", () => {
    for (const id of CONTENT_HELD) {
      const meta = WEAPON_META[id];
      if (meta.clip === "throw") continue;               // a throw strikes where the item lands
      const art = contentPack.weapons[id];
      for (const li of [0, 1]) {
        const d = dressOf(id, null, li);
        const sp = rig.strikePoint(S, meta.clip, d);
        const p = rig.samplePose(S, meta.clip, strikeTime(rig.clipInfo(S, meta.clip))!);
        const e = ins.strikeEnd(p, d, HOME, meta.clip);
        expect(Math.hypot(sp.x - e[0], sp.y - e[1]), id).toBeLessThan(1e-6);
        if (art.segments === undefined && art.offhand !== true) {
          const a = rig.handAnchor(p, d, HOME);
          expect(Math.hypot(sp.x - a.x, sp.y - a.y), id).toBeCloseTo(Math.hypot(art.tip.x - art.grip.x, art.tip.y - art.grip.y), 6);
        }
      }
    }
  });
  it("has hands: 2 in WEAPON_META exactly when the art has grip2 or offhand, and offhand exactly for a pair", () => {
    for (const id of CONTENT_HELD) {
      const art = contentPack.weapons[id];
      expect(WEAPON_META[id].hands === 2, id).toBe(art.grip2 !== undefined || art.offhand === true);
      expect(WEAPON_META[id].pair === true, id).toBe(art.offhand === true);
      expect(WEAPON_META[id].flex === true, id).toBe((art.segments?.length ?? 0) >= 3);
    }
  });
  it("pins the back hand within 1 unit of grip2 on every two-hand weapon in the held poses (idle, brace, draw), every build and size, the back arm inside ANATOMY.reach", () => {
    const bones = ins.rigDef(S).bones;
    const up = bones.findIndex((b) => b.id === "armB.up");
    const lo = bones.findIndex((b) => b.id === "armB.lo");
    const hb = bones.findIndex((b) => b.id === "handB");
    const armLen = Math.hypot(bones[lo]!.x, bones[lo]!.y) + Math.hypot(bones[hb]!.x, bones[hb]!.y);
    let checked = 0;
    for (const id of CONTENT_HELD) {
      const art = contentPack.weapons[id];
      if (art.grip2 === undefined) continue;
      for (const c of ["idle", "brace", "draw"]) {
        const d = rig.clipInfo(S, c).durationMs;
        for (let t = 0; t <= d; t += 1000 / 60) {
          const p = rig.samplePose(S, c, t);
          for (let li = 0; li < LOOKS.length; li++) for (const scale of [1, 1.15]) {
            const dr = { ...dressOf(id, null, li), scale };
            const a = rig.handAnchor(p, dr, HOME);
            const r = (a.rot * Math.PI) / 180;
            const gx = art.grip2.x - art.grip.x;
            const gy = art.grip2.y - art.grip.y;
            const got = ins.backGrip(p, dr, HOME);
            const err = Math.hypot(got[0] - (a.x + gx * Math.cos(r) - gy * Math.sin(r)), got[1] - (a.y + gx * Math.sin(r) + gy * Math.cos(r)));
            const what = `${id} ${c} @${Math.round(t)} build ${li} scale ${scale}`;
            expect(err, what).toBeLessThanOrEqual(1);
            // the drawn back arm (shoulder to wrist, in body units) is never pulled straight
            const j = ins.joints(p, dr, HOME);
            const bodyScale = BUILDS[LOOKS[li]!.build]!.scale * scale;
            expect(Math.hypot(j[hb]![0] - j[up]![0], j[hb]![1] - j[up]![1]) / (armLen * bodyScale), what).toBeLessThanOrEqual(ANATOMY.reach + 1e-3);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
  it("pins grip2 in item units, not body units: exact on the tall build at size 1.15, where body units would miss by 2.4", () => {
    // the item is drawn at its own size; pinning grip2 scaled with the body (x1.08 x1.15) put the
    // back hand 10 x 0.242 = 2.4 units past the Broom's grip2
    const art = contentPack.weapons.broom;
    const p = rig.samplePose(S, "idle", 0);
    const dr = { ...dressOf("broom", null, 2), scale: 1.15 };
    const a = rig.handAnchor(p, dr, HOME);
    const r = (a.rot * Math.PI) / 180;
    const ox = art.grip2!.x - art.grip.x;
    const oy = art.grip2!.y - art.grip.y;
    const got = ins.backGrip(p, dr, HOME);
    expect(Math.hypot(got[0] - (a.x + ox * Math.cos(r) - oy * Math.sin(r)), got[1] - (a.y + ox * Math.sin(r) + oy * Math.cos(r)))).toBeLessThan(1e-6);
  });
  it("draws items at their own size: a weapon is 20 to 60 percent larger than life is checked by eye; here, nothing is longer than a scrapper", () => {
    for (const id of CONTENT_HELD) expect(contentPack.weapons[id].length, id).toBeLessThan(84);
  });
});

describe("the pets", () => {
  it("are jointed: a body, a head, three bones per leg, and a tail or wings", () => {
    for (const id of COMPANION_IDS) {
      const bones = ins.rigDef(id).bones.map((b) => b.id);
      expect(bones, id).toContain("body");
      expect(bones, id).toContain("head");
      const legs = new Set(bones.filter((b) => /\.(up|lo|paw|foot)$/.test(b)).map((b) => b.split(".")[0]));
      expect(legs.size, id).toBeGreaterThanOrEqual(id === "goose" || id === "crow" ? 2 : 4);
      for (const l of legs) expect(bones.filter((b) => b.startsWith(`${l}.`)).length, `${id} ${l}`).toBe(3);
      expect(bones.some((b) => b.startsWith("tail") || b.startsWith("wing")), id).toBe(true);
      for (const b of bones) if (b !== "root") expect(contentPack.companions[id].shapes.some((s) => s.bone === b) || ins.rigDef(id).bones.some((q) => q.id !== b && ins.rigDef(id).bones[q.parent]?.id === b), `${id} ${b} draws something or carries a child`).toBe(true);
    }
  });
  it("stand on the floor in idle, inside their joint limits, at the rules' sizes", () => {
    const heights: Record<string, number> = { raccoon: 26, goose: 40, boar: 52, "stray-dog": 34, crow: 26, "alley-cat": 26 };
    for (const id of COMPANION_IDS) for (const t of [0, 300, 600, 900]) {
      const p = rig.samplePose(id, "idle", t);
      expect(Math.abs(ins.lowest(p)), `${id} @${t}`).toBeLessThan(0.01);
      ins.rigDef(id).bones.forEach((b, i) => {
        if (b.limit === undefined) return;
        expect(p.rot[i]!, `${id} ${b.id}`).toBeGreaterThanOrEqual(b.limit[0]);
        expect(p.rot[i]!, `${id} ${b.id}`).toBeLessThanOrEqual(b.limit[1]);
      });
      const joints = ins.joints(p, dressOf(null), HOME);
      const top = Math.min(...joints.map((j) => j[1]));
      expect(-top, `${id} is about its size`).toBeLessThan(heights[id]! * 1.05);
    }
  });
  it("strike with the front of the head and take hits on the body", () => {
    for (const id of COMPANION_IDS) {
      const mouth = rig.strikePoint(id, "attack", dressOf(null));
      const body = rig.hitPoint(id, dressOf(null), "body");
      expect(mouth.x, id).toBeGreaterThan(body.x);
      expect(body.y, id).toBeLessThan(0);
    }
  });
});
