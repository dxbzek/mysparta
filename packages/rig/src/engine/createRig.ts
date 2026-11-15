/**
 * `createRig(gatePack, contentPack?)`: the one `Rig` every consumer draws with.
 *
 * One body of maths serves drawing, the hand anchor, the strike point and the hit point, so a
 * point it gives is a point on the picture. Poses come from `sample.ts` (keys, lag, aim, planted
 * feet); `figure()` below turns a pose and a dress into bone frames on the stage (lead swap for a
 * pair, back hand pinned to `grip2`, build size, mirroring); `draw.ts` paints.
 *
 * With no content pack the rig answers for what it has no art for with the contract's fixed
 * stand-ins (`gate/placeholders.ts`), applies `CLIP_FALLBACK`, draws the yard for every arena and
 * nothing for a content effect or a Move prop, warning once each.
 */
import type { CompanionId, HeldId, Look, PropId, ShieldId, StageId } from "@rankzero/core";
import { COMPANION_IDS, WEAPON_META, isShieldId } from "@rankzero/core";
import type { Aim, AppearanceSet, IconArt, Clip, ClipInfo, CompanionClip, ContentClip, ContentPack, CreateRig, DrawEnv, Dress,
  FaceId, FxDraw, FxKind, GatePack, IconRef, Offset, Place, Pose, PropArt, Rig, RigDef, RigId, Shape, StageDraw,
  SvgArt, WeaponArt } from "../contracts";
import { CLIP_FALLBACK, COMPANION_CLIPS, SCRAPPER_CLIPS, strikeTime } from "../contracts";
import { BODY_CENTRE, HEAD_CENTRE, KNUCKLES } from "../gate/parts";
import { PLACEHOLDER_COMPANIONS, placeholderWeapon, shieldStandIn } from "../gate/placeholders";
import type { CompanionArt } from "../gate/placeholders";
import { ANATOMY, BONE, GRIP_ROT, SCRAPPER_RIG, SECONDARY } from "../gate/skeleton";
import { COMPANION_COLOURS, FIXED, GROUND_SHADOW, HAIR_COLOUR, LINE, PALETTES, SKIN, shadeOf, slotColour } from "../gate/style";
import type { SlotColours } from "../gate/style";
import { parsePolys } from "../gate/vocab";
import type { Paint } from "./draw";
import { paintParts } from "./draw";
import type { Model, Xf } from "./pose";
import { apply, frames, modelOf, moveXf, mul, rotXf, scaleXf, worldAngles } from "./pose";
import { twoBone } from "./ik";
import type { BendAmount, Body } from "./sample";
import { clipTime, frameAt, hullAt, poseAt, sampleRaw } from "./sample";
import { companionPortraitArt, iconArt, portraitArt } from "./svg";

/** Length of the back arm, shoulder to wrist (figure units). */
const BACK_ARM = Math.hypot(SCRAPPER_RIG.bones[BONE.armBlo]!.x, SCRAPPER_RIG.bones[BONE.armBlo]!.y)
  + Math.hypot(SCRAPPER_RIG.bones[BONE.handB]!.x, SCRAPPER_RIG.bones[BONE.handB]!.y);
/** The farthest a two-hand item's back hand is from its shoulder, as a share of the arm: a
 *  little inside ANATOMY.reach, so the drawn arm never locks. */
export const TWO_HAND_REACH = ANATOMY.reach - 0.01;
/** The nearest, as a share of the arm: the elbow folds no further than its limit, and a hand on
 *  the shoulder reads as a broken arm. */
export const TWO_HAND_FOLD = 0.32;
/** How far the back hand of a two-hand item bends at the wrist to follow the shaft (degrees,
 *  as ANATOMY.wrist, with a margin). */
export const BACK_WRIST = [-60, 70] as const;
/** Where a back hand eases off a two-hand item (see `figure`), in degrees past a shoulder's
 *  limit: it holds fully up to 20 inside the limit and has let go 5 past it. */
export const BACK_LET_GO = [-20, 5] as const;
/** How far (figure units) the front hand may be drawn in or out to keep both hands on a two-hand
 *  item: fully up to the first, the back hand has let go by the second. */
export const REACH_PULL = [10, 18] as const;
/** The most the front hand is pushed out (figure units) when grip2 is folded in too close to
 *  the back shoulder. */
export const FOLD_PULL = 2.5;
/** Shares of the arm's length from the back shoulder to grip2 (after that push) over which the
 *  back hand lets go: gone at the first, held from the second. */
export const FOLD_LET_GO = [0.22, 0.3] as const;

