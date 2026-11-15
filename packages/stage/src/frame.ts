/**
 * One frame of the bout at time `t`, as data: every actor's clip, clip time, aim, place and dress;
 * every floor prop, flight, effect, number and sticker; the camera shake and the crowd. A pure
 * function of `t` and the built tracks. `draw.ts` paints it, and the stage's tests measure it.
 *
 * `present` lists which of the nine contact effects can be seen in this frame and for which
 * contact. It is read off the frame's own parts (a white tint, a flinch clip, a knockback
 * offset, a burst, a number, an HP change, a shake, a crowd bounce, a sound cue that plays in
 * this millisecond), not from the contact's `starts` record.
 */
import type { ActorId, PropId } from "@rankzero/core";
import type { Aim, Dress, FxKind, Place, RigId } from "@rankzero/rig";
import type { EffectKey } from "./contracts";
import { IMPACT_FAMILIES } from "./cues";
import { pointAt } from "./flight";
import type { Nudge, Seg, Tracks } from "./model";
import { clipTime, drawPlace, eased, heldAt, segAt, shieldAt } from "./track";
import { CONTACT, FLIGHT } from "./tuning";

export interface FrameActor {
  id: ActorId; rig: RigId; clip: string; clipT: number; aim?: Aim; place: Place; floorY: number;
  dress: Dress; seg: Seg | null; nudges: Nudge[];
}
export interface FrameProp { item: PropId; x: number; y: number; rot: number; facing: 1 | -1; alpha: number }
export interface FrameFx { fx: FxKind; progress: number; at: Place; seed: number }
export interface FrameText { text: string; x: number; y: number; size: number; colour: string; ink: string; alpha: number;
  kind: "number" | "tag" | "banner" | "sticker" }
