/**
 * The DOM layer over the stage canvas: the Move banner (its icon, its name and the one line of
 * what it does) that comes in while the user winds up and stays through the action, the combo
 * counter ("x2", "x3") and the "K.O." stamp. Every value is a pure function of `t` and the beats
 * read once from the log: no timer, no state, no CSS animation (brief 3.12, one clock).
 *
 * Calm fight (owner, 15 Nov 2026: "I'm getting dizzy watching it"): nothing slams in and nothing
 * flashes. The banner and the counter fade in with a short slide; the stamp fades in and settles
 * from 108% of its size. The full-screen white flash on the knockout is gone. Reduced motion: the
 * words fade in where they stand.
 */
import type { MoveId, Side } from "@rankzero/core";
import { moveLine } from "../text/moves";
import { NAMES } from "../text/names";
import { PerkIcon } from "../ui/PerkIcon";
import type { Beats } from "./beats";
import { BEAT_MS, bannerAt, comboAt, easeIn } from "./beats";
import css from "./fight.module.css";

const fade = (ms: number, span: number, out: number): number => (ms > span - out ? Math.max(0, (span - ms) / out) : 1);

export function StageOverlay({ beats, t, reduced, names }: { beats: Beats; t: number; reduced: boolean; names: Readonly<Record<Side, string>> }) {
  const banner = bannerAt(beats, t);
  const combo = comboAt(beats, t);
  const sinceKo = beats.koAt === null ? -1 : t - beats.koAt;
  const stampMs = sinceKo - 260;
  return (
    <div className={css.overlay} aria-hidden="true">
      {banner !== null ? (() => {
        const { fire, ms, span } = banner;
        const e = easeIn(ms, BEAT_MS.bannerIn);
        const slide = reduced ? 0 : (1 - e) * -10;
        return (
          <div
            className={`${css.banner} ${fire.side === "a" ? css.bannerA : css.bannerB}`}
            data-move={fire.id}
            style={{ transform: `translateY(${slide.toFixed(2)}px) rotate(${fire.side === "a" ? -2 : 2}deg)`, opacity: e * fade(ms, span, BEAT_MS.bannerOut) }}
          >
            <span className={css.bannerHead}>
              <PerkIcon id={fire.id} size={28} className={css.bannerIcon} />
              <span className={css.bannerTitle}>
                <span className={css.bannerWho}>{names[fire.side]} uses</span>
                <span className={css.bannerName}>{NAMES[fire.id]}</span>
              </span>
            </span>
            <span className={css.bannerLine}>{moveLine(fire.id as MoveId)}</span>
          </div>
        );
      })() : null}
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
