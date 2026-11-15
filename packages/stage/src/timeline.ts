/**
 * The timeline builder. It walks the log once, in order, and lays every step out on the fight
 * clock: who plays which clip when, who moves where, every effect, number, tag, flight, floor
 * prop, HP change and sound cue. The result (`Tracks`) is plain data; every frame after that is
 * a pure function of `t` (frame.ts).
 *
 * Rules it keeps:
 *  - Clip lengths and strike times come from `rig.clipInfo()` only, the strike via `strikeTime`.
 *  - An attacker stops where its aimed `rig.strikePoint` meets the target's `rig.hitPoint` at the
 *    contact time, wherever the target is at that time (a knockback still settling included).
 *  - The moment of contact is one value; every contact effect is scheduled from it (effects.ts).
 *  - One actor at a time: the next actor starts when the last one's dash back is 60% done.
 */
import type { ActorId, ActorInit, BagItem, BoutLog, FighterSnapshot, HeldId, ShieldId, Side, Step } from "@rankzero/core";
import { WEAPON_META, isScrapper, killStep as findKillStep, scrapperOf, sideOf } from "@rankzero/core";
import type { Aim, ClipInfo, Dress, Pose, Rig, RigId } from "@rankzero/rig";
import { strikeTime } from "@rankzero/rig";
import type { ContactMark, Cue, EffectKey, PlayerOpts, SfxFamily, SfxItem, SfxOn } from "./contracts";
import { finishCues, pickVariant } from "./cues";
import type { Zone } from "./layout";
import { BODY_GAP, FLOOR_Y, HOME, PET_MARKS, PET_SCALE, SCRAPPER_REACH, STAGE_W, homeFacing, homeMarks, reachFor, stopFor } from "./layout";
import type { ActorTrack, BagEvent, Crowd, Flash, FlightItem, FloorItem, FxItem, HpEvent, Move, Nudge, NumberItem,
  Seg, Shake, Aura, TagItem, Tracks } from "./model";
import type { MotionRules } from "./motion";
import { motionRules } from "./motion";
import { basePos, clipTime, drawPlace, facingAt, nudgeAt, segAt } from "./track";
import { BEAT, CONTACT, FLOOR, HIT_STOP, IDLE, INTRO, KNOCKOUT } from "./tuning";
import type { Plan } from "./footwork";
import { drawnScale, layWay, planWay, readyAt } from "./footwork";
import { dispatch } from "./choreo/index";

/** Test hooks. Never set by the host: a planted fault for the controls of ground rule 13. */
export interface Internal {
  /** Shift one contact effect's start by `ms` (all contacts, or only `contact`). */
  shiftEffect?: { key: EffectKey; ms: number; contact?: number };
  /** Move every attacker's stop by this many units along its facing. */
  stopError?: number;
  /** Multiply every screen shake by this (a planted fault for the calm-motion test). */
  shakeScale?: number;
  /** Pets on these marks, at this scale (a planted fault for the pet layout test: pets back at
   *  their owner's feet, as the fight-screen pass had them). */
  pets?: { marks: Readonly<Record<string, { x: number; y: number }>>; scale?: number };
  /** The dash as it was before the footwork pass: an eased slide (0 to 840 units/s) under the
   *  dash loop, the walk home an eased slide under the backpedal (a planted fault for the
   *  foot-slide test). */
  easedDash?: boolean;
}

export type { Zone } from "./layout";
export interface SwingPlan {
  i: number; actor: ActorId; target: ActorId; clip: string; dress: Dress; zone: Zone;
  start: number;
  /** "dash": anticipation, then a dash to the stop. "step": a short step to the stop during the
   *  wind-up (a combo swing, a riposte, an intercept). */
  mode: "dash" | "step";
  combo: boolean;
  hitStop: number;
  /** Slow motion after the hit-stop (the knockout blow). */
  slow: boolean;
}
export interface SwingDone { contactAt: number; end: number; stopX: number; aimY: number; segs: Seg[]; facing: 1 | -1 }

export class Builder {
  readonly motion: Readonly<MotionRules>;
  readonly killStep: number;
  cursor = 0;
  readonly stepAt: number[];
  readonly applyAt: number[];
  readonly contacts: ContactMark[] = [];
  readonly cues: Cue[] = [];
  readonly actors: ActorTrack[] = [];
  readonly byId = new Map<ActorId, ActorTrack>();
  readonly nudges: Nudge[] = [];
  readonly nudgesOf = new Map<ActorId, Nudge[]>();
  readonly fx: FxItem[] = [];
  readonly numbers: NumberItem[] = [];
  readonly tags: TagItem[] = [];
  readonly flights: FlightItem[] = [];
  readonly floor: FloorItem[] = [];
  readonly hp: HpEvent[] = [];
  readonly bags: BagEvent[] = [];
  readonly shakes: Shake[] = [];
  readonly flashes: Flash[] = [];
  readonly crowds: Crowd[] = [];
  readonly auras: Aura[] = [];
  readonly extraBusy: [number, number][] = [];
  tape: { from: number; to: number } | null = null;
  koFocus: Tracks["koFocus"] = null;