export interface Present { key: EffectKey; contact: number }
export interface Frame {
  t: number;
  shake: { x: number; y: number };
  crowd: number;
  actors: FrameActor[];
  floor: FrameProp[];
  flights: FrameProp[];
  fx: FrameFx[];
  texts: FrameText[];
  tape: number | null;
  present: Present[];
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export function frameAt(tr: Tracks, t: number): Frame {
  const present: Present[] = [];
  const contactOfStep = new Map<number, number>();
  tr.timeline.contacts.forEach((c, i) => { if (!contactOfStep.has(c.step)) contactOfStep.set(c.step, i); });

  // ---- flashes
  const white = new Set<ActorId>();
  for (const f of tr.flashes) {
    if (t >= f.from && t < f.from + f.ms) {
      white.add(f.actor);
      if (f.contact !== null) present.push({ key: "flash", contact: f.contact });
    }
  }

  // ---- actors
  const nudgesOf = new Map<ActorId, Nudge[]>();
  for (const n of tr.nudges) {
    const list = nudgesOf.get(n.actor);
    if (list === undefined) nudgesOf.set(n.actor, [n]);
    else list.push(n);
  }
  const actors: FrameActor[] = [];
  for (const a of tr.actors) {
    if (t < a.showFrom || t >= a.goneAt) continue;
    const p = drawPlace(a, nudgesOf.get(a.id) ?? [], t);
    for (const n of p.nudges) if (n.key === "knockback" && n.contact !== null) present.push({ key: "knockback", contact: n.contact });
    const seg = segAt(a, t);
    if (seg !== null && seg.flinchOf !== undefined) present.push({ key: "flinch", contact: seg.flinchOf });
    const dress: Dress = { held: a.rig === "scrapper" ? heldAt(a, t) : null, shield: a.rig === "scrapper" ? shieldAt(a, t) : null,
      scale: a.scale };
    if (a.look !== undefined) dress.look = a.look;
    if (white.has(a.id)) dress.tint = "white";
    if (seg?.lead !== undefined) dress.lead = seg.lead;
    if (seg?.prop !== undefined) dress.prop = seg.prop;
    const fa: FrameActor = { id: a.id, rig: a.rig, clip: seg === null ? "idle" : seg.clip,
      clipT: seg === null ? t + a.phase : clipTime(seg, t), place: { x: p.x, y: p.y, facing: p.facing }, floorY: p.floorY,
      dress, seg, nudges: p.nudges };
    if (seg?.aim !== undefined) fa.aim = seg.aim;
    actors.push(fa);
  }
  actors.sort((p, q) => (p.floorY !== q.floorY ? p.floorY - q.floorY : p.place.x - q.place.x));
  const placeOf = new Map<ActorId, FrameActor>(actors.map((x) => [x.id, x]));

  // ---- floor props: the newest six, the oldest fading out as a seventh lands
  const floor: FrameProp[] = [];
  for (const f of tr.floor) {
    if (t < f.from || t >= f.fadeTo) continue;
    const alpha = t >= f.fadeFrom ? 1 - clamp01((t - f.fadeFrom) / (f.fadeTo - f.fadeFrom)) : 1;
    const e = t - f.from;
    const bounce = e < 140 ? 3 * Math.sin((Math.PI * e) / 140) : 0;
    floor.push({ item: f.item, x: f.x, y: f.y - bounce, rot: f.rot, facing: f.facing, alpha });
  }

  // ---- flights
  const flights: FrameProp[] = [];
  for (const f of tr.flights) {
    if (t < f.from) continue;
    if (t < f.to) {
      const q = pointAt(f.path, (t - f.from) / (f.to - f.from));
      flights.push({ item: f.item, x: q.x, y: q.y, rot: q.rot, facing: f.path.facing, alpha: 1 });
    } else if (f.after === "vanish" && t < f.to + FLIGHT.vanishMs) {
      const q = pointAt(f.path, 1);
      flights.push({ item: f.item, x: q.x, y: q.y, rot: q.rot, facing: f.path.facing, alpha: 1 - (t - f.to) / FLIGHT.vanishMs });
    }
  }

  // ---- effects
  const fx: FrameFx[] = [];
  for (const e of tr.fx) {
    if (t < e.from || t >= e.to) continue;
    const span = e.to - e.from;
    let progress = e.loopMs !== undefined ? ((t - e.from) % e.loopMs) / e.loopMs : span > 0 && span !== Infinity ? (t - e.from) / span : 0;
    let x = e.x;
    let y = e.y;
    let facing = e.facing;
    if (e.follow !== undefined) {
      const who = placeOf.get(e.follow);
      if (who === undefined) continue;
      x = who.place.x + who.place.facing * e.x;
      y = who.floorY + (e.dy ?? 0);
      facing = who.place.facing;
    }
    if (e.fly !== undefined) {
      const u = clamp01((t - e.from) / e.fly.ms);
      const v = eased("out", u);
      x = e.fly.x0 + (x - e.fly.x0) * v;
      y = e.fly.y0 + (y - e.fly.y0) * v - 4 * v * (1 - v) * e.fly.arc;
      progress = e.fx === "tarp" ? (u < 1 ? 0.2 : clamp01((t - e.from - e.fly.ms) / Math.max(1, span - e.fly.ms))) : u;
    }
    fx.push({ fx: e.fx, progress, at: { x, y, facing }, seed: e.seed });
    if (e.key !== undefined && e.contact !== null) present.push({ key: e.key, contact: e.contact });
  }

  // ---- numbers and stickers
  const texts: FrameText[] = [];
  for (const n of tr.numbers) {
    const e = t - n.from;
    if (e < 0 || e >= CONTACT.numberMs) continue;
    const pop = e < CONTACT.numberPopMs ? CONTACT.numberPopFrom + (1 - CONTACT.numberPopFrom) * (e / CONTACT.numberPopMs) : 1;
    const rise = CONTACT.numberRise * eased("out", e / CONTACT.numberMs);
    const fadeFrom = CONTACT.numberMs - CONTACT.numberFadeMs;
    const alpha = e > fadeFrom ? 1 - (e - fadeFrom) / CONTACT.numberFadeMs : 1;
    texts.push({ text: n.text, x: n.x, y: n.y - rise, size: 13 * n.scale * pop, colour: n.colour, ink: "#14152B", alpha, kind: "number" });
    if (n.contact !== null) present.push({ key: "number", contact: n.contact });
  }
  for (const g of tr.tags) {
    if (t < g.from || t >= g.to) continue;
    const e = t - g.from;
    const pop = e < 90 ? 1.3 - 0.3 * (e / 90) : 1;
    const left = g.to - t;
    const alpha = left < 120 ? left / 120 : 1;
    let x = g.x;
    const y = g.y;
    if (g.kind === "banner" && e < 160) x = g.x - (1 - eased("out", e / 160)) * 40;
    texts.push({ text: g.text, x, y, size: g.size * pop, colour: g.colour, ink: g.ink, alpha, kind: g.kind });
  }

  // ---- HP changes that are happening now (for the contact measurement)
  for (const h of tr.hp) {
    if (h.contact !== null && t >= h.at && t < h.at + h.ms) present.push({ key: "hp", contact: h.contact });
  }
  // ---- sound: a cue of the contact's step that plays in this millisecond
  for (const c of tr.cues) {
    if (!(c.at > t - 1 && c.at <= t)) continue;
    const ci = contactOfStep.get(c.step);
    if (ci === undefined) continue;
    const mark = tr.timeline.contacts[ci]!;
    if (Math.abs(c.at - mark.at) > 200) continue;
    if (IMPACT_FAMILIES.has(c.family) || c.family === "whoosh") present.push({ key: "sound", contact: ci });
  }

  // ---- camera shake and crowd
  let sx = 0;
  let sy = 0;
  for (const s of tr.shakes) {
    const e = t - s.from;
    if (e < 0 || e >= s.ms) continue;
    const k = s.amp * (1 - e / s.ms);
    sx += k * Math.sin(e * 0.11 + s.seed);
    sy += k * 0.6 * Math.cos(e * 0.13 + s.seed * 0.5);
    if (s.contact !== null) present.push({ key: "shake", contact: s.contact });
  }
  let crowd = 0;
  for (const c of tr.crowds) {
    const e = t - c.from;
    if (e < 0 || e >= c.ms) continue;
    crowd = Math.max(crowd, Math.sin((Math.PI * e) / c.ms));
    if (c.contact !== null) present.push({ key: "crowd", contact: c.contact });
  }

  const tape = tr.tape !== null && t >= tr.tape.from && t < tr.tape.to ? (t - tr.tape.from) / (tr.tape.to - tr.tape.from) : null;
  return { t, shake: { x: sx, y: sy }, crowd, actors, floor, flights, fx, texts, tape, present };
}

