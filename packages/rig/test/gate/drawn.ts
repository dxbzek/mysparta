/**
 * The drawn picture, measured (owner, 16 Nov 2026: "Dislocation of arms"). Every number here is
 * read from the part list `drawActor` paints (`inspect.parts`): each part's own polygon put on the
 * stage by the transform it is painted with. Nothing is read from bone angles, so a hand drawn
 * off its wrist, a forearm drawn short or a joint whose pieces open at a strong angle all show.
 *
 * Per frame:
 *  - apart:  the drawn end of a part against the drawn start of the part hung on it (shoulder,
 *            elbow, wrist, hip, knee, ankle), and the hand's fist centre against the grip of
 *            the item it holds (front item, back hand on grip2, the off-hand item of a pair,
 *            the shield strap on the back wrist, a Move prop in the back hand);
 *  - open:   how far a ring round each joint (80% of the narrower piece's half width) is
 *            outside both pieces: a joint whose pieces leave a notch at a strong bend;
 *  - length: each limb bone drawn (joint to joint) over its rest length times the body size;
 *  - socket: an upper arm's root outside the drawn torso, a thigh's outside the pelvis.
 * Used by `drawn.test.ts` and by the before/after print (`drawn-audit.ts`).
 */
import type { HeldId, ShieldId } from "@rankzero/core";
import { WEAPON_META } from "@rankzero/core";
import type { Dress, MoveProp, Place, Pose, Rig } from "../../src/contracts";
import type { RigInspect } from "../../src/engine/createRig";
import { inspectOf } from "../../src/engine/createRig";
import type { Paint } from "../../src/engine/draw";
import { artOf } from "../../src/engine/draw";
import type { Xf } from "../../src/engine/pose";
import { apply } from "../../src/engine/pose";
import { ANATOMY, BUILDS, PROPORTION as P } from "../../src/gate/skeleton";

type Pt = readonly [number, number];
export const LIMITS = { apart: 0.5, open: 0.5, length: 0.02, grip: 1, bend: 3, turn: ANATOMY.turnPerFrame } as const;

/** The joints: the parent part, the child part, and where on the parent bone the child hangs. */
export const JOINTS: readonly { name: string; parent: string; child: string; at: Pt }[] = [
  ...(["F", "B"] as const).flatMap((s) => [
    { name: `shoulder${s}`, parent: "torso", child: `arm${s}.up`, at: s === "F" ? P.shoulderF : P.shoulderB },
    { name: `elbow${s}`, parent: `arm${s}.up`, child: `arm${s}.lo`, at: [0, P.upperArm] as Pt },
    { name: `wrist${s}`, parent: `arm${s}.lo`, child: `hand${s}`, at: [0, P.forearm] as Pt },
    { name: `hip${s}`, parent: "pelvis", child: `leg${s}.up`, at: s === "F" ? P.hipF : P.hipB },
    { name: `knee${s}`, parent: `leg${s}.up`, child: `leg${s}.lo`, at: [0, P.thigh] as Pt },
    { name: `ankle${s}`, parent: `leg${s}.lo`, child: `foot${s}`, at: [0, P.shin] as Pt },
  ]),
];
/** Bones measured for length: the bone, the part whose start is its far end, the rest length. */
const LENGTHS: readonly { bone: string; end: string | "grip"; rest: number }[] = (["F", "B"] as const).flatMap((s) => [
  { bone: `arm${s}.up`, end: `arm${s}.lo`, rest: P.upperArm },
  { bone: `arm${s}.lo`, end: `hand${s}`, rest: P.forearm },
  { bone: `leg${s}.up`, end: `leg${s}.lo`, rest: P.thigh },
  { bone: `leg${s}.lo`, end: `foot${s}`, rest: P.shin },
]);

export type Kind = "apart" | "open" | "length" | "socket" | "grip" | "bend" | "turn" | "hand";
export interface Fault { kind: Kind; where: string; value: number }
export interface Drawn { apart: number; open: number; length: number; socket: number; grip: number; bend: number; turn: number; hand: number;
  faults: Fault[];
  /** World angle of each drawn arm part (figure space, facing +x), for the turn per frame. */
  angles: Record<string, number> }