  /** Actors away from home that walk back at the next flush. */
  readonly out = new Set<ActorId>();
  readonly hpNow = new Map<ActorId, number>();
  readonly status = new Map<ActorId, "up" | "ko" | "fled">();
  readonly heldNow = new Map<ActorId, HeldId>();
  readonly shieldNow = new Map<ActorId, ShieldId | null>();
  readonly bagNow: Record<Side, BagItem[]>;
  /** What the last swing or Move hit, for the steps that follow from it (disarm, shieldOff, free, ko). */
  cause: { step: number; at: number; actor: ActorId; hitStop: number } | null = null;
  readonly lastHitAt = new Map<ActorId, number>();
  readonly snared = new Map<ActorId, { seg: Seg; cover: FxItem }>();
  /** The tarp of the last Tarp Move: where and when it lands. */
  tarpLanding: { target: ActorId; at: number } | null = null;
  readonly boosted = new Set<ActorId>();
  overtimeShown = false;
  /** The scrapper of the kill step has fallen. */
  koShown = false;
  /** When companions scared by an Air Horn start to run. */
  fleeAt: number | null = null;
  introDone = false;
  outroAt = 0;
  resultAt = 0;
  durationMs = 0;
  winner: Side = "a";

  constructor(readonly log: BoutLog, readonly snaps: Record<Side, FighterSnapshot>, readonly rig: Rig,
    readonly opts: PlayerOpts, readonly internal: Internal) {
    this.motion = motionRules(opts.reducedMotion);
    this.killStep = findKillStep(log);
    this.stepAt = new Array<number>(log.steps.length).fill(0);
    this.applyAt = new Array<number>(log.steps.length).fill(0);
    this.bagNow = { a: [...log.init.bag.a], b: [...log.init.bag.b] };
    // a pet is drawn at its clamped height (layout.PET_SCALE); a scrapper at its own size
    const scaleOf = (a: ActorInit): number => (a.kind === "scrapper" ? 1 : internal.pets?.scale ?? PET_SCALE[a.kind]);
    const marks = homeMarks(log.init.actors, (a) => reachFor(a.kind));
    log.init.actors.forEach((a, n) => {
      const side = sideOf(a.id);
      const home = internal.pets?.marks[a.id] ?? marks.get(a.id) ?? HOME;
      const tr: ActorTrack = {
        id: a.id, side, rig: a.kind as RigId, kind: a.kind, maxHp: a.maxHp,
        ...(isScrapper(a.id) ? { look: snaps[side].look } : {}),
        scale: scaleOf(a), home, homeFacing: homeFacing(side), reach: reachFor(a.kind), attacks: [],
        phase: (n * IDLE.phaseStepMs + ((opts.cosmeticSeed >>> 0) % 997)) % 1200,
        segs: [], moves: [], facings: [], helds: [], shields: [], initialShield: a.kind === "scrapper" ? log.init.shield[side] : null,
        start: { x: home.x, y: home.y }, showFrom: Infinity, goneAt: Infinity,
      };
      this.actors.push(tr);
      this.byId.set(a.id, tr);
      this.nudgesOf.set(a.id, []);
      this.hpNow.set(a.id, a.maxHp);
      this.status.set(a.id, "up");
      this.heldNow.set(a.id, "fists");
      this.shieldNow.set(a.id, a.kind === "scrapper" ? log.init.shield[side] : null);
    });
  }

  // ------------------------------------------------------------------ small helpers

  track(id: ActorId): ActorTrack {
    const tr = this.byId.get(id);
    if (tr === undefined) throw new Error(`stage: actor ${id} is not in the bout`);
    return tr;
  }
  has(id: ActorId): boolean { return this.byId.has(id); }
  info(rig: RigId, clip: string): ClipInfo { return this.rig.clipInfo(rig, clip); }
  /** The strike time of a clip; a clip with no strike strikes at its middle. */
  strikeOf(info: ClipInfo): number { return strikeTime(info) ?? info.durationMs / 2; }
  /** When an effect of a contact starts. Equal to the contact time, except under a planted fault. */
  effectStart(contact: number, key: EffectKey, at: number): number {
    const f = this.internal.shiftEffect;
    if (f !== undefined && f.key === key && (f.contact === undefined || f.contact === contact)) return at + f.ms;
    return at;
  }

