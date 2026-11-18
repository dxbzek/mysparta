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
import type { ActorId, ActorInit, BagItem, BoutLog, FighterSnapshot, GearId, GearSlot, HeldId, MoveId, ShieldId, Side, Step } from "@rankzero/core";
import { GEAR_META, WEAPON_META, isGearId, isScrapper, killStep as findKillStep, scrapperOf, sideOf } from "@rankzero/core";
import type { Aim, ClipInfo, Dress, Pose, Rig, RigId } from "@rankzero/rig";
import { strikeTime } from "@rankzero/rig";
import type { ContactMark, Cue, EffectKey, MoveBeat, PlayerOpts, SfxFamily, SfxItem, SfxOn } from "./contracts";
import { finishCues, pickVariant } from "./cues";
import type { Zone } from "./layout";
import { BODY_GAP, FLOOR_Y, HOME, PET_MARKS, PET_SCALE, SCRAPPER_REACH, STAGE_W, homeFacing, homeMarks, reachFor, stopFor } from "./layout";
import type { ActorTrack, BagEvent, Crowd, Flash, FlightItem, FloorItem, FxItem, HpEvent, Move, Nudge, NumberItem,
  Seg, Shake, Aura, Sig, Sling, TagItem, Tracks } from "./model";
import type { MotionRules } from "./motion";
import { motionRules } from "./motion";
import { homeSpan } from "./camera";
import { basePos, clipTime, drawPlace, facingAt, heldAt, nudgeAt, segAt, shieldAt } from "./track";

import { BEAT, CONTACT, FLOOR, FRAMING, HIT_STOP, IDLE, INTRO, KNOCKOUT, SOUND } from "./tuning";
import type { Plan } from "./footwork";
import { drawnScale, layWay, planWay, readyAt } from "./footwork";
import { dispatch } from "./choreo/index";