/** The world angle a part's bone is drawn at (figure space: unmirrored, 0 = hanging down). */
export function drawnAngle(p: Paint, facing: 1 | -1): number {
  return (Math.atan2(-facing * p.xf.c, p.xf.d) * 180) / Math.PI;
}
const wrapTo = (a: number, lo: number): number => ((((a - lo) % 360) + 360) % 360) + lo;
/** Degrees outside [lo, hi]. */
const past = (a: number, lo: number, hi: number): number => (a < lo ? lo - a : a > hi ? a - hi : 0);

function inside(p: Pt, poly: readonly Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function edgeDist(p: Pt, poly: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j]!;
    const b = poly[i]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy || 1e-9;
    let u = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    best = Math.min(best, Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy));
  }
  return best;
}
/** Distance from a point to a set of polygons (0 inside any). */
export function distTo(p: Pt, polys: readonly (readonly Pt[])[]): number {
  let best = Infinity;
  for (const q of polys) {
    if (q.length < 3) continue;
    if (inside(p, q)) return 0;
    best = Math.min(best, edgeDist(p, q));
  }
  return best;
}
const stagePolys = (ps: readonly Paint[]): Pt[][] =>
  ps.flatMap((p) => artOf(p.d).polys.map((poly) => poly.map(([x, y]) => apply(p.xf, x, y) as Pt)));
/** A point of a bone's own frame (unscaled) on the stage, through a part painted on that bone. */
const onBone = (p: Paint, x: number, y: number): Pt => apply(p.xf, x / (p.kx ?? 1), y);
/** Half width of a part at a point of its bone (drawn): the distance from the point along the
 *  bone's own x axis, both ways, to the edge of its polygons; the smaller side. */
function halfWidth(ps: readonly Paint[], x: number, y: number): number {
  const p0 = ps[0]!;
  const o = onBone(p0, x, y);
  const ax = onBone(p0, x + 1, y);
  const ux = ax[0] - o[0];
  const uy = ax[1] - o[1];
  const l = Math.hypot(ux, uy) || 1;
  const polys = stagePolys(ps);
  let w = Infinity;
  for (const dir of [1, -1]) {
    let d = 0;
    while (d < 12 && distTo([o[0] + (dir * ux * d) / l, o[1] + (dir * uy * d) / l], polys) === 0) d += 0.05;
    w = Math.min(w, d);
  }
  return w;
}

export interface Item { held: HeldId; shield?: ShieldId; prop?: MoveProp; lead?: "F" | "B" }