  seg(id: ActorId, s: Seg): Seg {
    this.track(id).segs.push(s);
    return s;
  }
  /** Plays a clip from `from`. A clip that does not loop ends at its length (or is held with
   *  `hold`); a loop needs `until`. Returns the segment. */
  play(id: ActorId, clip: string, from: number, o: { rate?: number; c0?: number; until?: number; hold?: boolean;
    aim?: Aim; lead?: "F" | "B"; prop?: Seg["prop"]; busy?: boolean; flinchOf?: number } = {}): Seg {
    const tr = this.track(id);
    const info = this.info(tr.rig, clip);
    const rate = o.rate ?? 1;
    const c0 = o.c0 ?? 0;
    const natural = rate > 0 ? from + (info.durationMs - c0) / rate : Infinity;
    const to = o.hold === true ? Infinity : o.until ?? (info.loop ? from + info.durationMs : natural);
    const s: Seg = { from, to, clip, c0, rate, busy: o.busy ?? true };
    if (o.aim !== undefined) s.aim = o.aim;
    if (o.lead !== undefined) s.lead = o.lead;
    if (o.prop !== undefined) s.prop = o.prop;
    if (o.flinchOf !== undefined) s.flinchOf = o.flinchOf;
    return this.seg(id, s);
  }
  /** Where a clip played from `from` ends (presentation time). */
  clipEnd(id: ActorId, clip: string, from: number): number {
    return from + this.info(this.track(id).rig, clip).durationMs;
  }

  move(id: ActorId, from: number, ms: number, x: number, y: number, arc = 0, ease: Move["ease"] = "inOut", knockback?: number): void {
    const tr = this.track(id);
    const p = basePos(tr, from);
    const m: Move = { from, to: from + Math.max(1, ms), x0: p.x, y0: p.floorY, x1: x, y1: y, arc, ease };
    if (knockback !== undefined) m.knockback = knockback;
    insertSorted(tr.moves, m);
  }
  face(id: ActorId, from: number, facing: 1 | -1): void { insertSorted(this.track(id).facings, { from, facing }); }
  setHeld(id: ActorId, from: number, held: HeldId): void { insertSorted(this.track(id).helds, { from, held }); }
  setShield(id: ActorId, from: number, shield: ShieldId | null): void { insertSorted(this.track(id).shields, { from, shield }); }
  nudge(n: Nudge): void {
    this.nudges.push(n);
    this.nudgesOf.get(n.actor)?.push(n);
  }

  /** An actor's floor place at time `t`, with its nudges. */
  place(id: ActorId, t: number): { x: number; y: number; facing: 1 | -1 } {
    const tr = this.track(id);
    const p = basePos(tr, t);
    const n = nudgeAt(this.nudgesOf.get(id) ?? [], t);
    return { x: p.x + n.dx, y: p.floorY, facing: facingAt(tr, t) };
  }
  homeOf(id: ActorId): { x: number; y: number } { return this.track(id).home; }

  /** The pose an actor has at `t`, from what is scheduled so far. */
  poseAt(id: ActorId, t: number): Pose {
    const tr = this.track(id);
    const s = segAt(tr, t);
    if (s === null) return this.rig.samplePose(tr.rig, "idle", t + tr.phase);
    return this.rig.samplePose(tr.rig, s.clip, clipTime(s, t), s.aim);
  }
  /** The grip of the leading hand at `t` (a companion's mouth), as a stage point. */
  handAt(id: ActorId, t: number): { x: number; y: number; rot: number } {
    const tr = this.track(id);
    const s = segAt(tr, t);
    const p = drawPlace(tr, this.nudgesOf.get(id) ?? [], t);
    const d = this.dress(id, undefined, s?.lead);
    return this.rig.handAnchor(this.poseAt(id, t), d, { x: p.x, y: p.y, facing: p.facing });
  }

  /** The leading hand's grip sampled every `step` ms from `from` to `to`, for an effect carried in
   *  the hand (frame.ts draws it between the samples). Call it after the clips there are planned. */
  handTrack(id: ActorId, from: number, to: number, step = 30): { t: number; x: number; y: number }[] {
    const out: { t: number; x: number; y: number }[] = [];
    for (let t = from; ; t = Math.min(to, t + step)) {
      const h = this.handAt(id, t);
      out.push({ t, x: h.x, y: h.y });
      if (t >= to) break;
    }
    return out;
  }

  /** How an actor is dressed for aiming and hit points: its look, what it holds, its shield. */
  dress(id: ActorId, held?: HeldId | null, lead?: "F" | "B"): Dress {
    const tr = this.track(id);
    const h: HeldId | null = tr.rig === "scrapper" ? (held === undefined ? this.heldNow.get(id) ?? "fists" : held) : null;
    const d: Dress = { held: h, shield: this.shieldNow.get(id) ?? null, scale: tr.scale };
    if (tr.look !== undefined) d.look = tr.look;
    if (lead !== undefined) d.lead = lead;
    return d;
  }