const warned = new Set<string>();
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[rig] ${message}`);
}

const HOME: Place = { x: 0, y: 0, facing: 1 };
/** The even size change a key's squash stands for (see `figure`). */
const squashOf = (pose: Pose): number => Math.sqrt(Math.abs(pose.root.sx * pose.root.sy)) || 1;
const wrap = (i: number | undefined, n: number): number => (n <= 0 ? 0 : (((i ?? 0) % n) + n) % n);
const pick = <T>(list: readonly T[], i: number | undefined): T => list[wrap(i, list.length)]!;
const LIMB_BONES = new Set(["armB.up", "armB.lo", "armF.up", "armF.lo", "legB.up", "legB.lo", "legF.up", "legF.lo"]);
const TRUNK_BONES = new Set(["torso", "pelvis"]);
const GATE_FX: ReadonlySet<string> = new Set(["burst", "dust", "spark", "whoosh"]);

/** A shape's bone and drawn frame: "chest@3" is drawn on "chest" only in frame 3 of a pet drawn
 *  frame by frame; a bone name with no "@" is drawn in every frame. */
const frameOf = (bone: string): [string, number | undefined] => { const k = bone.indexOf("@"); return k < 0 ? [bone, undefined] : [bone.slice(0, k), +bone.slice(k + 1)]; };
/** The hull of a rig: every vertex of its shapes, per bone (of one drawn frame, when given). */
function hullOf(model: Model, shapes: readonly Shape[], frame?: number): (readonly [number, number])[][] {
  const out: (readonly [number, number])[][] = model.def.bones.map(() => []);
  for (const s of shapes) {
    if (s.slot === "ink") continue;
    const [bone, n] = frameOf(s.bone);
    if (n !== undefined && n !== (frame ?? 0)) continue;
    const i = model.index.get(bone.replace(/:open$/, ""));
    if (i === undefined) continue;
    for (const p of parsePolys(s.d)) for (const q of p) out[i]!.push(q);
  }
  return out;
}
function plantedFeet(model: Model, clips: Iterable<Clip>): number[] {
  const set = new Set<number>();
  for (const c of clips) for (const id of c.plant ?? []) { const i = model.index.get(id); if (i !== undefined) set.add(i); }
  for (const id of ["footB", "footF"]) { const i = model.index.get(id); if (i !== undefined) set.add(i); }
  return [...set].sort((a, b) => a - b);
}

export const createRig: CreateRig = (gate: GatePack, content?: ContentPack): Rig => {
  const gateOnly = content === undefined;
  const looks: AppearanceSet = content?.looks ?? gate.looks;
  const model = modelOf(gate.scrapper);

  // ------------------------------------------------------------------- clips and bodies
  const scrapperClips: Record<string, Clip> = { ...gate.clips, ...(content?.clips ?? {}) };
  const hullShapes = [...pick(looks.heads, 0), ...pick(looks.tops, 0), ...pick(looks.bottoms, 0), ...pick(looks.shoes, 0),
    ...looks.hands.filter((s) => !s.bone.endsWith(":open"))];
  const scrapperBody: Body = {
    rig: "scrapper", model, hull: hullOf(model, hullShapes), feet: plantedFeet(model, Object.values(scrapperClips)),
    bend: { bones: [[BONE.torso, 0.35], [BONE.armFup, 0.5], [BONE.armBup, 0.5]], crouch: 0.2 },
    trailBone: model.index.get("handF") ?? -1,
    secondary: SECONDARY.flatMap((x) => { const i = model.index.get(x.bone); return i === undefined ? [] : [{ bone: i, gain: x.gain, drag: x.drag, ms: x.ms }]; }),
  };
  const companionArt = (id: CompanionId): CompanionArt => content?.companions?.[id] ?? PLACEHOLDER_COMPANIONS[id];
  const companionBodies = new Map<CompanionId, Body>();
  const companionBody = (id: CompanionId): Body => {
    let b = companionBodies.get(id);
    if (b === undefined) {
      const art = companionArt(id);
      const m = modelOf(art.rig);
      const named = (n: string, fallback: number): number => m.index.get(n) ?? fallback;
      const fb = m.index.get("frame");
      const count = Math.max(0, ...art.shapes.map((s) => frameOf(s.bone)[1] ?? 0)) + 1;
      b = { rig: id, model: m, hull: hullOf(m, art.shapes), feet: plantedFeet(m, Object.values(art.clips)).filter((i) => i < m.def.bones.length && m.def.bones[i]!.parent >= 0 && m.parent[m.parent[i]!]! >= 0),
        bend: { bones: [[named("body", 1), 0.5], [named("head", 2), 0.5]], crouch: 0 }, trailBone: -1 };
      if (fb !== undefined) b.frames = { bone: fb, hulls: Array.from({ length: count }, (_, n) => hullOf(m, art.shapes, n)) };
      companionBodies.set(id, b);
    }
    return b;
  };
  const isCompanion = (rig: RigId): rig is CompanionId => (COMPANION_IDS as readonly string[]).includes(rig);
  const bodyOf = (rig: RigId): Body => (isCompanion(rig) ? companionBody(rig) : scrapperBody);

  const variants: Readonly<Record<string, Clip>> = content?.variants ?? {};
  /** The clip a scrapper holding `held` plays for `name`: the item's own variant, or `name`. */
  function attackClip(held: HeldId | null | undefined, name: string): string {
    const v = content?.uses?.[held ?? "fists"]?.[name];
    return v !== undefined && (variants[v] !== undefined || scrapperClips[v] !== undefined) ? v : name;
  }
  function findClip(rig: RigId, name0: string, held?: HeldId | null): Clip {
    const name = isCompanion(rig) || held === undefined ? name0 : attackClip(held, name0);
    if (!isCompanion(rig) && variants[name] !== undefined) return variants[name]!;
    if (isCompanion(rig)) {
      const clips = companionArt(rig).clips as Record<string, Clip>;
      if ((COMPANION_CLIPS as readonly string[]).includes(name) && clips[name] !== undefined) return clips[name]!;
      warnOnce(`clip:${rig}:${name}`, `no clip "${name}" for rig "${rig}", using idle`);
      return clips["idle"]!;
    }
    if ((SCRAPPER_CLIPS as readonly string[]).includes(name)) {
      const own = scrapperClips[name];
      if (own !== undefined) return own;
      const fb = (CLIP_FALLBACK as Record<string, string>)[name];
      if (fb !== undefined && scrapperClips[fb] !== undefined) return scrapperClips[fb]!;
    }
    warnOnce(`clip:scrapper:${name}`, `no clip "${name}" for the scrapper, using idle`);
    return scrapperClips["idle"]!;
  }

  // ---------------------------------------------------------------------------- items
  const weaponArt = (id: HeldId): WeaponArt => {
    if (id === "fists" || id === "pipe" || id === "pocket-knife") return gate.weapons[id];
    const own = content?.weapons?.[id];
    return own ?? placeholderWeapon(id);
  };
  const shieldArt = (id: ShieldId): WeaponArt => content?.shields?.[id] ?? shieldStandIn(id);
  const isPair = (id: HeldId): boolean => WEAPON_META[id]?.pair === true;
  const heldOf = (dress: Dress): HeldId => dress.held ?? "fists";

  // --------------------------------------------------------------------------- figures
  interface Fig {
    fr: Xf[]; wa: number[]; map: Xf; s: number; build: { scale: number; limb: number; torso: number };
    rot: number[]; held: HeldId; art: WeaponArt | null; backLeads: boolean; facing: 1 | -1;
    /** 1 while the back hand holds a two-hand item's grip2, 0 once it has let go. */
    hold2: number;
  }
  const SWAP: readonly (readonly [number, number])[] = [[BONE.armBup, BONE.armFup], [BONE.armBlo, BONE.armFlo], [BONE.handB, BONE.handF]];

  /** 1 while the back hand holds the shaft, 0 once it has let go, easing between as the front
   *  hand's grip opens (the held item turning 5 to 35 degrees out of the hand: over 15 degrees the
   *  back forearm swung off the shaft faster than a real one in a knockout fall). */
  function shaftHold(pose: Pose, dress: Dress): number {
    if (dress.prop !== undefined) return 0;
    const u = (35 - Math.abs(pose.rot[BONE.held] ?? 0)) / 30;
    return u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  }
  function figure(pose: Pose, dress: Dress, at: Place): Fig {
    const build = pick(looks.builds, dress.look?.build);
    // A key's squash (`scale`) is drawn as the same size change both ways (its area): squashed
    // unevenly, a jointed body's limbs drawn across the squash came out up to 9% longer than
    // those along it, and a forearm stretched or shrank as it turned (owner: "dislocation of arms").
    const s = (dress.scale > 0 ? dress.scale : 1) * build.scale * squashOf(pose);
    const held = heldOf(dress);
    const backLeads = dress.lead === "B" && isPair(held);
    let rot = [...pose.rot];
    while (rot.length < model.def.bones.length) rot.push(0);
    if (backLeads) for (const [b, f] of SWAP) { const t = rot[b]!; rot[b] = rot[f]!; rot[f] = t; }
    const art = held === "fists" ? null : weaponArt(held);
    const free = [...rot];
    const hold = shaftHold(pose, dress);
    let hold2 = 0;
    if (art !== null && art.grip2 !== undefined && hold > 0) {
      // the back hand on the shaft: pinned by two-bone IK to grip2, turned along the item. The
      // item is drawn at its own size (itemStageXf), not at the body's, so grip2's offset from the
      // grip is turned into figure units by dividing out the body scale; pinning it in item units
      // put the back hand short of or past grip2 by (scale - 1) times that offset on any build
      // or size other than 1 (8% of it on the tall build).
      let fr0 = frames(model, rot, pose.root.x, pose.root.y);
      let wa0 = worldAngles(model, rot);
      let [wx, wy, handWorld] = backWrist(fr0, wa0, art, s, pose);
      // Both hands on one shaft, in every clip (animation pass, 16 Nov 2026). A clip keys the
      // front arm; where that puts grip2 out of the back arm's reach (a win with the weapon high,
      // a fall, a jump) or onto the back shoulder, the front hand is drawn in toward the back
      // shoulder (or out from it) just far enough, the item keeping its angle, so the back arm
      // holds it bent: a real fighter brings the shaft in to the body the same way. A pose that
      // already reaches is drawn exactly as keyed.
      const sh = fr0[BONE.armBup]!;
      const most = TWO_HAND_REACH * BACK_ARM;
      const least = TWO_HAND_FOLD * BACK_ARM;
      // how far the front hand would have to be drawn in or out (figure units): a little reads as
      // bringing the shaft to the body; far, the front arm would swing round fast to fetch it,
      // so past REACH_PULL the back hand lets go instead (eased, so the picture stays smooth)
      const need0 = Math.hypot(wx - sh.e, wy - sh.f);
      const need = need0 > most ? need0 - most : 0;
      let pulled = 0;
      for (let pass = 0; pass < 6; pass++) {
        const dist = Math.hypot(wx - sh.e, wy - sh.f);
        if (dist <= most + 1e-3 && dist >= least - 1e-3) break;
        const cap = dist < least ? FOLD_PULL : REACH_PULL[0];
        if (pulled >= cap - 1e-6) break;
        const hf = fr0[BONE.handF]!;
        let ux = dist > 1e-6 ? (wx - sh.e) / dist : hf.e - sh.e;
        let uy = dist > 1e-6 ? (wy - sh.f) / dist : hf.f - sh.f;
        const ul = Math.hypot(ux, uy) || 1;
        ux /= ul;
        uy /= ul;
        // the front hand is drawn in or out at most REACH_PULL[0] in all: past that the back hand
        // eases off instead (below), so the front arm never swings round to fetch the shaft
        const want = dist > most ? most - dist : least - dist;
        const move = Math.sign(want) * Math.min(Math.abs(want), cap - pulled);
        pulled += Math.abs(move);
        const keep = wa0[BONE.handF]!;
        rot = twoBone(model, rot, pose.root.x, pose.root.y, BONE.armFup, BONE.armFlo, BONE.handF,
          hf.e + ux * move, hf.f + uy * move, { maxReach: ANATOMY.reach }).rot;
        // the item keeps its angle as far as the front wrist bends; past that it turns with the arm
        const local = keep - worldAngles(model, rot)[BONE.armFlo]!;
        rot[BONE.handF] = local < ANATOMY.wrist[0] + 2 ? ANATOMY.wrist[0] + 2 : local > ANATOMY.wrist[1] - 2 ? ANATOMY.wrist[1] - 2 : local;
        fr0 = frames(model, rot, pose.root.x, pose.root.y);
        wa0 = worldAngles(model, rot);
        [wx, wy, handWorld] = backWrist(fr0, wa0, art, s, pose);
      }
      // Folded in further, grip2 passes close by the back shoulder, where a small shift of it
      // swings the whole back arm round (the elbow at its limit): the hand lets go over
      // FOLD_LET_GO of the arm's length instead of holding on into that.
      const fd = Math.hypot(wx - sh.e, wy - sh.f) / BACK_ARM;
      const f = (fd - FOLD_LET_GO[0]) / (FOLD_LET_GO[1] - FOLD_LET_GO[0]);
      const keepFold = f >= 1 ? 1 : f <= 0 ? 0 : f;
      // The back fist closes round the shaft where grip2 is; it need not cross the shaft square
      // (a shaft lies at a slant through a gripping hand), so the hand turns only as far as the
      // wrist bends (BACK_WRIST) and grip2 stays in the fist.
      const g = model.def.bones[BONE.held]!;
      const at = (a: number): [number, number] => [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)];
      const [c0, s0] = at(handWorld);
      const gx = wx + (c0 * g.x - s0 * g.y);
      const gy = wy + (s0 * g.x + c0 * g.y);
      let hb = handWorld;
      for (let pass = 0; pass < 4; pass++) {
        const [c, sn] = at(hb);
        rot = twoBone(model, rot, pose.root.x, pose.root.y, BONE.armBup, BONE.armBlo, BONE.handB, gx - (c * g.x - sn * g.y), gy - (sn * g.x + c * g.y), { maxReach: TWO_HAND_REACH }).rot;
        const fore = worldAngles(model, rot)[BONE.armBlo]!;
        let local = hb - fore;
        while (local > 180) local -= 360;
        while (local < -180) local += 360;
        const kept = local < BACK_WRIST[0] ? BACK_WRIST[0] : local > BACK_WRIST[1] ? BACK_WRIST[1] : local;
        hb = fore + kept;
        if (kept === local) break;
      }
      {
        const [c, sn] = at(hb);
        rot = twoBone(model, rot, pose.root.x, pose.root.y, BONE.armBup, BONE.armBlo, BONE.handB, gx - (c * g.x - sn * g.y), gy - (sn * g.x + c * g.y), { maxReach: TWO_HAND_REACH }).rot;
      }
      rot[BONE.handB] = hb - worldAngles(model, rot)[BONE.armBlo]!;
      // A back hand that could only stay on the item by turning a shoulder past a real one's
      // range (a tyre held up at the face, a shaft swung behind the head) lets go instead, easing
      // off over the last BACK_LET_GO degrees: a held arm never dislocates to keep its grip.
      // (the front arm too: the reach solve above may have drawn it in past its own range)
      const overOf = (a0: number): number => {
        // degrees outside the shoulder's range, measured round the circle the short way to its
        // nearer end (negative inside), so it never jumps where the angle wraps
        const [lo, hi] = ANATOMY.shoulder;
        let a = a0;
        while (a < lo) a += 360;
        while (a >= lo + 360) a -= 360;
        return a <= hi ? -Math.min(a - lo, hi - a) : Math.min(a - hi, lo + 360 - a);
      };
      const over = Math.max(overOf(rot[BONE.armBup]!), overOf(rot[BONE.armFup]!) - Math.max(0, overOf(free[BONE.armFup]!)));
      const u = (BACK_LET_GO[1] - over) / (BACK_LET_GO[1] - BACK_LET_GO[0]);
      const keep = u >= 1 ? 1 : u <= 0 ? 0 : u;
      const r = (REACH_PULL[1] - need) / (REACH_PULL[1] - REACH_PULL[0]);
      const keepR = r >= 1 ? 1 : r <= 0 ? 0 : r;
      const k = hold * keep * keepR * keepFold;
      hold2 = k;
      // letting go (a knockout fall drops the item): the arms ease from the shaft to their keys
      if (k < 1) rot = rot.map((v, i) => { let d = v - free[i]!; while (d > 180) d -= 360; while (d < -180) d += 360; return free[i]! + d * k; });
    }
    const fr = frames(model, rot, pose.root.x, pose.root.y);
    const wa = worldAngles(model, rot);
    const map: Xf = { a: at.facing * s, b: 0, c: 0, d: s, e: at.x, f: at.y };
    return { fr, wa, map, s, build, rot, held, art, backLeads, facing: at.facing, hold2 };
  }
  /** Where the back wrist must be (figure space) for the back hand to hold `grip2`, and the
   *  hand's world angle (both hands close round the shaft the same way). */
  function backWrist(fr0: Xf[], wa0: number[], art: WeaponArt, s: number, pose: Pose): [number, number, number] {
    const handWorld = wa0[BONE.held]!;
    const ia = (handWorld + art.grip.rot) * Math.PI / 180;
    const ox = art.grip2!.x - art.grip.x;
    const oy = art.grip2!.y - art.grip.y;
    void pose;
    const gx = fr0[BONE.held]!.e + (ox * Math.cos(ia) - oy * Math.sin(ia)) / s;
    const gy = fr0[BONE.held]!.f + (ox * Math.sin(ia) + oy * Math.cos(ia)) / s;
    const g = model.def.bones[BONE.held]!;
    const c = Math.cos(handWorld * Math.PI / 180);
    const sn = Math.sin(handWorld * Math.PI / 180);
    return [gx - (c * g.x - sn * g.y), gy - (sn * g.x + c * g.y), handWorld];
  }
  /** Stage point of a figure-space point. */
  const stageOf = (f: Fig, x: number, y: number): [number, number] => apply(f.map, x, y);
  /** The grip of a hand ("F" or "B") in figure space, and the angle an item in it points. */
  function gripOf(f: Fig, hand: "F" | "B", art: PropArt | null): { x: number; y: number; angle: number; frame: Xf } {
    const bone = hand === "F" ? BONE.held : BONE.handB;
    let frame = f.fr[bone]!;
    if (hand === "B") frame = mul(frame, moveXf(model.def.bones[BONE.held]!.x, model.def.bones[BONE.held]!.y));
    const angle = f.wa[hand === "F" ? BONE.held : BONE.handB]! + (art?.grip.rot ?? GRIP_ROT);
    return { x: frame.e, y: frame.f, angle, frame };
  }
  /** An item's frame on the stage: grip at the hand, own size, mirrored with the actor. */
  function itemStageXf(f: Fig, gx: number, gy: number, angle: number, art: PropArt): Xf {
    const [sx, sy] = stageOf(f, gx, gy);
    return mul(mul(mul({ a: f.facing, b: 0, c: 0, d: 1, e: sx, f: sy }, rotXf(angle)), moveXf(-art.grip.x, -art.grip.y)), IDENT);
  }
  const IDENT: Xf = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

  /** The striking end on the stage: the item's tip (with its links), or the leading fist. */
  function strikeEndStage(f: Fig, pose: Pose, clipName: string): [number, number] {
    const hand: "F" | "B" = f.backLeads ? "B" : "F";
    const thrown = clipName.startsWith("throw");
    if (thrown || f.art === null) {
      if (thrown) { const g = gripOf(f, hand, f.art); return stageOf(f, g.x, g.y); }
      const hb = hand === "F" ? BONE.handF : BONE.handB;
      const p = apply(f.fr[hb]!, KNUCKLES[0], KNUCKLES[1]);
      return stageOf(f, p[0], p[1]);
    }
    const g = gripOf(f, hand, f.art);
    const tip = tipOffset(f.art, g.angle, hand === "F" ? pose.trail : undefined);
    const [sx, sy] = stageOf(f, g.x, g.y);
    return [sx + f.facing * tip[0], sy + tip[1]];
  }
  /** Tip relative to the grip in stage units (facing +x), for an item at `angle`. */
  function tipOffset(art: WeaponArt, angle: number, trail: readonly number[] | undefined): [number, number] {
    if (art.segments !== undefined && art.segments.length > 0) {
      let x = 0;
      let y = 0;
      art.segments.forEach((sg, k) => {
        const a = (k === 0 || trail === undefined ? angle : (trail[k - 1] ?? angle - art.grip.rot) + art.grip.rot) * Math.PI / 180;
        x += sg.length * Math.cos(a);
        y += sg.length * Math.sin(a);
      });
      return [x, y];
    }
    const r = angle * Math.PI / 180;
    const dx = art.tip.x - art.grip.x;
    const dy = art.tip.y - art.grip.y;
    return [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)];
  }

  // ------------------------------------------------------------------- companion figures
  interface CFig { body: Body; art: CompanionArt; fr: Xf[]; map: Xf; s: number; hull: Body["hull"] }
  function cfigure(id: CompanionId, pose: Pose, dress: Dress, at: Place): CFig {
    const body = companionBody(id);
    const s = dress.scale > 0 ? dress.scale : 1;
    const fr = frames(body.model, pose.rot, pose.root.x, pose.root.y);
    return { body, art: companionArt(id), fr, s, hull: hullAt(body, pose.rot), map: { a: at.facing * s * pose.root.sx, b: 0, c: 0, d: s * pose.root.sy, e: at.x, f: at.y } };
  }
  /** The frontmost point of the head's shapes: the snout, the beak or the tusk. */
  function mouthOf(f: CFig): [number, number] {
    const hi = f.body.model.index.get("head") ?? Math.min(2, f.body.model.def.bones.length - 1);
    let best: [number, number] = [f.fr[hi]!.e, f.fr[hi]!.f];
    let bx = -Infinity;
    for (const p of f.hull[hi] ?? []) {
      const q = apply(f.fr[hi]!, p[0], p[1]);
      if (q[0] > bx) { bx = q[0]; best = q; }
    }
    return apply(f.map, best[0], best[1]);
  }
  function centreOf(f: CFig, bone: string, front: boolean): [number, number] {
    const i = f.body.model.index.get(bone) ?? 1;
    const pts = (f.hull[i] ?? []).map((p) => apply(f.fr[i]!, p[0], p[1]));
    if (pts.length === 0) return apply(f.map, f.fr[i]!.e, f.fr[i]!.f);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return apply(f.map, front ? (cx + Math.max(...xs)) / 2 : cx, cy);
  }

  // ------------------------------------------------------------------------------- aim
  const bendCache = new Map<string, BendAmount>();
  function strikeY(rig: RigId, clipName: string, pose: Pose, dress: Dress): number {
    if (isCompanion(rig)) return mouthOf(cfigure(rig, pose, dress, HOME))[1];
    return strikeEndStage(figure(pose, dress, HOME), pose, clipName)[1];
  }
  function bendFor(rig: RigId, name: string, c: Clip, aim: Aim): BendAmount | null {
    const tc = c.events.find((e) => e.name === "contact")?.t;
    if (tc === undefined || !Number.isFinite(aim.y)) return null;
    const d = aim.dress;
    const key = `${rig}|${name}|${d.held ?? "fists"}|${d.scale}|${d.look?.build ?? 0}|${d.lead ?? "F"}|${aim.y}`;
    const hit = bendCache.get(key);
    if (hit !== undefined) return hit;
    const body = bodyOf(rig);
    const err = (theta: number): number => strikeY(rig, name, poseAt(body, c, tc, { theta, lift: 0 }), d) - aim.y;
    const [lo, hi] = isCompanion(rig) ? [-10, 80] : [-90, 120];
    let best = 0;
    let bestErr = err(0);
    let bracket: [number, number, number] | null = null;
    let prevT = lo;
    let prevE = err(lo);
    if (Math.abs(prevE) < Math.abs(bestErr)) { best = lo; bestErr = prevE; }
    for (let th = lo + 5; th <= hi; th += 5) {
      const e = err(th);
      if (Math.abs(e) < Math.abs(bestErr) || (Math.abs(e) === Math.abs(bestErr) && Math.abs(th) < Math.abs(best))) { best = th; bestErr = e; }
      if ((prevE <= 0 && e >= 0) || (prevE >= 0 && e <= 0)) {
        const mid = Math.abs((prevT + th) / 2);
        if (bracket === null || mid < bracket[2]) bracket = [prevT, th, mid];
      }
      prevT = th;
      prevE = e;
    }
    if (bracket !== null) {
      let [a, b] = bracket;
      let ea = err(a);
      for (let n = 0; n < 40; n++) {
        const m = (a + b) / 2;
        const em = err(m);
        if ((ea <= 0 && em <= 0) || (ea >= 0 && em >= 0)) { a = m; ea = em; } else b = m;
      }
      best = (a + b) / 2;
      bestErr = err(best);
    }
    let bend: BendAmount = { theta: best, lift: 0 };
    if (bestErr > 0) {
      // still below the target: hop up the rest (pose units are stage units / body scale)
      const build = pick(looks.builds, d.look?.build);
      const s = (d.scale > 0 ? d.scale : 1) * (isCompanion(rig) ? 1 : build.scale);
      bend = { theta: best, lift: -bestErr / s };
      for (let n = 0; n < 3; n++) {
        const e = err2(bend);
        if (Math.abs(e) < 0.05) break;
        bend = { theta: best, lift: bend.lift - e / s };
      }
    }
    if (bendCache.size > 6000) bendCache.clear();
    bendCache.set(key, bend);
    return bend;

    function err2(b: BendAmount): number { return strikeY(rig, name, poseAt(body, c, tc!, b), d) - aim.y; }
  }

  function samplePose(rig: RigId, clipName: string, tMs: number, aim?: Aim): Pose {
    const c = findClip(rig, clipName, aim === undefined ? undefined : aim.dress.held);
    const bend = aim === undefined ? null : bendFor(rig, clipName, c, aim);
    return poseAt(bodyOf(rig), c, tMs, bend);
  }
  function clipInfo(rig: RigId, clipName: string): ClipInfo {
    const c = findClip(rig, clipName);
    return { durationMs: c.duration, loop: c.loop, events: c.events };
  }

  // ---------------------------------------------------------------------------- colours
  const lookColours = (look: Look | undefined): SlotColours => ({
    skin: pick(looks.skin.length > 0 ? looks.skin : SKIN, look?.skin),
    hair: pick(looks.hairColor.length > 0 ? looks.hairColor : HAIR_COLOUR, look?.hairColor),
    palette: pick(looks.palettes.length > 0 ? looks.palettes : PALETTES, look?.palette),
  });

  // ------------------------------------------------------------------------------- draw
  function shadow(env: DrawEnv, x: number, y: number, rx: number, lift: number): void {
    const c = env.ctx;
    const k = 1 - Math.min(lift, 60) / 90;
    c.save();
    c.globalAlpha = c.globalAlpha * 0.62;
    c.fillStyle = GROUND_SHADOW;
    c.beginPath();
    c.ellipse(x, y + 0.6, rx * k, rx * 0.2 * k, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function itemPaints(art: PropArt, xf: Xf, z: number, colours: SlotColours, trail: readonly number[] | undefined, f: Fig | null, gx: number, gy: number, angle: number): Paint[] {
    const out: Paint[] = [];
    const add = (s: Omit<Shape, "bone">, m: Xf, zz: number): void => {
      const lit = slotColour(s.slot, colours);
      const p: Paint = { d: s.d, z: zz, xf: m, lit, shade: shadeOf(lit), ink: s.slot === "ink", line: LINE.item };
      if (s.shade !== undefined) p.extra = s.shade;
      out.push(p);
    };
    const w = art as WeaponArt;
    if (w.segments !== undefined && w.segments.length > 0 && f !== null) {
      let x = gx;
      let y = gy;
      w.segments.forEach((sg, k) => {
        const a = k === 0 || trail === undefined ? angle : (trail[k - 1] ?? angle - art.grip.rot) + art.grip.rot;
        const m = itemStageXf(f, x, y, a, { ...art, grip: { x: 0, y: 0, rot: 0 } });
        for (const s of sg.shapes) add(s, m, z + 0.001 * k + s.z * 0.0001);
        const r = a * Math.PI / 180;
        x += (sg.length * Math.cos(r)) / f.s;
        y += (sg.length * Math.sin(r)) / f.s;
      });
      return out;
    }
    for (const s of art.shapes) add(s, xf, z + s.z * 0.01);
    return out;
  }

  function drawScrapper(env: DrawEnv, pose: Pose, dress: Dress, at: Place): void {
    const f = figure(pose, dress, at);
    // ground shadow between the feet
    const fa = stageOf(f, f.fr[BONE.footF]!.e, 0);
    const fb = stageOf(f, f.fr[BONE.footB]!.e, 0);
    shadow(env, (fa[0] + fb[0]) / 2 + f.facing * 2 * f.s, at.y, (Math.abs(fa[0] - fb[0]) / 2 + 11 * f.s), pose.lift);
    const parts = scrapperParts(f, pose, dress);
    if (dress.tint === "white") for (const p of parts) p.veil = false;
    paintParts(env, parts, dress.tint === "white");
  }
  /** Every part of a scrapper as it is painted, each tagged with its bone ("armF.lo") or what it
   *  is ("item:F", "item:B", "shield", "prop"): the one list `drawScrapper` paints and the
   *  drawn-geometry test measures. */
  function scrapperParts(f: Fig, pose: Pose, dress: Dress): Paint[] {
    const look = dress.look;
    const colours = lookColours(look);
    const parts: Paint[] = [];
    const released = Math.abs(f.rot[BONE.held] ?? 0) > 30;
    const dazed = pose.face === "dazed";
    const frontEmpty = f.art === null || released;
    const backHolds = f.art?.grip2 !== undefined || (f.art !== null && isPair(f.held)) || dress.prop !== undefined;
    const openF = frontEmpty && (dazed || released) && !(f.held === "fists" && !dazed);
    const openB = !backHolds && dazed;
    const faces = pick(looks.faces, look?.face);
    const shapes: Shape[] = [
      ...pick(looks.heads, look?.head), ...pick(looks.hair, look?.hair), ...(faces[pose.face as FaceId] ?? faces.neutral),
      ...pick(looks.tops, look?.top), ...pick(looks.bottoms, look?.bottom), ...pick(looks.shoes, look?.shoes),
      ...pick(looks.accessories, look?.accessory), ...looks.hands,
    ];
    for (const sh of shapes) {
      const open = sh.bone.endsWith(":open");
      const boneId = open ? sh.bone.slice(0, -5) : sh.bone;
      if (boneId === "handF" && open !== openF) continue;
      if (boneId === "handB" && open !== openB) continue;
      // with the back hand leading, the hands swap places in depth too
      const bi = model.index.get(boneId);
      if (bi === undefined) continue;
      let z = sh.z;
      if (f.backLeads) {
        if (boneId === "handF") z = sh.z - 40; else if (boneId === "handB") z = sh.z + 40;
        if (boneId.startsWith("armF")) z = sh.z - 40; else if (boneId.startsWith("armB")) z = sh.z + 40;
      }
      const kx = LIMB_BONES.has(boneId) ? f.build.limb : TRUNK_BONES.has(boneId) ? f.build.torso : 1;
      const xf = mul(mul(f.map, f.fr[bi]!), scaleXf(kx, 1));
      const lit = slotColour(sh.slot, colours);
      const side = boneId.startsWith("arm") || boneId.startsWith("leg") ? boneId[3] : boneId.startsWith("hand") || boneId.startsWith("foot") ? boneId[4] : null;
      const isArm = boneId.startsWith("arm") || boneId.startsWith("hand");
      const veil = side !== null && side === (isArm && f.backLeads ? "F" : "B");
      const p: Paint = { d: sh.d, z, xf, lit, shade: shadeOf(lit), ink: sh.slot === "ink", veil, tag: boneId, kx };
      if (sh.shade !== undefined) p.extra = sh.shade;
      parts.push(p);
    }
    // what the hands hold
    if (f.art !== null) {
      const lead: "F" | "B" = f.backLeads ? "B" : "F";
      const g = gripOf(f, lead, f.art);
      const zLead = lead === "F" ? 61 : 61;
      const xl = itemStageXf(f, g.x, g.y, g.angle, f.art);
      parts.push(...tagged(itemPaints(f.art, xl, zLead, colours, pose.trail, f, g.x, g.y, g.angle), `item:${lead}`, xl));
      if (isPair(f.held) || f.art.offhand === true) {
        const other: "F" | "B" = lead === "F" ? "B" : "F";
        const g2 = gripOf(f, other, f.art);
        const xo = itemStageXf(f, g2.x, g2.y, g2.angle, f.art);
        parts.push(...tagged(itemPaints(f.art, xo, 21, colours, undefined, null, 0, 0, 0), `item:${other}`, xo));
      }
    }
    if (dress.shield !== null && dress.shield !== undefined) {
      const art = shieldArt(dress.shield);
      const wrist = f.fr[BONE.handB]!;
      const angle = f.wa[BONE.armBlo]! + art.grip.rot;
      const xs = itemStageXf(f, wrist.e, wrist.f, angle, art);
      parts.push(...tagged(itemPaints(art, xs, 23, colours, undefined, null, 0, 0, 0), "shield", xs));
    }
    if (dress.prop !== undefined) {
      const prop = content?.props?.[dress.prop];
      if (prop === undefined) warnOnce(`prop:${dress.prop}`, `no art for the Move prop "${dress.prop}"`);
      else {
        const g = gripOf(f, f.backLeads ? "F" : "B", prop);
        const xp = itemStageXf(f, g.x, g.y, g.angle, prop);
        parts.push(...tagged(itemPaints(prop, xp, 21.5, colours, undefined, null, 0, 0, 0), "prop", xp));
      }
    }
    return parts;
  }
  /** Tags an item's paints; `item` is the frame the item's own drawing (grip, grip2) is in. */
  function tagged(ps: Paint[], tag: string, item: Xf): Paint[] {
    for (const p of ps) { p.tag = tag; p.item = item; }
    return ps;
  }

  function companionColours(id: CompanionId): SlotColours {
    const c = COMPANION_COLOURS[id];
    return { skin: c.body, hair: c.dark, palette: { top: c.body, bottom: c.dark, shoes: c.dark, accent: c.light } };
  }
  function drawCompanion(env: DrawEnv, id: CompanionId, pose: Pose, dress: Dress, at: Place): void {
    const f = cfigure(id, pose, dress, at);
    const colours = companionColours(id);
    const pts = f.hull.flatMap((h, i) => h.map((p) => apply(f.fr[i]!, p[0], p[1])));
    const xs = pts.map((p) => p[0]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const [cx] = apply(f.map, (x0 + x1) / 2, 0);
    shadow(env, cx, at.y, ((x1 - x0) / 2 + 3) * f.s, pose.lift);
    const parts: Paint[] = [];
    // a pet's ink outline: its art's own weight (thinner for a small animal), times its scale
    const line = ((f.art as { line?: number }).line ?? LINE.figure) * f.s;
    const frame = frameAt(f.body, pose.rot);
    for (const sh of f.art.shapes) {
      const [bone, n] = frameOf(sh.bone);
      const bi = f.body.model.index.get(bone);
      if (bi === undefined || (n !== undefined && n !== frame)) continue;
      const lit = sh.slot === "white" ? FIXED.white : slotColour(sh.slot, colours);
      const p: Paint = { d: sh.d, z: sh.z, xf: mul(f.map, f.fr[bi]!), lit, shade: shadeOf(lit), ink: sh.slot === "ink", line };
      if (sh.shade !== undefined) p.extra = sh.shade;
      parts.push(p);
    }
    paintParts(env, parts, dress.tint === "white");
  }

  function drawActor(env: DrawEnv, pose: Pose, dress: Dress, at: Place): void {
    if (pose.rig === "scrapper") drawScrapper(env, pose, dress, at);
    else drawCompanion(env, pose.rig, pose, dress, at);
  }

  function handAnchor(pose: Pose, dress: Dress, at: Place): { x: number; y: number; rot: number } {
    if (pose.rig !== "scrapper") {
      const [x, y] = mouthOf(cfigure(pose.rig, pose, dress, at));
      return { x, y, rot: 0 };
    }
    const f = figure(pose, dress, at);
    const g = gripOf(f, f.backLeads ? "B" : "F", f.art);
    const [x, y] = stageOf(f, g.x, g.y);
    return { x, y, rot: g.angle };
  }

  function strikePoint(rig: RigId, clipName: string, dress: Dress, aimY?: number): Offset {
    const info = clipInfo(rig, clipName);
    const t = strikeTime(info) ?? 0;
    const pose = aimY === undefined ? poseAt(bodyOf(rig), findClip(rig, clipName, dress.held), t, null)
      : samplePose(rig, clipName, t, { y: aimY, dress });
    if (isCompanion(rig)) { const [x, y] = mouthOf(cfigure(rig, pose, dress, HOME)); return { x, y }; }
    const [x, y] = strikeEndStage(figure(pose, dress, HOME), pose, clipName);
    return { x, y };
  }

  function hitPoint(rig: RigId, dress: Dress, zone: "head" | "body"): Offset {
    const pose = samplePose(rig, "idle", 0);
    if (isCompanion(rig)) {
      const f = cfigure(rig, pose, dress, HOME);
      const [x, y] = zone === "head" ? centreOf(f, "head", false) : centreOf(f, "body", true);
      return { x, y };
    }
    const f = figure(pose, dress, HOME);
    const p = zone === "head" ? apply(f.fr[BONE.head]!, HEAD_CENTRE[0], HEAD_CENTRE[1]) : apply(f.fr[BONE.torso]!, BODY_CENTRE[0], BODY_CENTRE[1]);
    const [x, y] = stageOf(f, p[0], p[1]);
    return { x, y };
  }

  function drawProp(env: DrawEnv, item: PropId, at: Place & { rot: number }): void {
    const art: WeaponArt = isShieldId(item) ? shieldArt(item) : weaponArt(item);
    const colours = lookColours(undefined);
    const xf = mul(mul({ a: at.facing, b: 0, c: 0, d: 1, e: at.x, f: at.y }, rotXf(at.rot)), moveXf(-art.grip.x, -art.grip.y));
    if (art.segments !== undefined && art.segments.length > 0) {
      // a weapon that bends lies straight when no hand holds it
      const parts: Paint[] = [];
      let x = 0;
      art.segments.forEach((sg, k) => {
        const m = mul(mul({ a: at.facing, b: 0, c: 0, d: 1, e: at.x, f: at.y }, rotXf(at.rot)), moveXf(x, 0));
        for (const s of sg.shapes) {
          const lit = slotColour(s.slot, colours);
          parts.push({ d: s.d, z: 1 + k * 0.01, xf: m, lit, shade: shadeOf(lit), ink: s.slot === "ink", line: LINE.item });
        }
        x += sg.length;
      });
      paintParts(env, parts, false);
      return;
    }
    paintParts(env, itemPaints(art, xf, 1, colours, undefined, null, 0, 0, 0), false);
  }

  const stages: Partial<Record<StageId, StageDraw>> = { ...(content?.stages ?? {}), yard: gate.stages.yard };
  function drawStage(env: DrawEnv, stage: StageId, layer: "back" | "floor", crowdBounce: number): void {
    const own = stages[stage];
    if (own === undefined) {
      warnOnce(`stage:${String(stage)}`, `no arena art for "${String(stage)}", drawing the yard`);
      gate.stages.yard(env, layer, crowdBounce);
      return;
    }
    own(env, layer, crowdBounce);
  }

  const fx: Partial<Record<FxKind, FxDraw>> = { ...gate.fx, ...(content?.fx ?? {}) };
  function drawFx(env: DrawEnv, kind: FxKind, progress: number, at: Place, seed: number): void {
    const draw = fx[kind];
    if (draw === undefined || (gateOnly && !GATE_FX.has(kind))) {
      warnOnce(`fx:${String(kind)}`, `no effect art for "${String(kind)}"`);
      return;
    }
    env.ctx.save();
    draw(env, progress < 0 ? 0 : progress > 1 ? 1 : progress, at, seed);
    env.ctx.restore();
  }

  function portrait(look: Look): SvgArt { return portraitArt(looks, look, gate.scrapper, findClip("scrapper", "idle")); }
  function companionPortrait(id: CompanionId): SvgArt { return companionPortraitArt(id, companionArt(id), companionColours(id)); }
  function icon(ref: IconRef): SvgArt {
    const icons = { ...gate.icons, ...(content?.icons ?? {}) } as Record<string, IconArt | undefined>;
    const own = icons[ref];
    if (own !== undefined) return iconArt(own, ref);
    if (ref === "fists" || (WEAPON_META as Record<string, unknown>)[ref] !== undefined) {
      const id = ref as HeldId;
      return iconArt(null, ref, weaponArt(id));
    }
    if (isCompanion(ref as RigId)) return companionPortrait(ref as CompanionId);
    return iconArt(null, ref);
  }

  const inspect: RigInspect = {
    joints(pose, dress, at) {
      if (pose.rig !== "scrapper") { const f = cfigure(pose.rig, pose, dress, at); return f.fr.map((x) => apply(f.map, x.e, x.f)); }
      const f = figure(pose, dress, at);
      return f.fr.map((x) => stageOf(f, x.e, x.f));
    },
    strikeEnd(pose, dress, at, clipName) {
      if (pose.rig !== "scrapper") return mouthOf(cfigure(pose.rig, pose, dress, at));
      return strikeEndStage(figure(pose, dress, at), pose, clipName);
    },
    backGrip(pose, dress, at) {
      const f = figure(pose, dress, at);
      const g = gripOf(f, "B", f.art);
      return stageOf(f, g.x, g.y);
    },
    backPinError(pose, dress) {
      const f = figure(pose, dress, HOME);
      if (f.art?.grip2 === undefined || f.hold2 < 1) return 0;
      const g = gripOf(f, f.backLeads ? "B" : "F", f.art);
      const [ax, ay] = stageOf(f, g.x, g.y);
      const r = (g.angle * Math.PI) / 180;
      const ox = f.art.grip2.x - f.art.grip.x;
      const oy = f.art.grip2.y - f.art.grip.y;
      const b = gripOf(f, "B", f.art);
      const [bx, by] = stageOf(f, b.x, b.y);
      return Math.hypot(bx - (ax + ox * Math.cos(r) - oy * Math.sin(r)), by - (ay + ox * Math.sin(r) + oy * Math.cos(r)));
    },
    backReach(pose, dress) {
      const f = figure(pose, dress, HOME);
      if (f.art?.grip2 === undefined || f.hold2 < 1) return null;
      const sh = f.fr[BONE.armBup]!;
      const wr = f.fr[BONE.handB]!;
      const fr0 = frames(model, pose.rot, pose.root.x, pose.root.y);
      const w = backWrist(fr0, worldAngles(model, pose.rot), f.art, f.s, pose);
      const sh0 = fr0[BONE.armBup]!;
      return { drawn: Math.hypot(wr.e - sh.e, wr.f - sh.f) / BACK_ARM, want: Math.hypot(w[0] - sh0.e, w[1] - sh0.f) / BACK_ARM };
    },
    figureRot(pose, dress) { return figure(pose, dress, HOME).rot; },
    backHold(pose, dress) { return figure(pose, dress, HOME).hold2; },
    parts(pose, dress, at) {
      if (pose.rig !== "scrapper") return [];
      const f = figure(pose, dress, at);
      return scrapperParts(f, pose, dress);
    },
    held(dress) { const h = dress.held ?? "fists"; return h === "fists" ? null : weaponArt(h); },
    shield(dress) { return dress.shield === null || dress.shield === undefined ? null : shieldArt(dress.shield); },
    lowest(pose, bones) {
      const body = bodyOf(pose.rig);
      const fr = frames(body.model, pose.rot, pose.root.x, pose.root.y);
      let low = -Infinity;
      body.model.def.bones.forEach((b, i) => {
        if (bones !== undefined && !bones.includes(b.id)) return;
        for (const p of hullAt(body, pose.rot)[i] ?? []) { const y = apply(fr[i]!, p[0], p[1])[1]; if (y > low) low = y; }
      });
      return low;
    },
    rigDef(rig) { return bodyOf(rig).model.def; },
    clip(rig, name, held) { return findClip(rig, name, held); },
  };
  const rig: Rig & { inspect: RigInspect } = { clipInfo, samplePose, drawActor, handAnchor, drawProp, drawStage, strikePoint, hitPoint, drawFx, portrait, companionPortrait, icon, inspect,
    attackClip: (held, base) => attackClip(held, base) };
  return rig;
};

/** Measuring hooks for the rig lane's tests and tools (not part of the contract). Every point is
 *  from the same maths `drawActor` draws with. */
export interface RigInspect {
  /** Every bone's joint on the stage. */
  joints(pose: Pose, dress: Dress, at: Place): [number, number][];
  /** The striking end on the stage for this pose (tip, fist, mouth; the hand for "throw"). */
  strikeEnd(pose: Pose, dress: Dress, at: Place, clip: string): [number, number];
  /** The back hand's grip point on the stage. */
  backGrip(pose: Pose, dress: Dress, at: Place): [number, number];
  /** Distance from the drawn back grip to the weapon's `grip2`, facing +x (0 without one, or
   *  when the back hand is not meant to hold it: the item let go, a Move prop in that hand). */
  backPinError(pose: Pose, dress: Dress): number;
  /** For a two-hand item held on its shaft: the drawn back arm's reach (shoulder to wrist over
   *  the arm's length, figure units, so no squash or size counts) and the reach the pose as keyed
   *  would need for the back hand to hold grip2 (before the two-hand solve). Null otherwise. */
  backReach(pose: Pose, dress: Dress): { drawn: number; want: number } | null;
  /** The bone angles as drawn for this dress (the lead swap, the two-hand solve). */
  figureRot(pose: Pose, dress: Dress): number[];
  /** 1 while the back hand holds a two-hand item's grip2, easing to 0 as it lets go. */
  backHold(pose: Pose, dress: Dress): number;
  /** Every part as `drawActor` paints it, tagged with its bone or item (see `Paint.tag`). */
  parts(pose: Pose, dress: Dress, at: Place): Paint[];
  /** The art of the held item and of the shield (null for fists, no shield). */
  held(dress: Dress): WeaponArt | null;
  shield(dress: Dress): WeaponArt | null;
  /** The lowest point (largest y, figure units, 0 = the floor) of these bones, or of all. */
  lowest(pose: Pose, bones?: readonly string[]): number;
  rigDef(rig: RigId): RigDef;
  clip(rig: RigId, name: string, held?: HeldId | null): Clip;
}
export function inspectOf(rig: Rig): RigInspect {
  const i = (rig as Rig & { inspect?: RigInspect }).inspect;
  if (i === undefined) throw new Error("not a rig made by createRig");
  return i;
}

/** For tests and tools: a rig's raw keyed pose (no aim, no feet). */
export { sampleRaw, clipTime };
export type { ContentClip, CompanionClip, RigDef };