/** One drawn frame. `s` is the body size (dress scale times build scale). */
export function measureDrawn(ins: RigInspect, pose: Pose, dress: Dress, at: Place, s: number, ring = 16): Drawn {
  return measureParts(ins, ins.parts(pose, dress, at), pose, dress, at, s, ring);
}
/** The same measures on a given part list (a planted fault edits the list `inspect.parts` gave). */
export function measureParts(ins: RigInspect, parts: readonly Paint[], pose: Pose, dress: Dress, at: Place, s: number, ring = 16): Drawn {
  const byTag = new Map<string, Paint[]>();
  for (const p of parts) {
    if (p.tag === undefined || p.ink) continue;
    const list = byTag.get(p.tag) ?? [];
    list.push(p);
    byTag.set(p.tag, list);
  }
  const faults: Fault[] = [];
  const out: Drawn = { apart: 0, open: 0, length: 0, socket: 0, grip: 0, bend: 0, turn: 0, hand: 0, faults, angles: {} };
  const note = (kind: Exclude<Kind, "turn">, where: string, value: number, limit: number): void => {
    if (value > out[kind]) out[kind] = value;
    if (value > limit) faults.push({ kind, where, value });
  };
  // the bends as drawn: shoulder, elbow, wrist against a real arm's range (ANATOMY)
  const ang = (tag: string): number | undefined => { const p = byTag.get(tag)?.[0]; return p === undefined ? undefined : drawnAngle(p, at.facing); };
  const torsoA = ang("torso");
  for (const s2 of ["F", "B"] as const) {
    const up = ang(`arm${s2}.up`);
    const lo = ang(`arm${s2}.lo`);
    const hand = ang(`hand${s2}`);
    if (torsoA === undefined || up === undefined || lo === undefined || hand === undefined) continue;
    out.angles[`up${s2}`] = up;
    out.angles[`lo${s2}`] = lo;
    out.angles[`hand${s2}`] = hand;
    note("bend", `shoulder${s2}`, past(wrapTo(up - torsoA, -200), ANATOMY.shoulder[0], ANATOMY.shoulder[1]), LIMITS.bend);
    note("bend", `elbow${s2}`, past(wrapTo(lo - up, -180), -160, 2), LIMITS.bend);
    note("bend", `wrist${s2}`, past(wrapTo(hand - lo, -180), ANATOMY.wrist[0], ANATOMY.wrist[1]), LIMITS.bend);
  }
  const start = (tag: string): Pt => { const p = byTag.get(tag)![0]!; return onBone(p, 0, 0); };
  for (const j of JOINTS) {
    const par = byTag.get(j.parent);
    const ch = byTag.get(j.child);
    if (par === undefined || ch === undefined) continue;
    const end = onBone(par[0]!, j.at[0], j.at[1]);
    const st = start(j.child);
    note("apart", j.name, Math.hypot(end[0] - st[0], end[1] - st[1]), LIMITS.apart);
    // the ring round the joint: 80% of the narrower piece's half width there
    // (both widths are read a little way in from the pin, so a piece cut flat at it still has one)
    const r = 0.8 * Math.min(halfWidth(par, j.at[0], j.at[1] - 1.5), halfWidth(ch, 0, 1.5));
    const polys = [...stagePolys(par), ...stagePolys(ch)];
    let open = 0;
    for (let k = 0; k < ring; k++) {
      const a = (2 * Math.PI * k) / ring;
      open = Math.max(open, distTo([st[0] + r * Math.cos(a), st[1] + r * Math.sin(a)], polys));
    }
    note("open", j.name, open, LIMITS.open);
  }
  for (const l of LENGTHS) {
    const a = byTag.get(l.bone);
    const b = byTag.get(l.end);
    if (a === undefined || b === undefined) continue;
    const p = start(l.bone);
    const q = start(l.end);
    note("length", l.bone, Math.abs(Math.hypot(q[0] - p[0], q[1] - p[1]) / (l.rest * s) - 1), LIMITS.length);
  }
  const torso = byTag.get("torso");
  const pelvis = byTag.get("pelvis");
  for (const s2 of ["F", "B"] as const) {
    if (torso !== undefined && byTag.has(`arm${s2}.up`)) note("socket", `shoulder${s2}`, distTo(start(`arm${s2}.up`), stagePolys(torso)), 0);
    if (pelvis !== undefined && byTag.has(`leg${s2}.up`)) note("socket", `hip${s2}`, distTo(start(`leg${s2}.up`), stagePolys(pelvis)), 0);
  }
  // hands on what they hold
  const fist = (side: "F" | "B"): Pt => onBone(byTag.get(`hand${side}`)![0]!, 0, P.grip);
  const art = ins.held(dress);
  const lead: "F" | "B" = dress.lead === "B" && dress.held !== null && WEAPON_META[dress.held as Exclude<HeldId, "fists">]?.pair === true ? "B" : "F";
  // the right hand: the item in the leading (front) hand, a second one only for a pair or an
  // off-hand item, the shield on the back forearm (checked by its strap below)
  // put away for a Move reaction (`STOW`): drawn at the hip, on the back or on the floor, no hand holds it
  const stowed = [...byTag.keys()].some((t) => t.startsWith("stowed:"));
  if (art !== null && stowed) {
    if (byTag.has("item:F") || byTag.has("item:B")) note("hand", "item in a hand while put away", 1, 0);
  } else if (art !== null) {
    const other: "F" | "B" = lead === "F" ? "B" : "F";
    const pairLike = WEAPON_META[dress.held as Exclude<HeldId, "fists">]?.pair === true || art.offhand === true;
    if (!byTag.has(`item:${lead}`)) note("hand", `item not in hand${lead}`, 1, 0);
    if (!pairLike && byTag.has(`item:${other}`)) note("hand", `item in hand${other}`, 1, 0);
  }
  for (const side of ["F", "B"] as const) {
    const item = byTag.get(`item:${side}`);
    if (item === undefined || art === null) continue;
    const g = apply(item[0]!.item!, art.grip.x, art.grip.y);
    const h = fist(side);
    note("grip", `item:${side}`, Math.hypot(g[0] - h[0], g[1] - h[1]), LIMITS.grip);
  }
  if (art !== null && art.grip2 !== undefined && ins.backHold(pose, dress) >= 1) {
    const item = byTag.get(`item:${lead}`);
    if (item !== undefined) {
      const g = apply(item[0]!.item!, art.grip2.x, art.grip2.y);
      const h = fist(lead === "F" ? "B" : "F");
      note("grip", "grip2", Math.hypot(g[0] - h[0], g[1] - h[1]), LIMITS.grip);
    }
  }
  const sh = byTag.get("shield");
  const sart = ins.shield(dress);
  if (sh !== undefined && sart !== null) {
    const g = apply(sh[0]!.item!, sart.grip.x, sart.grip.y);
    const w = start("handB");
    note("grip", "shield", Math.hypot(g[0] - w[0], g[1] - w[1]), LIMITS.grip);
  }
  const prop = byTag.get("prop");
  if (prop !== undefined) {
    const g = apply(prop[0]!.item!, 0, 0);
    const h = fist(lead === "F" ? "B" : "F");
    note("grip", "prop", Math.hypot(g[0] - h[0], g[1] - h[1]), LIMITS.grip);
  }
  return out;
}

