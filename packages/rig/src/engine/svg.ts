/**
 * Plain SVG data for the DOM side: portraits for cards, companion portraits and icons. Same
 * parts, same colours and the same Night Ink outline as the canvas; a portrait is the idle
 * pose's head and shoulders, flat lit colour plus each part's own shadow shape.
 */
import type { CompanionId, Look } from "@rankzero/core";
import type { AppearanceSet, Clip, ColourSlot, FaceId, IconArt, IconRef, PropArt, RigDef, Shape, SvgArt, SvgPart } from "../contracts";
import type { CompanionArt } from "../gate/placeholders";
import type { SlotColours } from "../gate/style";
import { FIXED, ICON, INK, LINE, TEAL, TEAL_DEEP, shadeOf, slotColour } from "../gate/style";
import { bbox, dPoly, ellipsePoly, parsePolys } from "../gate/vocab";
import type { Xf } from "./pose";
import { frames, modelOf, mul, scaleXf } from "./pose";
import { sampleRaw } from "./sample";

const n2 = (v: number): string => String(Math.round(v * 1000) / 1000);
const matrix = (m: Xf): string => `matrix(${n2(m.a)} ${n2(m.b)} ${n2(m.c)} ${n2(m.d)} ${n2(m.e)} ${n2(m.f)})`;
const wrap = <T>(list: readonly T[], i: number | undefined): T => list[(((i ?? 0) % list.length) + list.length) % list.length]!;

function partsOf(shapes: readonly Shape[], frameOf: (bone: string) => Xf | undefined, colour: (slot: ColourSlot) => string, line: number): SvgPart[] {
  const sorted = [...shapes].sort((a, b) => a.z - b.z);
  const out: SvgPart[] = [];
  for (const s of sorted) {
    const m = frameOf(s.bone);
    if (m === undefined) continue;
    const transform = matrix(m);
    if (s.slot === "ink") { out.push({ d: s.d, fill: INK, transform }); continue; }
    const lit = colour(s.slot);
    out.push({ d: s.d, fill: lit, stroke: INK, strokeWidth: line, transform });
    if (s.shade !== undefined) out.push({ d: s.shade, fill: shadeOf(lit), transform });
  }
  return out;
}

export function portraitArt(looks: AppearanceSet, look: Look, rig: RigDef, idle: Clip): SvgArt {
  const model = modelOf(rig);
  const raw = sampleRaw(model, idle, 0);
  const rot = [...raw.rot];
  // a straight, front-on bust: no lean, arms down
  for (const id of ["pelvis", "torso", "head", "armF.up", "armB.up", "armF.lo", "armB.lo"]) { const i = model.index.get(id); if (i !== undefined) rot[i] = 0; }
  const fr = frames(model, rot, 0, 0);
  const colours: SlotColours = { skin: wrap(looks.skin, look.skin), hair: wrap(looks.hairColor, look.hairColor), palette: wrap(looks.palettes, look.palette) };
  const faces = wrap(looks.faces, look.face);
  const shapes: Shape[] = [
    ...wrap(looks.tops, look.top).filter((s) => s.bone === "torso" || s.bone.endsWith(".up")),
    ...wrap(looks.heads, look.head), ...wrap(looks.hair, look.hair), ...(faces["neutral" as FaceId] ?? []),
    ...wrap(looks.accessories, look.accessory),
  ];
  // the build shows in the bust as it does on the stage: the trunk and the arms drawn wider or
  // narrower (the engine's `kx` per bone), so a stocky fighter's card is not a lean one's
  const build = wrap(looks.builds, look.build);
  const kxOf = (b: string): number => (b === "torso" || b === "pelvis" ? build.torso : /^(arm|leg)[FB]\.(up|lo)$/.test(b) ? build.limb : 1);
  const head = fr[model.index.get("head") ?? 0]!;
  const cx = head.e + 2.4;
  const cy = head.f - 7;
  const box = 30;
  const x0 = cx - box / 2;
  const y0 = cy - box * 0.42;
  return {
    viewBox: `${n2(x0)} ${n2(y0)} ${box} ${box}`,
    parts: [
      { d: dPoly([[x0, y0], [x0 + box, y0], [x0 + box, y0 + box], [x0, y0 + box]]), fill: TEAL_DEEP },
      { d: dPoly(ellipsePoly(x0 + box * 0.28, y0 + box * 0.3, box * 0.42, box * 0.42, 20)), fill: TEAL },
      ...partsOf(shapes, (b) => { const i = model.index.get(b); return i === undefined ? undefined : kxOf(b) === 1 ? fr[i] : mul(fr[i]!, scaleXf(kxOf(b), 1)); }, (s) => slotColour(s, colours), 0.9),
    ],
  };
}