  /** A sound at `at`. `item` is what made it and `on` what an impact struck (contract rev 3). */
  cue(at: number, step: number, family: SfxFamily, n = 0, item?: SfxItem | null, on?: SfxOn): void {
    const c: Cue = { at, step, family, variant: pickVariant(this.opts.cosmeticSeed, step, family, n) };
    if (item !== undefined && item !== null) c.item = item;
    if (on !== undefined) c.on = on;
    this.cues.push(c);
  }
  /** What an actor swings with for sound: its held item, or the companion itself. */
  soundItem(id: ActorId, held?: HeldId | null): SfxItem {
    const tr = this.track(id);
    if (tr.rig !== "scrapper") return tr.rig;
    return held ?? this.heldNow.get(id) ?? "fists";
  }
  busy(from: number, to: number): void { if (to > from) this.extraBusy.push([from, to]); }
  addContact(step: number, at: number, starts: Partial<Record<EffectKey, number | null>>): number {
    const all: Record<EffectKey, number | null> = { flash: null, flinch: null, knockback: null, burst: null, number: null,
      hp: null, shake: null, crowd: null, sound: null };
    for (const k of Object.keys(starts) as EffectKey[]) all[k] = starts[k] ?? null;
    this.contacts.push({ step, at, starts: all });
    return this.contacts.length - 1;
  }

  hitStopFor(i: number, crit: boolean): number {
    const raw = i === this.killStep ? HIT_STOP.knockout : crit ? HIT_STOP.crit : HIT_STOP.plain;
    return raw > this.motion.hitStopCap ? this.motion.hitStopCap : raw;
  }
  flinchClip(rig: RigId, heavy: boolean): string {
    return rig === "scrapper" ? (heavy ? "hit-heavy" : "hit-light") : "hit";
  }
  /** The clip of a swing: the weapon's clip, "punch" for bare hands, "attack" for a companion. */
  swingClip(id: ActorId, weapon: HeldId | null, thrown = false): string {
    if (this.track(id).rig !== "scrapper") return "attack";
    const meta = WEAPON_META[weapon ?? "fists"];
    const base = thrown ? "throw" : meta === undefined ? "punch" : meta.clip;
    // The rig names the weapon's own variant (side-arm boomerang, rolled tyre, two-hand bat).
    return this.rig.attackClip?.(weapon, base) ?? base;
  }
  /** On every second swing of a combo the other hand of a pair leads. */
  leadFor(weapon: HeldId | null, n: number): "F" | "B" | undefined {
    if (weapon === null) return undefined;
    return WEAPON_META[weapon]?.pair === true && n % 2 === 1 ? "B" : undefined;
  }

  /** Flush: every actor that is away from home walks back. The next actor may start when the
   *  longest walk is 60% done, and once it is home itself (`next`, a scrapper that shuffles home:
   *  its feet finish the bounce before they do anything else). */
  flush(next?: ActorId): void {
    if (this.out.size === 0) return;
    const from = this.cursor;
    let longest = 0;
    let own = 0;
    for (const id of this.out) {
      if (this.status.get(id) !== "up") continue;
      const tr = this.track(id);
      const p = basePos(tr, from);
      const dist = Math.hypot(tr.home.x - p.x, tr.home.y - p.floorY);
      if (dist < 0.5) continue;
      let ms = Math.max(BEAT.dashBackMinMs, Math.round((dist / BEAT.dashBackSpeed) * 1000));
      if (tr.rig === "scrapper" && this.internal.easedDash !== true) {
        // home by shuffles, facing the fight (footwork.ts): the body moves only in the air
        this.face(id, from, tr.homeFacing);
        ms = layWay(this, id, from, tr.home.x, tr.home.y, planWay(this, id, tr.home.x - p.x, tr.home.y - p.floorY, false, from)) - from;
        if (id === next) own = ms;
      } else if (tr.rig === "scrapper") {
        this.move(id, from, ms, tr.home.x, tr.home.y, 0, "inOut");
        this.face(id, from, tr.homeFacing);
        this.play(id, "backpedal", from, { until: from + ms });
      } else {
        this.move(id, from, ms, tr.home.x, tr.home.y, 0, "inOut");
        // a companion turns, runs home, and turns to face the fight again
        this.face(id, from, tr.home.x < p.x ? -1 : 1);
        this.play(id, "run", from, { until: from + ms });
        this.face(id, from + ms, tr.homeFacing);
      }
      if (ms > longest) longest = ms;
    }
    this.out.clear();
    this.cursor = from + Math.max(Math.round(longest * BEAT.nextAfterBack), Math.ceil(own));
  }

  /** The intro is over: the FIGHT card, then the first action at 1500. */
  startBout(): void {
    if (this.introDone) return;
    this.introDone = true;
    this.tags.push({ from: INTRO.fightCardAt, to: INTRO.fightCardAt + INTRO.fightCardMs, text: this.opts.text.fight,
      colour: "#FFD23F", ink: "#14152B", actor: null, x: 180, y: 96, size: 30, kind: "banner" });
    if (this.cursor < INTRO.firstActionAt) this.cursor = INTRO.firstActionAt;
  }

