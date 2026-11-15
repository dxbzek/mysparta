/**
 * The DOM layer over the stage canvas (owner: "have some energy"): the skill banner that slams in
 * when a skill or a Move fires, the combo counter ("x2", "x3"), and the knockout finish (a white
 * flash on the killing blow, then a "K.O." stamp). Every value is a pure function of `t` and the
 * beats read once from the log: no timer, no state, no CSS animation (brief 3.12, one clock).
 * Reduced motion: no flash, no slam scale, no shake; the words still show.
 */
import type { Side } from "@rankzero/core";
import { NAMES } from "../text/names";
import { perkText } from "../text/perks";
import type { Beats } from "./beats";
import { BEAT_MS, bannerAt, comboAt, slam } from "./beats";
import css from "./fight.module.css";

const fade = (ms: number, span: number, out: number): number => (ms > span - out ? Math.max(0, (span - ms) / out) : 1);

export function StageOverlay({ beats, t, reduced, names }: { beats: Beats; t: number; reduced: boolean; names: Readonly<Record<Side, string>> }) {
  const banner = bannerAt(beats, t);
  const combo = comboAt(beats, t);
  const sinceKo = beats.koAt === null ? -1 : t - beats.koAt;
  const flash = !reduced && sinceKo >= 0 && sinceKo < BEAT_MS.flash ? 0.85 * (1 - sinceKo / BEAT_MS.flash) : 0;
  const stampMs = sinceKo - 260;
  return (
    <div className={css.overlay} aria-hidden="true">
      {banner !== null ? (() => {
        const { fire, ms } = banner;
        const s = reduced ? 1 : slam(ms, BEAT_MS.bannerIn);
        const line = perkText(fire.id).effect;
        return (
          <div
            className={`${css.banner} ${fire.side === "a" ? css.bannerA : css.bannerB}`}
            style={{ transform: `rotate(${fire.side === "a" ? -3 : 3}deg) scale(${s.toFixed(3)})`, opacity: fade(ms, BEAT_MS.fire, BEAT_MS.bannerOut) }}
          >
            <span className={css.bannerWho}>{names[fire.side]}{fire.kind === "move" ? " uses" : ""}</span>
            <span className={css.bannerName}>{NAMES[fire.id]}</span>
            <span className={css.bannerLine}>{line}</span>
          </div>
        );
      })() : null}
      {combo !== null ? (
        <div
          className={`${css.combo} ${combo.combo.side === "a" ? css.comboA : css.comboB}`}
          style={{ transform: `rotate(${combo.combo.side === "a" ? -8 : 8}deg) scale(${(reduced ? 1 : slam(combo.ms, 110)).toFixed(3)})`, opacity: fade(combo.ms, BEAT_MS.combo, 200) }}
        >
          <small>COMBO</small>x{combo.combo.count}
        </div>
      ) : null}
      {flash > 0 ? <div className={css.flash} style={{ opacity: flash }} /> : null}
      {stampMs >= 0 && beats.koSide !== null ? (
        <div className={css.koStamp} style={{ transform: `rotate(-9deg) scale(${(reduced ? 1 : slam(stampMs, BEAT_MS.stampIn)).toFixed(3)})` }}>K.O.</div>
      ) : null}
    </div>
  );
}
