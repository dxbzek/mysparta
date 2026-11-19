/**
 * The moments the DOM around the stage reacts to, read once from the log and the timeline (never
 * from a clock of their own): a skill or a Move firing, a combo hit, the knockout blow. Every
 * view that uses them is then a pure function of `t` (brief 3.12: one clock).
 */
import type { ActorId, BoutLog, PerkId, Side, Step } from "@rankzero/core";
import { perkKind, sideOf } from "@rankzero/core";
import type { Timeline } from "@rankzero/stage";

/** A skill (passive, Move or the shield that blocked) firing: its owner's side and when. */
/** `shield` is a block a carried shield made: it lights the shield on the card. A Move or a
 *  passive lights its tile; its name shows on the stage as a small tag over its user. */
export interface Fire { at: number; side: Side; id: PerkId; kind: "move" | "proc" | "shield"; step: number }
/** A hit that is the second (or later) of one actor's swings in a turn. */
export interface ComboHit { at: number; side: Side; count: number; step: number }
export interface Beats { fires: Fire[]; combos: ComboHit[]; koAt: number | null; koSide: Side | null }

/** How long a fire lights its tile, and a combo counter stays up. A Move has no banner: it
 *  simply happens on the stage (owner, 15 Nov 2026: "It should just show"). Review r2: on a
 *  phone at 1x a tag over the stage is often up for under half a second, so the lit tile on the
 *  card is the steady second channel that says which skill fired: it stays fully lit for about a
 *  second and fades over the next 0.6 s. */
export const BEAT_MS = { fire: 1600, combo: 760, stampIn: 200 } as const;


function contactOf(tl: Timeline, step: number): number | null {
  for (const c of tl.contacts) if (c.step === step) return c.at;
  return null;
}

export function beatsOf(log: BoutLog, tl: Timeline): Beats {
  const fires: Fire[] = [];
  const combos: ComboHit[] = [];
  let chain: { actor: ActorId; turn: number; hits: number } | null = null;
  log.steps.forEach((s: Step, i) => {
    const at = tl.stepAt[i] ?? 0;
    if (s.t === "move") fires.push({ at, side: sideOf(s.actor), id: s.move, kind: "move", step: i });
    if ("procs" in s && s.procs) {
      const p = s.procs[0];
      if (p) fires.push({ at: contactOf(tl, i) ?? at, side: sideOf(p.by), id: p.skill as PerkId, kind: perkKind(p.skill as PerkId) === "shield" ? "shield" : "proc", step: i });
    }
    if (s.t === "attack" || s.t === "throw") {
      if (chain === null || chain.actor !== s.actor || chain.turn !== s.turn || s.n === 0) chain = { actor: s.actor, turn: s.turn, hits: 0 };
      if (s.outcome === "hit") {
        chain.hits += 1;
        if (chain.hits >= 2) combos.push({ at: contactOf(tl, i) ?? at, side: sideOf(s.actor), count: chain.hits, step: i });
      }
    }
  });
  fires.sort((p, q) => p.at - q.at);
  const ko = tl.killStep >= 0 ? contactOf(tl, tl.killStep) : null;
  const killer = tl.killStep >= 0 ? log.steps[tl.killStep] : undefined;
  const koSide = killer && "actor" in killer ? sideOf(killer.actor) : null;
  return { fires, combos, koAt: ko, koSide };
}

/** 0 to 1: how lit a tile is `ms` after its fire (on at once, then fading over the window). */
export function glow(ms: number, span: number = BEAT_MS.fire): number {
  if (ms < 0 || ms >= span) return 0;
  return ms < span * 0.6 ? 1 : 1 - (ms - span * 0.6) / (span * 0.4);
}

/** The fires that light a tile at `t`, by side and perk, with their glow. */
export function litAt(beats: Beats, t: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of beats.fires) {
    const g = glow(t - f.at);
    if (g <= 0) continue;
    const key = `${f.side}:${f.id}`;
    out.set(key, Math.max(out.get(key) ?? 0, g));
  }
  return out;
}

/** The combo counter on show at `t`, if any. */
export function comboAt(beats: Beats, t: number): { combo: ComboHit; ms: number } | null {
  let best: ComboHit | null = null;
  for (const c of beats.combos) if (t >= c.at && t < c.at + BEAT_MS.combo) best = c;
  return best === null ? null : { combo: best, ms: t - best.at };
}

/** How far in a calm entrance is, 0 to 1 (eased out): a fade and a short slide, never a slam
 *  (calm fight, owner 15 Nov 2026: "I'm getting dizzy watching it"). Pure. */
export function easeIn(ms: number, inMs: number): number {
  if (ms <= 0) return 0;
  if (ms >= inMs) return 1;
  const u = ms / inMs;
  return 1 - (1 - u) * (1 - u);
}