/** The item kinds every clip is measured with. */
export const KINDS: readonly { name: string; dress: Partial<Dress> & { held: HeldId | null } }[] = [
  { name: "fists", dress: { held: null } },
  { name: "one-hand pipe", dress: { held: "pipe" } },
  { name: "two-hand sledgehammer", dress: { held: "sledgehammer" } },
  { name: "two-hand bat", dress: { held: "bat" } },
  { name: "two-hand pool cue", dress: { held: "pool-cue" } },
  { name: "pair screwdrivers", dress: { held: "screwdrivers" } },
  { name: "pair screwdrivers, back lead", dress: { held: "screwdrivers", lead: "B" } },
  { name: "pipe + riot shield", dress: { held: "pipe", shield: "riot-shield" } },
  { name: "fists + pallet", dress: { held: null, shield: "wooden-pallet" } },
  { name: "pipe + can", dress: { held: "pipe", prop: "can" } },
  { name: "boomerang", dress: { held: "boomerang" } },
  { name: "darts", dress: { held: "darts" } },
  { name: "tyre", dress: { held: "tyre" } },
  { name: "golf club", dress: { held: "golf-club" } },
  { name: "plunger", dress: { held: "plunger" } },
  { name: "frying pan", dress: { held: "frying-pan" } },
];
/** The per-weapon variants (`content/clips/use.ts`) and the hands each is made for. */
const VARIANT_HANDS: Readonly<Record<string, 1 | 2>> = {
  "throw-side": 1, "throw-flick": 1, "thrust-1h": 1, "swing-2h": 2, "swing-low": 2, "swing-flat": 1, "throw-roll": 2, "throw-heave": 2,
};
const BASES = ["swing", "thrust", "flick", "throw"] as const;
export const LOOK = (build: number): Dress["look"] => ({ build, head: 0, hair: 0, face: 0, top: build === 1 ? 0 : 1, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 });
export function dressOf(kind: (typeof KINDS)[number], build: number): Dress {
  return { look: LOOK(build), shield: null, scale: 1, ...kind.dress } as Dress;
}
export const sizeOf = (d: Dress): number => (d.scale > 0 ? d.scale : 1) * BUILDS[d.look?.build ?? 0]!.scale;