/** Test hooks. Never set by the host: a planted fault for the controls of ground rule 13. */
/** The gear a snapshot wears, by slot (its perks hold only what its loadout wears). */
function wornOf(perks: readonly string[]): Partial<Record<GearSlot, GearId>> {
  const out: Partial<Record<GearSlot, GearId>> = {};
  for (const p of perks) if (isGearId(p)) out[GEAR_META[p].slot] = p;
  return out;
}

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
  /** Leave the whooshes at the wind-up's start (a control for the build-cost test). */
  noSwooshes?: boolean;
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
  /** The least room between the two places at the stop, in units (a Snatch flicks the weapon out
   *  of the hand at arm's length, it does not run into the body). */
  minRoom?: number;
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
  readonly sigs: Sig[] = [];
  readonly slings: Sling[] = [];
  readonly extraBusy: [number, number][] = [];
  /** The Moves' spans that the clock plays at 1x at any speed (`Timeline.holds`). */
  readonly holds: [number, number][] = [];
  tape: { from: number; to: number } | null = null;
  koFocus: Tracks["koFocus"] = null;

  /** Actors away from home that walk back at the next flush. */
  readonly out = new Set<ActorId>();
  /** Where an actor walks to at a flush instead of its home mark: the winner's outro place over the
   *  knocked-out body (choreo/fall.ts). */
  readonly standAt = new Map<ActorId, number>();
  readonly hpNow = new Map<ActorId, number>();
  readonly status = new Map<ActorId, "up" | "ko" | "fled">();
  readonly heldNow = new Map<ActorId, HeldId>();
  readonly shieldNow = new Map<ActorId, ShieldId | null>();
  readonly bagNow: Record<Side, BagItem[]>;
  /** What the last swing or Move hit, for the steps that follow from it (disarm, shieldOff, free, ko). */
  cause: { step: number; at: number; actor: ActorId; hitStop: number } | null = null;
  readonly lastHitAt = new Map<ActorId, number>();
  readonly snared = new Map<ActorId, { seg: Seg; cover: FxItem; sling?: Sling; covered?: { from: number; to: number } }>();
  /** The tarp of the last Tarp Move: its target, when its hem touches the floor, and the sheet's
   *  centre from the target's place, in its facing. */
  tarpLanding: { target: ActorId; at: number; dx: number } | null = null;

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
        ...(isScrapper(a.id) ? { look: snaps[side].look, gear: wornOf(snaps[side].perks) } : {}),
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
  /**
   * When a swing's whoosh is cued: `SOUND.whooshPeakMs` before the fastest moment of the forward
   * drive, so the loud part of the sample is heard as the weapon comes through fastest. The drive
   * is measured on the drawn pose of the wind-up just laid (`from` to `contact`), the striking
   * hand's grip in stage space every 4 ms, toward the target (`facing`). Sound review history: at
   * the start of the wind-up it was heard 70 to 130 ms before the arm came through; at the start of
   * the drive (the first sample at half the top speed) it was still loud 45 to 55 ms before the
   * fastest frames and nearly silent before the hit (round-2 close, measured on the recorded audio).
   * A clip whose hand does not drive forward (a pet's bite) whooshes at its middle.
   */
  /** Every swing's whoosh cue and its wind-up, for `placeSwooshes`. */
  readonly swooshes: { cue: Cue; actor: ActorId; from: number; contact: number }[] = [];
  /** Each whoosh at its swing's drive as finally drawn. */
  placeSwooshes(): void {
    for (const w of this.swooshes) w.cue.at = this.swooshAt(w.actor, w.from, w.contact, 1);
  }
  swooshAt(id: ActorId, from: number, contact: number, _facing: 1 | -1): number {
    const tr = this.track(id);
    // (dressed as at each moment, from the track: what it holds then, not at the end of the build)
    const dressAt = (t: number): Dress => {
      const d: Dress = { held: tr.rig === "scrapper" ? heldAt(tr, t) : null, shield: tr.rig === "scrapper" ? shieldAt(tr, t) : null, scale: tr.scale };
      if (tr.look !== undefined) d.look = tr.look;
      const lead = segAt(tr, t)?.lead;
      if (lead !== undefined) d.lead = lead;
      return d;
    };
    const d = forwardDrive(this.rig, tr, this.nudgesOf.get(id) ?? [], dressAt, from, contact);
    return Math.min(contact, Math.max(from - SOUND.whooshPeakMs, d.mid - SOUND.whooshPeakMs));
  }
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

  private bounds: { x0: number; x1: number } | null = null;
  /** The floor x a scrapper's place keeps inside so its body stays in the camera's fixed frame
   *  (camera.homeSpan: the part of the stage every canvas shows), `FRAMING.inset` in from it. */
  frameBounds(id: ActorId, inset: number = FRAMING.inset): { x0: number; x1: number } {
    if (this.bounds === null) {
      const s = homeSpan(this);
      const m = s.must ?? { x0: s.x0, x1: s.x1 };
      this.bounds = { x0: m.x0, x1: m.x1 };
    }
    const k = inset * drawnScale(this, id);
    return { x0: Math.max(0, this.bounds.x0 + k), x1: Math.min(STAGE_W, this.bounds.x1 - k) };
  }

  /** The floor x a scrapper's place keeps inside so that it is in view on the narrowest canvas
   *  (`FRAMING.viewMin` units across): within that width of the far end of the home room, with
   *  `CAMERA.excursion` of its body round it. Wider than `frameBounds`: a step out to here is in
   *  the frame (camera.frameSpan follows it) on every canvas. */
  viewBounds(id: ActorId, also: readonly number[] = []): { x0: number; x1: number } {
    const s = homeSpan(this);
    const m = s.must ?? { x0: s.x0, x1: s.x1 };
    // (and the places other scrappers have stepped to so far, with their room, and `also`)
    let x0 = Math.min(m.x0, ...also);
    let x1 = Math.max(m.x1, ...also);
    for (const tr of this.actors) {
      if (tr.rig !== "scrapper" || tr.id === id) continue;
      const k = FRAMING.viewBody * drawnScale(this, tr.id);
      for (const mv of tr.moves) { x0 = Math.min(x0, mv.x1 - k); x1 = Math.max(x1, mv.x1 + k); }
    }
    const r = FRAMING.viewBody * drawnScale(this, id);
    return { x0: Math.max(0, x1 - FRAMING.viewMin + r), x1: Math.min(STAGE_W, x0 + FRAMING.viewMin - r) };
  }

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
  cue(at: number, step: number, family: SfxFamily, n = 0, item?: SfxItem | null, on?: SfxOn,
    extra?: Pick<Cue, "move" | "beat" | "accent">): void {
    const c: Cue = { at, step, family, variant: pickVariant(this.opts.cosmeticSeed, step, family, n) };
    if (item !== undefined && item !== null) c.item = item;
    if (on !== undefined) c.on = on;
    if (extra?.move !== undefined) c.move = extra.move;
    if (extra?.beat !== undefined) c.beat = extra.beat;
    if (extra?.accent === true) c.accent = true;
    this.cues.push(c);
  }
  /** A Move's own sound at one of its moments (contract rev 4). */
  moveCue(at: number, step: number, move: MoveId, beat: MoveBeat): void {
    this.cue(at, step, "move", beat === "act" ? 0 : 1, null, undefined, { move, beat });
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
      const hx = this.standAt.get(id) ?? tr.home.x;
      const dist = Math.hypot(hx - p.x, tr.home.y - p.floorY);
      if (dist < 0.5) continue;
      let ms = Math.max(BEAT.dashBackMinMs, Math.round((dist / BEAT.dashBackSpeed) * 1000));
      if (tr.rig === "scrapper" && this.internal.easedDash !== true) {
        // home by shuffles, facing the fight (footwork.ts): the body moves only in the air
        this.face(id, from, tr.homeFacing);
        ms = layWay(this, id, from, hx, tr.home.y, planWay(this, id, hx - p.x, tr.home.y - p.floorY, false, from)) - from;
        if (id === next) own = ms;
      } else if (tr.rig === "scrapper") {
        this.move(id, from, ms, hx, tr.home.y, 0, "inOut");
        this.face(id, from, tr.homeFacing);
        this.play(id, "backpedal", from, { until: from + ms });
      } else {
        // a dodge hop still landing back (effects.evadeEarly) finishes first: run under it, the
        // two offsets add up and carry it past its home, out of the camera's frame
        const s0 = (this.nudgesOf.get(id) ?? []).reduce((t, n) => (n.key === "hop" && n.from < from
          ? Math.max(t, n.from + n.outMs + n.holdMs + n.backMs) : t), from);
        this.move(id, s0, ms, tr.home.x, tr.home.y, 0, "inOut");
        // a companion turns, runs home, and turns to face the fight again
        this.face(id, s0, tr.home.x < p.x ? -1 : 1);
        this.play(id, "run", s0, { until: s0 + ms });
        this.face(id, s0 + ms, tr.homeFacing);
        ms += s0 - from;
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
          // a stop behind him (a long weapon on a pet that ran out close to him) is shuffled back
          // to, never run: the run clip only goes forward, so a backward run slides the feet
          way = planWay(this, p.actor, stop.x - from.x, y - from.floorY, p.mode === "dash" && facing * (stop.x - from.x) > 0, start);
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
    // a long weapon that would have to back out of the frame to reach (review round 2: a broom's
    // riposte thrust from off the screen): the stop is held in the frame and the target gives the
    // ground instead, a shuffle back before the blow
    const room = this.lastShort > FRAMING.giveMin && feet ? this.targetGives(p, facing, this.lastShort) : null;
    if (room !== null) {
      // the stop is found again from where the target now stands
      plan(p.start);
      if (contactAt < room + BEAT.restMs) {
        p.start += room + BEAT.restMs - contactAt;
        plan(p.start);
      }
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
      // (no dash sound for an attacker already in reach, whose way is still: it sounded with no one moving)
      if (p.mode === "dash" && way.kind !== "still") this.cue(t, p.i, "dash");
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
    segs.push(this.play(p.actor, p.clip, swingStart, { rate: strike / strikeIn, until: contactAt, ...extra }));
    // the whoosh is loudest on the fastest part of the forward drive (`swooshAt`)
    // (cued at the wind-up's start for now: `placeSwooshes` puts it on the drive once the bout is laid)
    void facing;
    this.cue(swingStart, p.i, "swing", 0, this.soundItem(p.actor, p.dress.held));

    // (placed again once the whole bout is laid: what is laid after this step can change the drawn
    // pose before the contact, the crossfade and what the hand holds)
    this.swooshes.push({ cue: this.cues[this.cues.length - 1]!, actor: p.actor, from: swingStart, contact: contactAt });
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
    this.lastShort = 0;
    if (atr.rig !== "scrapper") return { ...s, zone };
    if (ttr.rig !== "scrapper") return { ...this.inFrame(p.actor, s, facing), zone };
    // the gap is kept from the body as the clip draws it: its lunge carries the root forward
    // (review round 2: the stop alone kept the gap, and the lunge walked the bodies into one shape)
    const gap = BODY_GAP.body * Math.max(drawnScale(this, p.actor), drawnScale(this, p.target)) + this.lungeOf(p.actor, p.clip);
    const room = (x: number): number => facing * (tp.x - x);
    if (zone === "head" && room(s.x) < gap) {
      const b = at("body");
      if (room(b.x) > room(s.x)) { s = b; zone = "body"; }
    }
    if (room(s.x) < gap) s = { ...s, x: tp.x - facing * gap };
    if (p.minRoom !== undefined && room(s.x) < p.minRoom) s = { ...s, x: tp.x - facing * p.minRoom };
    return { ...this.inFrame(p.actor, s, facing), zone };
  }

  private lunges = new Map<string, number>();
  /** How far a clip carries a scrapper's root forward at most up to its strike (after it the
   *  target flinches back), in stage units (its drawn size). */
  lungeOf(id: ActorId, clip: string): number {
    const tr = this.track(id);
    const key = `${tr.rig}|${clip}`;
    let r = this.lunges.get(key);
    if (r === undefined) {
      const info = this.info(tr.rig, clip);
      r = 0;
      const strike = this.strikeOf(info);
      for (let t = 0; t <= strike; t += 10) r = Math.max(r, this.rig.samplePose(tr.rig, clip, t).root.x);
      this.lunges.set(key, r);
    }
    return r * drawnScale(this, id);
  }

  /** How far behind the frame (`frameBounds`) the last `stopClear` put its stop: a long weapon
   *  that would back out of the camera's frame to reach. 0 when the stop is inside. */
  lastShort = 0;
  /** Records how far a scrapper's stop lies behind the frame (away from its target). The stop
   *  itself is not moved: the striking end must still meet the hit point (test/accuracy), so the
   *  swing makes the target give that ground instead (`targetGives`). */
  private inFrame<T extends { x: number }>(id: ActorId, s: T, facing: 1 | -1): T {
    const b = this.frameBounds(id);
    const x = Math.min(b.x1, Math.max(b.x0, s.x));
    if (facing * (x - s.x) > 0) this.lastShort = Math.abs(x - s.x);
    return s;
  }

  /**
   * The target of a swing whose stop lies behind the frame gives that much ground, away from the
   * attacker, kept in the frame itself, once it has finished what it is doing: a scrapper with a
   * shuffle back; a pet runs back, and when its owner stands right behind it he shuffles back too.
   * Nobody held (snared) moves. Returns when they are set, or null when nobody moved.
   */
  targetGives(p: SwingPlan, facing: 1 | -1, short: number): number | null {
    const ttr = this.track(p.target);
    const free = (id: ActorId): boolean => this.has(id) && this.status.get(id) === "up" && !this.snared.has(id);
    if (!free(p.target) || this.internal.easedDash === true) return null;
    const startOf = (id: ActorId): number => {
      const tr = this.track(id);
      let st = Math.max(p.start, tr.rig === "scrapper" ? readyAt(this, id) : -Infinity);
      // (every move laid so far: a pet's run out in front of its owner, `petMeets`, starts at the
      // swing's start, and the ground is given from where that run ends)
      for (const m of tr.moves) if (m.to !== Infinity && m.to > st) st = m.to;
      for (const g of tr.segs) if (g.busy && g.from <= p.start && g.to !== Infinity && g.to > st) st = g.to;
      return st;
    };
    /** A scrapper shuffles back by `d` (inside the frame); returns how far it went and when it is set. */
    const shuffle = (id: ActorId, d: number): { went: number; set: number } => {
      const start = startOf(id);
      const q = this.place(id, start);
      const b = this.frameBounds(id);
      const x = Math.min(b.x1, Math.max(b.x0, q.x + facing * d));
      const way = planWay(this, id, x - q.x, 0, false, start);
      if (way.kind === "still") return { went: 0, set: start };
      this.face(id, start, facing === 1 ? -1 : 1);
      const set = layWay(this, id, start, x, q.y, way);
      this.out.add(id);
      return { went: Math.abs(x - q.x), set };
    };
    if (ttr.rig === "scrapper") {
      const r = shuffle(p.target, short);
      return r.went > 0 ? r.set : null;
    }
    // a pet: its owner behind it gives what the gap between them cannot
    const start = startOf(p.target);
    const q = this.place(p.target, start);
    let d = short;
    let set = start;
    const owner = scrapperOf(ttr.side);
    if (free(owner)) {
      const o = this.place(owner, start);
      const ahead = facing * (o.x - q.x);
      if (ahead > 0) {
        const need = SCRAPPER_REACH.front * drawnScale(this, owner) + BODY_GAP.petClear + (q.facing === facing ? ttr.reach.front : ttr.reach.back);
        const slack = Math.max(0, ahead - need);
        if (slack < d) {
          const r = shuffle(owner, d - slack);
          d = slack + r.went;
          set = Math.max(set, r.set);
        }
      }
    }
    const lo = PET_MARKS.edge + Math.max(ttr.reach.back, ttr.reach.front);
    const x = Math.min(STAGE_W - lo, Math.max(lo, q.x + facing * d));
    if (Math.abs(x - q.x) < 0.5) return set > start ? set : null;
    const ms = Math.max(BEAT.dashMinMs, Math.round((Math.abs(x - q.x) / BEAT.dashSpeed) * 1000));
    // it turns, runs back and turns to face the attacker again
    this.face(p.target, start, facing);
    this.move(p.target, start, ms, x, q.y, 0, "inOut");
    this.play(p.target, "run", start, { until: start + ms });
    this.face(p.target, start + ms, facing === 1 ? -1 : 1);
    this.out.add(p.target);
    return Math.max(set, start + ms);
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
    // past the pet, not between the attacker and it: a long weapon reaches over the gap past its
    // stop, and on a back row the attacker stands behind the owner, drawn into his body (round-2
    // close, level 30 n 70: the owner gave to the gap from the stop, between the sledgehammer and
    // the pinned goose, and the two fighters read as one)
    const pet = this.place(p.target, start);
    const far = (pet.facing === facing ? ttr.reach.front : ttr.reach.back);
    const past = pet.x + facing * (far + SCRAPPER_REACH.front * drawnScale(this, owner) + BODY_GAP.petClear);
    const want = facing === 1 ? Math.max(stopX + gap, past) : Math.min(stopX - gap, past);
    // and never past what the narrowest canvas shows (content v3 batch 2: at level 30 the owner of a
    // snared pet stepped up to 90 units past his mark, past the tall phone's 200-unit view, in 18 of
    // 400 bouts). The view always holds the scrappers' home room (camera.homeSpan `must`), so a place
    // up to `FRAMING.viewMin` from its far end, less the body's half width, is always in it.
    const view = this.viewBounds(owner, [stopX - facing * FRAMING.viewBody * drawnScale(this, p.actor)]);
    const x = Math.min(STAGE_W - lo, view.x1, Math.max(lo, view.x0, want));

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

/**
 * The stage x of the striking end as drawn (round-2 close: the hand alone is fastest early in the
 * wind-up; what the eye follows is the weapon's head, which the wrist whips through last): the
 * grip, plus the grip-to-striking-end vector of the strike pose turned by how far the held item's
 * angle is from its angle there. Bare hands and a pet's mouth: the grip itself.
 */
export function strikingEnd(rig: Rig, tr: ActorTrack, dress: Dress, pose: Pose, place: { x: number; y: number; facing: 1 | -1 },
  contactT: number): number {
  return strikingPoint(rig, tr, dress, pose, place, contactT).x;
}
/** The same, as a stage point. */
export function strikingPoint(rig: Rig, tr: ActorTrack, dress: Dress, pose: Pose, place: { x: number; y: number; facing: 1 | -1 },
  contactT: number, cache?: Map<string, { vx: number; vy: number; rot0: number } | null>): { x: number; y: number } {
  const h = rig.handAnchor(pose, dress, { x: 0, y: 0, facing: 1 });
  // the grip-to-head vector at the strike, the same for every sample of one swing (measured once:
  // round-2 close, measuring it per sample doubled the timeline's build and stalled the app)
  const key = `${dress.held ?? ""}|${dress.lead ?? ""}`;
  let sv = cache?.get(key);
  if (sv === undefined) {
    sv = null;
    const seg = segAt(tr, contactT - 0.5);
    if (seg !== null && dress.held !== null && dress.held !== "fists") {
      const strike = rig.samplePose(tr.rig, seg.clip, clipTime(seg, contactT - 0.5), seg.aim);
      const hs = rig.handAnchor(strike, dress, { x: 0, y: 0, facing: 1 });
      const sp = rig.strikePoint(tr.rig, seg.clip, dress, seg.aim?.y);
      sv = { vx: sp.x - hs.x, vy: sp.y - hs.y, rot0: hs.rot };
    }
    cache?.set(key, sv);
  }
  const vx = sv?.vx ?? 0;
  const vy = sv?.vy ?? 0;
  const rot0 = sv?.rot0 ?? h.rot;
  const d = ((h.rot - rot0) * Math.PI) / 180;
  const x = h.x + vx * Math.cos(d) - vy * Math.sin(d);
  const y = h.y + vx * Math.sin(d) + vy * Math.cos(d);
  return { x: place.x + place.facing * x, y: place.y + y };
}


/**
 * The forward drive of a swing as drawn, from `from` (the wind-up's start) to `contact`: the striking
 * end (`strikingPoint`) on the clip's pose every 8 ms, its speed while it moves toward
 * the target; `start` is the first moment of the run of samples at half the top speed or more that
 * holds the fastest one, `mid` the middle of the drive from there to the contact. A heavy swing's
 * head moves at nearly one speed from the top of the wind-up to the hit (level 30 n 70, the crowbar:
 * 12.3 units per 8 ms after the turn, 10.5 at 32 ms before the hit), so the whoosh is centred on the
 * drive rather than on its noisy fastest sample. With no forward motion (a bite), the middle.
 */
const DRIVE_STEP = 8;
export function forwardDrive(rig: Rig, tr: ActorTrack, nudges: readonly Nudge[], dressAt: (t: number) => Dress, from: number,
  contact: number): { start: number; mid: number } {
  const v: { t: number; s: number }[] = [];
  const cache = new Map<string, { vx: number; vy: number; rot0: number } | null>();
  try {
    let prev: { x: number; y: number } | null = null;
    // (every 8 ms: half a frame at 60 fps, and the blended pose is the costly part of a build)
    for (let t = from; t <= contact; t += DRIVE_STEP) {
      const p = drawPlace(tr, nudges, t);
      // (the clip's own pose, not the crossfaded one: they gave the same drive on the measured
      // bouts, and the crossfade's recursion made the build half as slow again)
      const seg = segAt(tr, t);
      const pose = seg === null ? rig.samplePose(tr.rig, "idle", t + tr.phase) : rig.samplePose(tr.rig, seg.clip, clipTime(seg, t), seg.aim);
      const q = strikingPoint(rig, tr, dressAt(t), pose, { x: p.x, y: p.y, facing: p.facing }, contact, cache);
      if (prev !== null) v.push({ t: t - DRIVE_STEP, s: p.facing * (q.x - prev.x) > 0 ? Math.hypot(q.x - prev.x, q.y - prev.y) : 0 });
      prev = q;
    }
  } catch { /* a rig with no hand */ }
  const top = Math.max(0, ...v.map((q) => q.s));
  if (top <= 0.05) return { start: from, mid: (from + contact) / 2 };
  let k = v.findIndex((q) => q.s === top);
  while (k > 0 && v[k - 1]!.s >= top * 0.5) k -= 1;
  const start = v[k]!.t;
  return { start, mid: (start + contact) / 2 };
}

/** Spans sorted and merged where they touch or overlap. */

function mergeSpans(list: readonly [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [f, t] of [...list].filter((s) => s[1] > s[0]).sort((p, q) => p[0] - q[0])) {
    const last = out[out.length - 1];
    if (last !== undefined && f <= last[1]) last[1] = Math.max(last[1], t);
    else out.push([f, t]);
  }
  return out;
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
  if (internal.noSwooshes !== true) B.placeSwooshes();



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
    holds: mergeSpans(B.holds),
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
    sigs: B.sigs,
    slings: B.slings,
    tape: B.tape,
    koFocus: B.koFocus,
    applyAt: stepEnd,
    outroAt: B.outroAt,
    winner: B.winner,
    cues: timeline.cues,
  };
}