  /**
   * One swing with a contact: the approach, the aimed clip, the hit-stop and the follow-through.
   * The stop is found from where the target is at the contact time, so the striking end meets
   * the target's hit point there.
   */
  swing(p0: SwingPlan): SwingDone {
    const atr = this.track(p0.actor);
    // a scrapper still on its way somewhere (home, a dodge) finishes that first
    const p: SwingPlan = atr.rig === "scrapper" && this.internal.easedDash !== true
      ? { ...p0, start: Math.max(p0.start, readyAt(this, p0.actor)) } : { ...p0 };
    const ttr = this.track(p.target);
    const info = this.info(atr.rig, p.clip);
    const strike = this.strikeOf(info);
    const strikeIn = p.combo ? BEAT.comboStrikeMs : strike;
    const from = basePos(atr, p.start);
    // a scrapper crosses the floor with real footwork (footwork.ts); a pet runs as before
    const feet = atr.rig === "scrapper" && this.internal.easedDash !== true;
    // a pet attacked behind its owner steps out in front of him first (layout.BODY_GAP)
    const met = p.mode === "dash" ? this.petMeets(p, from.x) : null;
    let contactAt = 0;
    let stop = { x: from.x, aimY: 0 };
    let facing: 1 | -1 = atr.homeFacing;
    let dashMs = 0;
    let way = null as Plan | null;
    let y = from.floorY;
    let zone = p.zone;
    const plan = (start: number): void => {
      contactAt = start + (p.mode === "dash" ? BEAT.anticipationMs + BEAT.dashMinMs : 0) + strikeIn;
      for (let k = 0; k < 4; k++) {
        const tp = this.place(p.target, contactAt);
        facing = tp.x > from.x ? 1 : tp.x < from.x ? -1 : atr.homeFacing;
        const s = this.stopClear(p, zone, facing, tp);
        zone = s.zone;
        stop = { x: s.x + facing * (this.internal.stopError ?? 0), aimY: s.aimY };
        y = tp.y;
        if (feet) {
          // a shuffle needs no brace before it: its own dip is the wind-up
          way = planWay(this, p.actor, stop.x - from.x, y - from.floorY, p.mode === "dash", start);
          contactAt = start + (way.kind === "run" ? BEAT.anticipationMs : 0) + way.ms + strikeIn;
        } else if (p.mode === "dash") {
          // a pet starts behind its owner (layout.homeMarks) and keeps behind his floor line until it
          // reaches its target's, so it passes behind him (he draws over it), never through him
          const dist = Math.hypot(stop.x - from.x, y - from.floorY);
          dashMs = Math.max(BEAT.dashMinMs, Math.round((dist / BEAT.dashSpeed) * 1000));
          contactAt = start + BEAT.anticipationMs + dashMs + strikeIn;
        } else {
          contactAt = start + strikeIn;
        }
      }
    };
    plan(p.start);
    // the pet is set on its new spot before the blow lands
    if (met !== null && contactAt < met + BEAT.restMs) {
      p.start += met + BEAT.restMs - contactAt;
      plan(p.start);
    }
    // a pet that cannot come out (snared, or held at the stage edge): its owner steps back past it
    const gave = p.mode === "dash" ? this.ownerGives(p, from.x, stop.x, facing) : null;
    if (gave !== null && contactAt < gave + BEAT.restMs) {
      p.start += gave + BEAT.restMs - contactAt;
      plan(p.start);
    }
    const swingStart = contactAt - strikeIn;
    this.face(p.actor, p.start, facing);
    if (feet && way !== null) {
      let t = p.start;
      if (p.mode === "dash" && way.kind === "run") {
        // the brace, played to its end in the anticipation, is the pose the push-off starts from
        const brace = this.info(atr.rig, "brace").durationMs;
        this.play(p.actor, "brace", t, { rate: brace / BEAT.anticipationMs, until: t + BEAT.anticipationMs });
        t += BEAT.anticipationMs;
      }
      if (p.mode === "dash") this.cue(t, p.i, "dash");
      layWay(this, p.actor, t, stop.x, y, way);
    } else if (p.mode === "dash") {
      if (atr.rig === "scrapper") this.play(p.actor, "brace", p.start, { until: p.start + BEAT.anticipationMs });
      else this.play(p.actor, "run", p.start, { rate: 0, until: p.start + BEAT.anticipationMs });
      this.move(p.actor, p.start + BEAT.anticipationMs, dashMs, stop.x, y, 0, "inOut");
      this.play(p.actor, atr.rig === "scrapper" ? "dash" : "run", p.start + BEAT.anticipationMs, { until: swingStart });
      this.cue(p.start + BEAT.anticipationMs, p.i, "dash");
      if (atr.rig !== "scrapper") this.cue(p.start, p.i, "companion", 0, atr.rig);
    } else {
      const stepMs = Math.min(BEAT.stepMs, strikeIn);
      if (Math.abs(stop.x - from.x) > 0.01 || Math.abs(y - from.floorY) > 0.01) this.move(p.actor, p.start, stepMs, stop.x, y, 0, "out");
    }
    this.out.add(p.actor);

    // the clip: wind-up to the strike, the hit-stop, the follow-through
    const aim: Aim = { y: stop.aimY, dress: p.dress };
    const lead = p.dress.lead;
    const extra = { aim, ...(lead !== undefined ? { lead } : {}) };
    const segs: Seg[] = [];
    this.cue(swingStart, p.i, "swing", 0, this.soundItem(p.actor, p.dress.held));
    segs.push(this.play(p.actor, p.clip, swingStart, { rate: strike / strikeIn, until: contactAt, ...extra }));
    segs.push(this.play(p.actor, p.clip, contactAt, { c0: strike, rate: 0, until: contactAt + p.hitStop, ...extra }));
    const rest = info.durationMs - strike;
    const restMs = p.combo ? BEAT.comboMs - BEAT.comboStrikeMs : rest;
    const postRate = restMs > 0 ? rest / restMs : 1;
    let t = contactAt + p.hitStop;
    let c = strike;
    if (p.slow && this.motion.slowMotion) {
      const r = postRate * KNOCKOUT.slowScale;
      const clipLeft = info.durationMs - c;
      const ms = Math.min(KNOCKOUT.slowMs, r > 0 ? clipLeft / r : KNOCKOUT.slowMs);
      segs.push(this.play(p.actor, p.clip, t, { c0: c, rate: r, until: t + ms, ...extra }));
      t += ms;
      c += ms * r;
    }
    const left = info.durationMs - c;
    const leftMs = postRate > 0 ? left / postRate : 0;
    if (leftMs > 0.01) segs.push(this.play(p.actor, p.clip, t, { c0: c, rate: postRate, until: t + leftMs, ...extra }));
    const end = t + Math.max(0, leftMs);
    // a pet may be drawn in front of a fighter only during its own attack (frame.ts)
    if (atr.rig !== "scrapper") atr.attacks.push({ from: p.start, to: end });
    // the target braces from the start of the dash (once it is set: not in the middle of its own
    // way home, which would leave its feet sliding under the brace)
    if (p.mode === "dash" && this.status.get(p.target) === "up" && !this.snared.has(p.target) && ttr.rig === "scrapper") {
      const set = ttr.moves.reduce((m, mv) => Math.max(m, mv.to), -Infinity);
      const ways = ttr.segs.filter((g) => g.clip === "shuffle" || g.clip === "brake").reduce((m, g) => Math.max(m, g.to), -Infinity);
      const from = Math.max(p.start + BEAT.anticipationMs, set, ways);
      if (from < contactAt) this.play(p.target, "brace", from, { until: contactAt, busy: false });
    }
    return { contactAt, end, stopX: stop.x, aimY: stop.aimY, segs, facing };
  }