export function frameTimes(rig: Rig, clip: string): number[] {
  const d = rig.clipInfo("scrapper", clip).durationMs;
  const n = Math.max(1, Math.round((d * 60) / 1000));
  return Array.from({ length: n + 1 }, (_, i) => (i * d) / n);
}

/** How far a drawn arm part turned since the frame before (degrees per 60 fps frame). */
export function addTurn(m: Drawn, prev: Drawn | undefined, step = 1): void {
  if (prev === undefined) return;
  for (const [k, a] of Object.entries(m.angles)) {
    if (k.startsWith("up")) continue;     // ANATOMY.turnPerFrame is a forearm's and a hand's
    const b = prev.angles[k];
    if (b === undefined) continue;
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    d /= step;
    if (d > m.turn) m.turn = d;
    if (d > LIMITS.turn) m.faults.push({ kind: "turn", where: k, value: d });
  }
}
export const scoreOf = (m: Drawn): number => Math.max(m.apart / LIMITS.apart, m.open / LIMITS.open, m.length / LIMITS.length,
  m.socket / 0.5, m.grip / LIMITS.grip, m.bend / 10, m.turn / LIMITS.turn, m.hand * 10);

export interface Row { clip: string; kind: string; build: number; facing: 1 | -1; t: number; m: Drawn; score: number; aim?: "head" | "body" }
const BASE_ATTACKS: readonly string[] = ["punch", "flick", "swing", "smash", "thrust"];
/** Every clip x kind x build x facing x 60 fps frame; `clips` is the clip list (variants by name).
 *  A base attack clip is played as the item plays it (its variant), plain and aimed at a head and
 *  a body, as the stage asks for it. */
export function sweep(rig: Rig, clips: readonly string[], opts: { step?: number; ring?: number; kinds?: readonly string[] } = {}): Row[] {
  const ins = inspectOf(rig);
  const rows: Row[] = [];
  const target: Dress = { look: LOOK(0), held: null, shield: null, scale: 1 };
  const aimY = { head: rig.hitPoint("scrapper", target, "head").y, body: rig.hitPoint("scrapper", target, "body").y };
  for (const clip0 of clips) {
    for (const kind of KINDS) {
      if (opts.kinds !== undefined && !opts.kinds.includes(kind.name)) continue;
      // a base attack clip plays only with an item whose attack it is (any item can be thrown)
      const own = kind.dress.held === null ? "punch" : WEAPON_META[kind.dress.held as Exclude<HeldId, "fists">].clip;
      if (BASE_ATTACKS.includes(clip0) && clip0 !== own && clip0 !== "throw") continue;
      // a variant plays only with the items whose use it is (`content/clips/use.ts`)
      if (VARIANT_HANDS[clip0] !== undefined && !Object.values(rig.attackClip === undefined ? {} : BASES).some((base) => rig.attackClip!(kind.dress.held ?? "fists", base) === clip0)) continue;
      const clip = rig.attackClip?.(kind.dress.held ?? "fists", clip0) ?? clip0;
      const ts = frameTimes(rig, clip).filter((_, i) => i % (opts.step ?? 1) === 0);
      const attack = rig.clipInfo("scrapper", clip).events.some((e) => e.name === "contact");
      for (let b = 0; b < BUILDS.length; b++) {
        const dress = dressOf(kind, b);
        for (const aim of attack ? [undefined, "head", "body"] as const : [undefined] as const) {
          const last: Partial<Record<1 | -1, Drawn>> = {};
          for (const t of ts) {
            const pose = aim === undefined ? rig.samplePose("scrapper", clip, t) : rig.samplePose("scrapper", clip, t, { y: aimY[aim], dress });
            for (const facing of [1, -1] as const) {
              const m = measureDrawn(ins, pose, dress, { x: 0, y: 0, facing }, sizeOf(dress), opts.ring);
              addTurn(m, last[facing], opts.step ?? 1);
              last[facing] = m;
              const row: Row = { clip, kind: kind.name, build: b, facing, t, m, score: scoreOf(m) };
              if (aim !== undefined) row.aim = aim;
              rows.push(row);
            }
          }
        }
      }
    }
  }
  return rows;
}