export function companionPortraitArt(id: CompanionId, art: CompanionArt, colours: SlotColours): SvgArt {
  const model = modelOf(art.rig);
  const idle = art.clips.idle;
  const raw = sampleRaw(model, idle, 0);
  const fr = frames(model, raw.rot, 0, 0);
  // a pet drawn frame by frame puts its body on "bone@N" shapes: show the frame the idle pose
  // stands in (the "frame" bone's angle rounded), as the canvas does, and drop the others
  const fi = model.index.get("frame");
  const frame = fi === undefined ? 0 : Math.round(raw.rot[fi] ?? 0);
  const shapes = art.shapes.flatMap((s): Shape[] => {
    const at = s.bone.indexOf("@");
    if (at < 0) return [s];
    return Number(s.bone.slice(at + 1)) === frame ? [{ ...s, bone: s.bone.slice(0, at) }] : [];
  });
  const polys = shapes.flatMap((s) => {
    const i = model.index.get(s.bone);
    if (i === undefined) return [];
    const m = fr[i]!;
    return parsePolys(s.d).map((p) => p.map((q) => [m.a * q[0] + m.c * q[1] + m.e, m.b * q[0] + m.d * q[1] + m.f] as [number, number]));
  });
  const [x0, y0, x1, y1] = bbox(polys);
  const size = Math.max(x1 - x0, y1 - y0) * 1.15;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  void id;
  return {
    viewBox: `${n2(cx - size / 2)} ${n2(cy - size / 2)} ${n2(size)} ${n2(size)}`,
    parts: [
      { d: dPoly([[cx - size / 2, cy - size / 2], [cx + size / 2, cy - size / 2], [cx + size / 2, cy + size / 2], [cx - size / 2, cy + size / 2]]), fill: TEAL_DEEP },
      ...partsOf(shapes, (b) => { const i = model.index.get(b); return i === undefined ? undefined : fr[i]; }, (s) => (s === "white" ? FIXED.white : slotColour(s, colours)), size / 40),
    ],
  };
}

const RING: SvgArt = { viewBox: "0 0 24 24", parts: [{ d: dPoly(ellipsePoly(12, 12, 8, 8, 24)), fill: "none", stroke: ICON.ui, strokeWidth: 2 }] };

function selfColour(ref: IconRef): string {
  if (ref === "stat:health") return ICON.health;
  if (ref === "stat:strength") return ICON.strength;
  if (ref === "stat:agility") return ICON.agility;
  if (ref === "stat:speed") return ICON.speed;
  return ICON.ui;
}
const ICON_COLOURS: SlotColours = { skin: "#F0A462", hair: "#2A160A", palette: { top: "#C35E26", bottom: "#6A5240", shoes: "#3E2A1C", accent: "#B0582A" } };

/** An icon from icon art (24-unit box), or a weapon drawn diagonally into the box, or the ring. */
export function iconArt(art: IconArt | null, ref: IconRef, weapon?: PropArt & { length: number }): SvgArt {
  if (art !== null) {
    const own = selfColour(ref);
    const parts: SvgPart[] = [];
    for (const s of art.shapes) {
      const fill = s.slot === "self" ? own : s.slot === "ink" ? INK : slotColour(s.slot, ICON_COLOURS);
      parts.push(s.slot === "ink" ? { d: s.d, fill } : { d: s.d, fill, stroke: INK, strokeWidth: s.w ?? LINE.icon });
      if (s.shade !== undefined) parts.push({ d: s.shade, fill: shadeOf(fill) });
    }
    return { viewBox: "0 0 24 24", parts };
  }
  if (weapon !== undefined) {
    const polys = weapon.shapes.flatMap((s) => parsePolys(s.d));
    const [x0, y0, x1, y1] = bbox(polys);
    const len = Math.max(x1 - x0, y1 - y0, 1);
    const k = (ref === "fists" ? 15 : 24) / len;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const angle = ref === "fists" ? 0 : -45;
    const transform = `translate(12 12) rotate(${angle}) scale(${n2(k)}) translate(${n2(-cx)} ${n2(-cy)})`;
    const parts: SvgPart[] = [];
    for (const s of [...weapon.shapes].sort((a, b) => a.z - b.z)) {
      if (s.slot === "ink") { parts.push({ d: s.d, fill: INK, transform }); continue; }
      const fill = slotColour(s.slot, ICON_COLOURS);
      parts.push({ d: s.d, fill, stroke: INK, strokeWidth: n2Num(0.85 / k), transform });
    }
    return { viewBox: "0 0 24 24", parts };
  }
  return RING;
}
const n2Num = (v: number): number => Math.round(v * 1000) / 1000;