  /**
   * A blow drives a scrapper back a step (review finding 17: a nudge slid both planted feet over
   * the floor). The flinch clips step with it, the front toe holding its spot while he is pushed
   * off it, as in a block (rig content/clips/reactions.ts KNOCK_STEP draws the same distances), so
   * every flinch a scrapper plays comes with it. He stays there and shuffles home at the next way
   * home. It is his own footwork, so reduced motion keeps it whole, as it keeps the block's step.
   * False (nothing done) for a companion or a rig without footwork: they get the nudge.
   */
  knockStep(id: ActorId, at: number, heavy: boolean, dir: 1 | -1, contact?: number): boolean {
    if (this.track(id).rig !== "scrapper" || this.internal.easedDash === true) return false;
    const step = (heavy ? CONTACT.knockStep.heavy : CONTACT.knockStep.light) * drawnScale(this, id);
    const p = this.place(id, at);
    this.move(id, at, CONTACT.knockbackOutMs, p.x + dir * step, p.y, 0, "out", contact);
    this.out.add(id);
    return true;
  }

  /** Where a swing stops (layout.stopFor), kept clear of the target's body (layout.BODY_GAP): a
   *  scrapper never stands nearer another than `BODY_GAP.body`. A blow at the head that would stop
   *  nearer goes for the body, which the arc meets further out; failing that the feet stop at the
   *  gap. Returns the zone it ends up aimed at. */
  stopClear(p: SwingPlan, zone0: Zone, facing: 1 | -1, tp: { x: number; facing: 1 | -1 }): { x: number; aimY: number; zone: Zone } {
    const atr = this.track(p.actor);
    const ttr = this.track(p.target);
    const tDress = this.dress(p.target);
    const at = (z: Zone): { x: number; aimY: number } => stopFor(this.rig, { rig: atr.rig, dress: p.dress, clip: p.clip, facing },
      { rig: ttr.rig, dress: tDress, x: tp.x, facing: tp.facing }, z);
    let s = at(zone0);
    let zone = zone0;
    if (atr.rig !== "scrapper" || ttr.rig !== "scrapper") return { ...s, zone };
    const gap = BODY_GAP.body * Math.max(drawnScale(this, p.actor), drawnScale(this, p.target));
    const room = (x: number): number => facing * (tp.x - x);
    if (zone === "head" && room(s.x) < gap) {
      const b = at("body");
      if (room(b.x) > room(s.x)) { s = b; zone = "body"; }
    }
    if (room(s.x) < gap) s = { ...s, x: tp.x - facing * gap };
    return { ...s, zone };
  }

