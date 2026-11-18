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
import type { ActorId, PerkId, PropId, SkillId } from "@rankzero/core";
import type { Aim, Dress, FxKind, FxSize, Place, RigId } from "@rankzero/rig";
import type { EffectKey } from "./contracts";
import { IMPACT_FAMILIES } from "./cues";
import { anchorAt, pointAt } from "./flight";
import type { Nudge, Seg, SigKind, TagRole, Tracks } from "./model";
import { clipTime, drawPlace, eased, heldAt, segAt, shieldAt } from "./track";
import { BLEND, CONTACT, FLIGHT, FLOOR, MOVE } from "./tuning";

export interface FrameActor {
  id: ActorId; rig: RigId; clip: string; clipT: number; aim?: Aim; place: Place; floorY: number;
  dress: Dress; seg: Seg | null; nudges: Nudge[];
  /** A pet inside its own attack (`ActorTrack.attacks`): the one time it may draw over a fighter
   *  that stands at its depth. */
  attacking: boolean;
  /** What it has put aside for a Move (`Sling`): drawn hanging at its back hip, not on the arm. */
  slung?: PropId[];
  /** Under a tarp (choreo/snare.ts): not drawn, its sheet is (round-2 close: a goose's head floated
   *  over the dome, a fighter's head and sledgehammer stood out of a tall blue box). */
  covered?: boolean;
}

export interface FrameProp { item: PropId; x: number; y: number; rot: number; facing: 1 | -1; alpha: number;
  /** Drawn squashed to this share of its height toward the floor line `floorY` (a fallen shield). */
  squash?: number; floorY?: number }
/** `under`: a tarp lying over a pet is drawn with that pet (right after it, in its depth order), so
 *  a fighter in front of the pet stays in front of its tarp too (pets never cover fighters). */
export interface FrameFx { fx: FxKind; progress: number; at: Place; seed: number; under?: ActorId; size?: FxSize;
  /** Drawn behind every actor (draw.ts), not over them. */
  behind?: boolean }
export interface FrameText { text: string; x: number; y: number; size: number; colour: string; ink: string; alpha: number;
  kind: "number" | "tag" | "banner" | "sticker"; icon?: PerkId;
  /** A banner held in the top band of the view (`TagItem.band`). */
  band?: "top";
  /** A tag's role (`TagItem.role`; a tag without one is a note), the actor it rides on, its index
   *  in `Tracks.tags` and its start, for labels.ts. `x, y` of a riding tag is the point over the
   *  head that its box sits on; of any other text, its centre. */
  role?: TagRole; actor?: ActorId; idx?: number; from?: number;
  /** Its size without the pop, in stage units: what labels.ts lays out. */
  size0?: number;
  /** A number's index in `Tracks.numbers`, for labels.ts (it keeps the number off the tags). */
  num?: number }
/** A skill's signature in this frame (`Sig`): ms since it began, its progress, its fade and the
 *  actors it is drawn on. */
export interface FrameSig { kind: SigKind; skill?: SkillId; e: number; progress: number; alpha: number; actor: FrameActor | null;
  target: FrameActor | null; at?: number; from: number; to: number;
  /** Where a flying signature is now (the tarp, the snatched item), and where it came from. */
  fly?: { x: number; y: number; x0: number; y0: number; u: number } }
/** A glow round an actor in this frame (Second Wind's breath): how strong (0 to 1), where. */
export interface FrameAura { glow: number; x: number; floorY: number; colour: string; actor: ActorId }
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
  auras: FrameAura[];
  sigs: FrameSig[];
  present: Present[];
}

