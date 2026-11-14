/**
 * Measurement from sampled frames, shared by the stage tests and tools/timeline-audit.ts.
 * Nothing here reads `ContactMark.starts`: every start is the first sampled millisecond in
 * which the frame model shows that effect for that contact.
 */
import type { ActorId } from "@rankzero/core";
import { strikeTime, toStage } from "@rankzero/rig";
import type { Rig } from "@rankzero/rig";
import type { EffectKey } from "../../src/contracts";
import type { StagePlayer } from "../../src/createFightPlayer";

export const EFFECT_KEYS: readonly EffectKey[] = ["flash", "flinch", "knockback", "burst", "number", "hp", "shake", "crowd", "sound"];
export const WINDOW = 120;

/** First time each effect of contact `ci` is present, sampling every 1 ms from at - 120 to at + 120. */
export function measureStarts(player: StagePlayer, ci: number, window = WINDOW): Record<EffectKey, number | null> {
  const mark = player.timeline.contacts[ci]!;
  const first: Record<EffectKey, number | null> = { flash: null, flinch: null, knockback: null, burst: null, number: null,
    hp: null, shake: null, crowd: null, sound: null };
  for (let k = -window; k <= window; k++) {
    const t = mark.at + k;
    for (const p of player.frame(t).present) {
      if (p.contact === ci && first[p.key] === null) first[p.key] = t;
    }
  }
  return first;
}

/** Every actor that strikes at contact `ci`, read off the frame at the contact time: its clip,
 *  clip time and aim. `null` when no actor shows a swing tagged with this contact. */
export function strikerAt(player: StagePlayer, ci: number): { id: ActorId; clip: string; clipT: number } | null {
  const mark = player.timeline.contacts[ci]!;
  const f = player.frame(mark.at);
  for (const a of f.actors) if (a.seg?.strikes === ci) return { id: a.id, clip: a.clip, clipT: a.clipT };
  return null;
}

/**
 * The distance at contact `ci` between the striking end drawn on the sampled frame and the
 * target's hit point. The striking end is `rig.strikePoint` of the frame's clip, dress and aim
 * (valid only when the frame's clip time is the clip's strike time, which is checked and
 * returned), placed at the frame's place. The hit point is the target's, at its frame place.
 */
export function strikeGap(player: StagePlayer, rig: Rig, ci: number, target: ActorId, zone: "head" | "body"):
  { gap: number; clipTOff: number; dx: number; dy: number } | null {
  const mark = player.timeline.contacts[ci]!;
  const f = player.frame(mark.at);
  const a = f.actors.find((x) => x.seg?.strikes === ci);
  const tg = f.actors.find((x) => x.id === target);
  if (a === undefined || tg === undefined) return null;
  const strike = strikeTime(rig.clipInfo(a.rig, a.clip)) ?? 0;
  const end = toStage(a.place, rig.strikePoint(a.rig, a.clip, a.dress, a.aim?.y));
  const hit = toStage(tg.place, rig.hitPoint(tg.rig, tg.dress, zone));
  const dx = end.x - hit.x;
  const dy = end.y - hit.y;
  return { gap: Math.hypot(dx, dy), clipTOff: a.clipT - strike, dx, dy };
}