  /**
   * A pet attacked while it stands behind its owner (seen from the attacker) runs out in front of
   * him first, onto a line just behind his floor line, its box `BODY_GAP.petClear` clear of his drawn front, and far
   * enough out that a scrapper hitting it stops `BODY_GAP.body` short of him (review finding 1: the
   * attacker walked through the owner to reach it). Returns when it is set there, or null when it
   * stays where it is. It runs home at the next flush.
   */
  petMeets(p: SwingPlan, fromX: number): number | null {
    const ttr = this.track(p.target);
    if (ttr.rig === "scrapper" || this.status.get(p.target) !== "up" || this.snared.has(p.target)) return null;
    const owner = scrapperOf(ttr.side);
    if (!this.has(owner) || this.status.get(owner) !== "up") return null;
    const o = this.place(owner, p.start);
    const q = this.place(p.target, p.start);
    // toward the attacker, seen from the owner
    const f: 1 | -1 = fromX < o.x ? -1 : 1;
    const r = ttr.reach;
    let x = o.x + f * (SCRAPPER_REACH.front * drawnScale(this, owner) + BODY_GAP.petClear + r.back);
    const atr = this.track(p.actor);
    if (atr.rig === "scrapper") {
      // the attacker's stop on the pet there, kept the body gap short of the owner
      const s = stopFor(this.rig, { rig: atr.rig, dress: p.dress, clip: p.clip, facing: f === -1 ? 1 : -1 },
        { rig: ttr.rig, dress: this.dress(p.target), x, facing: f }, p.zone);
      const gap = BODY_GAP.body * Math.max(drawnScale(this, p.actor), drawnScale(this, owner));
      const short = gap - f * (s.x - o.x);
      if (short > 0) x += f * short;
    }
    const lo = PET_MARKS.edge + Math.max(r.back, r.front);
    x = Math.min(STAGE_W - lo, Math.max(lo, x));
    // already out in front of him: it stays
    if (f * (q.x - x) >= -0.5) return null;
    const ms = Math.max(BEAT.dashMinMs, Math.round((Math.abs(x - q.x) / BEAT.dashSpeed) * 1000));
    this.face(p.target, p.start, f);
    // just behind its owner's floor line, so the attacker comes in on (nearly) his own and stays in
    // front of every pet behind him (a fighter draws over a pet at its depth), the owner over it
    this.move(p.target, p.start, ms, x, FLOOR_Y - BODY_GAP.petDepth, 0, "inOut");
    this.play(p.target, "run", p.start, { until: p.start + ms });
    this.out.add(p.target);
    return p.start + ms;
  }

  /**
   * A scrapper attacking a pet that stays behind its owner (snared under the tarp, so petMeets
   * leaves it, or kept at the stage edge) would stop inside him (review finding 1, verifier case:
   * level 30 n 4, step 57). The owner steps back past his pet instead, with his own footwork, to
   * `BODY_GAP.body` beyond the attacker's stop; the pet is drawn under him. Returns when he is set
   * there, or null when he is already clear (or down, or snared himself). He shuffles home at the
   * next way home.
   */
  ownerGives(p: SwingPlan, fromX: number, stopX: number, facing: 1 | -1): number | null {
    const atr = this.track(p.actor);
    const ttr = this.track(p.target);
    if (atr.rig !== "scrapper" || ttr.rig === "scrapper" || this.internal.easedDash === true) return null;
    const owner = scrapperOf(ttr.side);
    if (owner === p.actor || !this.has(owner) || this.status.get(owner) !== "up" || this.snared.has(owner)) return null;
    const start = Math.max(p.start, readyAt(this, owner));
    const o = this.place(owner, start);
    // only an owner ahead of the attacker, between him and (or just past) the stop
    if (facing * (o.x - fromX) <= 0) return null;
    const gap = BODY_GAP.body * Math.max(drawnScale(this, p.actor), drawnScale(this, owner));
    if (facing * (o.x - stopX) >= gap - 0.5) return null;
    const lo = SCRAPPER_REACH.back * drawnScale(this, owner);
    const x = Math.min(STAGE_W - lo, Math.max(lo, stopX + facing * gap));
    const way = planWay(this, owner, x - o.x, 0, false, start);
    if (way.kind === "still") return null;
    this.face(owner, start, facing === 1 ? -1 : 1);
    const set = layWay(this, owner, start, x, o.y, way);
    this.out.add(owner);
    return set;
  }

