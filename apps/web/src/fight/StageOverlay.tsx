/**
 * The DOM layer over the stage canvas: the combo counter ("x2", "x3") and the "K.O." stamp. Every
 * value is a pure function of `t` and the beats read once from the log: no timer, no state, no CSS
 * animation (brief 3.12, one clock).
 *
 * A Move has no banner here: it simply happens on the stage, with a small tag of its icon and name
 * over its user, and its tile lights on the card (owner, 15 Nov 2026: "I don't like the skill
 * preview. It should just show").
 *
 * Calm fight (owner, 15 Nov 2026: "I'm getting dizzy watching it"): nothing slams in and nothing
 * flashes. The counter fades in; the stamp fades in and settles from 108% of its size. Reduced
 * motion: the words fade in where they stand.
 */
import type { Beats } from "./beats";
import { BEAT_MS, comboAt, easeIn } from "./beats";
import css from "./fight.module.css";

const fade = (ms: number, span: number, out: number): number => (ms > span - out ? Math.max(0, (span - ms) / out) : 1);

export function StageOverlay({ beats, t, reduced }: { beats: Beats; t: number; reduced: boolean }) {
  const combo = comboAt(beats, t);
  const sinceKo = beats.koAt === null ? -1 : t - beats.koAt;
  const stampMs = sinceKo - 260;
  return (
    <div className={css.overlay} aria-hidden="true">
      {combo !== null ? (
        <div
          className={`${css.combo} ${combo.combo.side === "a" ? css.comboA : css.comboB}`}
          style={{ transform: `rotate(${combo.combo.side === "a" ? -8 : 8}deg)`, opacity: easeIn(combo.ms, 120) * fade(combo.ms, BEAT_MS.combo, 200) }}
        >
          <small>COMBO</small>x{combo.combo.count}
        </div>
      ) : null}
      {stampMs >= 0 && beats.koSide !== null ? (
        <div className={css.koStamp} style={{ opacity: easeIn(stampMs, BEAT_MS.stampIn),
          transform: `rotate(-9deg) scale(${(reduced ? 1 : 1.08 - 0.08 * easeIn(stampMs, BEAT_MS.stampIn)).toFixed(3)})` }}>K.O.</div>
      ) : null}
    </div>
  );
}