/** How long an aura takes to come up and to go. */
const AURA_FADE_MS = 160;

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
    // a scrapper's knockback is a step back (a move), not a nudge
    for (const m of a.moves) if (m.knockback !== undefined && t >= m.from && t < m.to) present.push({ key: "knockback", contact: m.knockback });
    const seg = segAt(a, t);
    if (seg !== null && seg.flinchOf !== undefined) present.push({ key: "flinch", contact: seg.flinchOf });
    const dress: Dress = { held: a.rig === "scrapper" ? heldAt(a, t) : null, shield: a.rig === "scrapper" ? shieldAt(a, t) : null,
      scale: a.scale };
    if (a.look !== undefined) dress.look = a.look;
    if (a.gear !== undefined && Object.keys(a.gear).length > 0) dress.gear = a.gear;
    if (white.has(a.id)) dress.tint = "white";
    if (seg?.lead !== undefined) dress.lead = seg.lead;
    // (the whistle is drawn by its signature, sigs.ts, small and in the mouth: the rig's prop art
    // read as a head-sized white blob on a phone, review round 2)
    if (seg?.prop !== undefined && seg.prop !== "whistle") dress.prop = seg.prop;
    let slung: PropId[] | undefined;
    for (const g of tr.slings) {
      // it goes back on the arm only once the arm is back in its guard: the pose crossfade after
      // the Move's last clip takes up to BLEND.maxMs (review round 2: the shield snapped back onto
      // an arm still raised at the mouth and covered the face)
      if (g.actor !== a.id || t < g.from || t >= g.to + BLEND.maxMs) continue;
      // (but a swing that starts inside it, as it ends, has its weapon in hand: round-2 close, an
      // intercept's pitchfork thrust right after an Air Horn was drawn with fists, the pitchfork on
      // the back)
      // (a throw's wind-up too: content v3 batch 2, the item flew from the hand off the back)
      const swinging = seg !== null && (seg.aim !== undefined || seg.throws === true) && seg.from > g.from;


      // (two slings may overlap, a Move right after a Move: what the first put aside stays there)
      slung ??= [];
      if (g.shield && dress.shield !== null) { slung.push(dress.shield); dress.shield = null; }
      // (only the weapon it put aside: a swap in the crossfade draws the new one into the hand, and
      // the old one leaves from the back, choreo/props.ts slungAt)
      if (g.held && !swinging && dress.held !== null && dress.held !== "fists" && (g.item === undefined || g.item === dress.held)) { slung.push(dress.held); dress.held = "fists"; }
    }
    const fa: FrameActor = { id: a.id, rig: a.rig, clip: seg === null ? "idle" : seg.clip,
      clipT: seg === null ? t + a.phase : clipTime(seg, t), place: { x: p.x, y: p.y, facing: p.facing }, floorY: p.floorY,
      dress, seg, nudges: p.nudges, attacking: a.attacks.some((w) => t >= w.from && t < w.to) };
    if (seg?.aim !== undefined) fa.aim = seg.aim;
    if (a.covered?.some((w) => t >= w.from && t < w.to) === true) {
      // a pet is hidden under its tarp; a fighter shows its head and hands over the sheet that hangs
      // from its shoulders (owner, 18 Nov 2026: "show the head"), and what it holds or carries is
      // under the sheet
      if (a.rig === "scrapper") {
        fa.dress = { ...fa.dress, held: "fists", shield: null };
        delete fa.slung;
      } else fa.covered = true;
    }

    if (slung !== undefined && slung.length > 0 && !(a.rig === "scrapper" && a.covered?.some((w) => t >= w.from && t < w.to) === true)) fa.slung = slung;
    actors.push(fa);
  }
  actors.sort(byDepth);
  const placeOf = new Map<ActorId, FrameActor>(actors.map((x) => [x.id, x]));

  // ---- floor props: the newest six, the oldest fading out as a seventh lands
  const floor: FrameProp[] = [];
  for (const f of tr.floor) {
    if (t < f.from || t >= f.fadeTo) continue;
    const alpha = t >= f.fadeFrom ? 1 - clamp01((t - f.fadeFrom) / (f.fadeTo - f.fadeFrom)) : 1;
    const e = t - f.from;
    const bounce = e < 140 ? 3 * Math.sin((Math.PI * e) / 140) : 0;
    const fp: FrameProp = { item: f.item, x: f.x, y: f.y - bounce, rot: f.rot, facing: f.facing, alpha };
    if (f.squash !== undefined && f.floorY !== undefined) {
      // a shield lands on its edge and falls flat
      fp.squash = 1 - (1 - f.squash) * eased("in", e / FLOOR.flopMs);
      fp.floorY = f.floorY;
      fp.y = f.y;
    }
    floor.push(fp);
  }

  // ---- flights
  const flights: FrameProp[] = [];
  for (const f of tr.flights) {
    if (t < f.from) continue;
    if (t < f.to) {
      const q = anchorAt(f.path, pointAt(f.path, (t - f.from) / (f.to - f.from)));
      flights.push({ item: f.item, x: q.x, y: q.y, rot: q.rot, facing: f.path.facing, alpha: 1 });
    } else if (f.after === "vanish" && t < f.to + FLIGHT.vanishMs) {
      const q = anchorAt(f.path, pointAt(f.path, 1));
      flights.push({ item: f.item, x: q.x, y: q.y, rot: q.rot, facing: f.path.facing, alpha: 1 - (t - f.to) / FLIGHT.vanishMs });
    }
  }

  // ---- effects
  const fx: FrameFx[] = [];
  for (const e of tr.fx) {
    if (t < e.from || t >= e.to) continue;
    const span = e.to - e.from;
    const k = t - e.from;
    // its lead part plays once (a tarp's slump), then its loop or its span
    const lead = e.lead !== undefined && k < e.lead.ms ? e.lead : undefined;
    const looped = e.lead !== undefined ? k - e.lead.ms : k;
    let progress = e.loopMs !== undefined ? (looped % e.loopMs) / e.loopMs : span > 0 && span !== Infinity ? k / span : 0;
    let x = e.x;
    let y = e.y;
    let facing = e.facing;
    let under: ActorId | undefined;
    const landed = e.fly === undefined || k >= e.fly.ms;
    if (e.follow !== undefined) {
      const who = placeOf.get(e.follow);
      if (who === undefined) continue;
      x = who.place.x + who.place.facing * e.x;
      y = who.floorY + (e.dy ?? 0);
      facing = who.place.facing;
      // a tarp over an actor is drawn with it, in its depth slot (round-2 close: a fighter's too)
      if (e.fx === "tarp" && landed) under = e.follow;
    }
    if (e.under !== undefined && landed) under = e.under;
    if (e.track !== undefined && e.track.length > 0) {
      const q = trackAt(e.track, t);
      x = q.x;
      y = q.y;
    }
    let mapped = false;
    if (lead !== undefined) {
      progress = lead.p0 + ((lead.p1 - lead.p0) * k) / lead.ms;
      mapped = true;
    }
    if (e.fly !== undefined) {
      const u = clamp01(k / e.fly.ms);
      const v = eased("out", u);
      if (e.fx === "tarp") {
        // in the air: the folded sheet on its arc to above the target; then the drop, its hem
        // reaching the floor exactly at the effect's end (where the landing sound is cued)
        const P = MOVE.tarpPhases;
        if (u < 1) {
          const y1 = y + (e.fly.dy ?? 0);
          x = e.fly.x0 + (x - e.fly.x0) * v;
          y = e.fly.y0 + (y1 - e.fly.y0) * v - 4 * v * (1 - v) * e.fly.arc;
          progress = P.fly * u;
        } else progress = P.fly + (P.land - P.fly) * clamp01((k - e.fly.ms) / Math.max(1, span - e.fly.ms));
        mapped = true;
      } else {
        x = e.fly.x0 + (x - e.fly.x0) * v;
        y = e.fly.y0 + (y - e.fly.y0) * v - 4 * v * (1 - v) * e.fly.arc;
        progress = u;
      }
    }
    if (!mapped && (e.p0 !== undefined || e.p1 !== undefined)) progress = (e.p0 ?? 0) + ((e.p1 ?? 1) - (e.p0 ?? 0)) * progress;
    fx.push({ fx: e.fx, progress, at: { x, y, facing }, seed: e.seed, ...(under !== undefined ? { under } : {}), ...(e.size !== undefined ? { size: e.size } : {}),
      ...(e.behind === true && !landed ? { behind: true } : {}) });

    if (e.key !== undefined && e.contact !== null) present.push({ key: e.key, contact: e.contact });
  }

  // ---- numbers and stickers
  const texts: FrameText[] = [];
  tr.numbers.forEach((n, num) => {
    const e = t - n.from;
    if (e < 0 || e >= CONTACT.numberMs) return;
    const pop = e < CONTACT.numberPopMs ? CONTACT.numberPopFrom + (1 - CONTACT.numberPopFrom) * (e / CONTACT.numberPopMs) : 1;
    const rise = CONTACT.numberRise * eased("out", e / CONTACT.numberMs);
    const fadeFrom = CONTACT.numberMs - CONTACT.numberFadeMs;
    const alpha = e > fadeFrom ? 1 - (e - fadeFrom) / CONTACT.numberFadeMs : 1;
    texts.push({ text: n.text, x: n.x, y: n.y - rise, size: 13 * n.scale * pop, colour: n.colour, ink: "#14152B", alpha, kind: "number", num,
      from: n.from });
    if (n.contact !== null) present.push({ key: "number", contact: n.contact });
  });
  tr.tags.forEach((g, idx) => {
    if (t < g.from || t >= g.to) return;
    const e = t - g.from;
    // a sticker settles in gently (calm camera: no slam)
    const pop = e < 120 ? 1.1 - 0.1 * eased("out", e / 120) : 1;
    const left = g.to - t;
    const alpha = left < 120 ? left / 120 : 1;
    let x = g.x;
    let y = g.y;
    if (g.kind === "banner" && e < 200) x = g.x - (1 - eased("out", e / 200)) * 12;
    const who = g.follow !== undefined ? placeOf.get(g.follow) : undefined;
    if (who !== undefined) {
      // a tag rides on its actor: over its head wherever it is now
      x = who.place.x + who.place.facing * (g.dx ?? 0);
      y = who.floorY + (g.dy ?? 0);
    }
    const ft: FrameText = { text: g.text, x, y, size: g.size * pop, colour: g.colour, ink: g.ink, alpha, kind: g.kind, idx, from: g.from,
      size0: g.size };
    if (g.icon !== undefined) ft.icon = g.icon;
    if (g.band !== undefined) ft.band = g.band;
    if (g.role !== undefined) ft.role = g.role;
    if (g.follow !== undefined) ft.actor = g.follow;
    texts.push(ft);
  });

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
    // a short tremor that dies out: mostly sideways, a little up and down (at most 1.08 x amp)
    const k = s.amp * (1 - e / s.ms);
    sx += k * Math.sin(e * 0.11 + s.seed);
    sy += k * 0.4 * Math.cos(e * 0.13 + s.seed * 0.5);
    if (s.contact !== null) present.push({ key: "shake", contact: s.contact });
  }
  let crowd = 0;
  for (const c of tr.crowds) {
    const e = t - c.from;
    if (e < 0 || e >= c.ms) continue;
    crowd = Math.max(crowd, Math.sin((Math.PI * e) / c.ms));
    if (c.contact !== null) present.push({ key: "crowd", contact: c.contact });
  }

  // ---- auras: a glow round an actor (Second Wind's breath); the arena never dims
  const auras: FrameAura[] = [];
  for (const s of tr.auras) {
    if (t < s.from || t >= s.to) continue;
    const who = placeOf.get(s.actor);
    if (who === undefined) continue;
    const glow = Math.min(1, (t - s.from) / AURA_FADE_MS, (s.to - t) / AURA_FADE_MS);
    auras.push({ glow, x: who.place.x, floorY: who.floorY, colour: s.colour, actor: s.actor });
  }

  // ---- skill signatures (sigs.ts paints them)
  const sigs: FrameSig[] = [];
  for (const g of tr.sigs) {
    if (t < g.from || t >= g.to + MOVE.sigFadeMs) continue;
    const e = t - g.from;
    const span = Math.max(1, g.to - g.from);
    const alpha = t < g.to ? Math.min(1, e / 60) : 1 - (t - g.to) / MOVE.sigFadeMs;
    const fs: FrameSig = { kind: g.kind, e, progress: clamp01(e / span), alpha, actor: placeOf.get(g.actor) ?? null,
      target: g.target !== null ? placeOf.get(g.target) ?? null : null, from: g.from, to: g.to };
    if (g.at !== undefined) fs.at = g.at;
    if (g.skill !== undefined) fs.skill = g.skill;
    if (g.fly !== undefined) {
      const u = clamp01(e / g.fly.ms);
      const v = eased("out", u);
      fs.fly = { x: g.fly.x0 + (g.fly.x1 - g.fly.x0) * v, y: g.fly.y0 + (g.fly.y1 - g.fly.y0) * v - 4 * v * (1 - v) * g.fly.arc,
        x0: g.fly.x0, y0: g.fly.y0, u };
    }
    sigs.push(fs);
  }

  const tape = tr.tape !== null && t >= tr.tape.from && t < tr.tape.to ? (t - tr.tape.from) / (tr.tape.to - tr.tape.from) : null;
  return { t, shake: { x: sx, y: sy }, crowd, actors, floor, flights, fx, texts, tape, auras, sigs, present };
}

/**
 * Draw order (owner, 15 Nov 2026: "Animal covering all animals and model"): farther back (a
 * smaller floor y) first. At one depth (within 0.3 units) a fighter draws over a pet, and only a
 * pet in its own attack comes in front of both; then left to right.
 */
const depthOf = (a: FrameActor): number => a.floorY + (a.rig === "scrapper" ? 0.3 : a.attacking ? 0.6 : 0);
export function byDepth(p: FrameActor, q: FrameActor): number {
  return depthOf(p) - depthOf(q) || p.place.x - q.place.x;
}

/** The point of a sampled track at `t` (held at its ends). */
function trackAt(track: readonly { t: number; x: number; y: number }[], t: number): { x: number; y: number } {
  const first = track[0]!;
  if (t <= first.t) return first;
  for (let i = 1; i < track.length; i++) {
    const b = track[i]!;
    if (t <= b.t) {
      const a = track[i - 1]!;
      const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
  }
  return track[track.length - 1]!;
}