  /** A dropped item lands on the floor at `at`. When a seventh would land, the oldest fades out
   *  just before, so the floor never holds more than six. */
  land(step: number, item: FloorItem["item"], x: number, y: number, rot: number, facing: 1 | -1, at: number,
    flat?: { squash: number; floorY: number }): void {
    const lying = this.floor.filter((f) => f.fadeTo === Infinity);
    if (lying.length >= FLOOR.max) {
      const oldest = lying.reduce((p, q) => (q.from < p.from ? q : p));
      oldest.fadeFrom = at - FLOOR.fadeMs;
      oldest.fadeTo = at;
    }
    this.floor.push({ item, x, y, rot, facing, from: at, fadeFrom: Infinity, fadeTo: Infinity, ...(flat ?? {}) });
    this.cue(at, step, "drop", this.floor.length, item);
  }

  bag(side: Side, at: number, bag: readonly BagItem[]): void {
    this.bagNow[side] = [...bag];
    this.bags.push({ at, side, bag: bag.map((b) => ({ ...b })) });
  }
}

function insertSorted<T extends { from: number }>(list: T[], item: T): void {
  let i = list.length;
  while (i > 0 && list[i - 1]!.from > item.from) i -= 1;
  list.splice(i, 0, item);
}

/** True when the step carries on from the swing or Move before it, so nobody walks home first. */
function carriesOn(step: Step): boolean {
  switch (step.t) {
    case "attack":
    case "throw":
      return step.n > 0;
    case "riposte":
    case "disarm":
    case "shieldOff":
    case "ko":
      return true;
    case "free":
      return step.cause === "hit";
    default:
      return false;
  }
}

/** Builds the whole bout. */
export function buildTimeline(log: BoutLog, a: FighterSnapshot, b: FighterSnapshot, rig: Rig, opts: PlayerOpts,
  internal: Internal = {}): Tracks {
  const B = new Builder(log, { a, b }, rig, opts, internal);
  log.steps.forEach((step, i) => {
    if (step.t !== "enter") B.startBout();
    if (!carriesOn(step)) B.flush("actor" in step ? step.actor : undefined);
    const r = dispatch(B, step, i);
    B.stepAt[i] = r.at;
    B.applyAt[i] = r.apply;
  });

  // Step ends: strictly rising, so `state(stepEnd[n])` is the state after exactly n + 1 steps.
  const stepEnd: number[] = [];
  for (let i = 0; i < B.applyAt.length; i++) {
    const prev = i === 0 ? -Infinity : stepEnd[i - 1]!;
    stepEnd.push(Math.max(B.applyAt[i]!, prev + 1));
  }

  // Busy spans: every clip that is more than idling, every move, every flight, every heal beat.
  const busy: [number, number][] = [];
  for (const tr of B.actors) {
    for (const s of tr.segs) if (s.busy && s.to > s.from) busy.push([s.from, Math.min(s.to, B.durationMs)]);
    for (const m of tr.moves) busy.push([m.from, m.to]);
  }
  for (const f of B.flights) busy.push([f.from, f.to]);
  busy.push(...B.extraBusy);
  busy.sort((p, q) => p[0] - q[0] || p[1] - q[1]);

  const firstAction = log.steps.findIndex((s) => s.t !== "enter");
  const timeline = {
    durationMs: B.durationMs,
    stepAt: B.stepAt,
    stepEnd,
    contacts: B.contacts,
    busy: busy.map(([f, t]) => [f, t] as const),
    cues: finishCues(B.cues),
    killStep: B.killStep,
    firstActionAt: firstAction < 0 ? INTRO.firstActionAt : B.stepAt[firstAction]!,
    resultAt: B.resultAt,
  };
  return {
    timeline,
    actors: B.actors,
    byId: B.byId,
    nudges: B.nudges,
    fx: B.fx,
    numbers: B.numbers,
    tags: B.tags,
    flights: B.flights,
    floor: B.floor,
    hp: B.hp,
    bags: B.bags,
    initialBag: { a: log.init.bag.a.map((x) => ({ ...x })), b: log.init.bag.b.map((x) => ({ ...x })) },
    shakes: B.shakes,
    flashes: B.flashes,
    crowds: B.crowds,
    auras: B.auras,
    tape: B.tape,
    koFocus: B.koFocus,
    applyAt: stepEnd,
    outroAt: B.outroAt,
    winner: B.winner,
    cues: timeline.cues,
  };
}
