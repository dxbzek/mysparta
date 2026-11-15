/**
 * The HUD over the stage (fight screen v2, after the owner's style-13 sample): mirrored name tapes
 * and level tags, HP bars with the trailing segment, big inked HP numbers and the turn badge in the
 * middle. It reads ONE thing that changes: the `HudFrame` for the current `t` (and `t` itself, for
 * the shake of a bar that was just hit). No timer, no state, no CSS animation.
 *
 * A bar that was just hit flashes and shakes: the size of both is the gap between the fill and
 * its trail, which the player already animates from the fight clock.
 */
import type { ActorId, ActorInit, Side } from "@rankzero/core";
import type { HudFrame } from "@rankzero/stage";
import { Sticker } from "../ui/Sticker";
import css from "./fight.module.css";

export interface HudSideInfo { name: string; level: number }

export interface HudProps {
  frame: HudFrame;
  sides: Readonly<Record<Side, HudSideInfo>>;
  actors: readonly ActorInit[];
  levelLabel?(n: number): string;
  /** The fight clock's time, for the hit shake. Absent: no shake. */
  t?: number;
  /** The turn badge. Absent: no badge. */
  turn?: number;
  reduced?: boolean;
}

const pct = (v: number, max: number): string => `${(max > 0 ? Math.max(0, Math.min(1, v / max)) * 100 : 0).toFixed(2)}%`;

/** How hard a bar reacts: 0 when the trail has caught up, 1 for a fresh loss of a quarter of the bar. */
export function hitGlow(now: number, trail: number, max: number): number {
  if (max <= 0) return 0;
  const g = ((trail - now) / max) * 4;
  return g <= 0 ? 0 : g > 1 ? 1 : g;
}

function SideHud({ side, frame, info, levelLabel, t, reduced }: { side: Side; frame: HudFrame; info: HudSideInfo; levelLabel(n: number): string; t?: number; reduced: boolean }) {
  const main = frame.hp[`${side}0` as ActorId];
  const max = main?.max ?? 0;
  const now = main ? Math.max(0, Math.round(main.now)) : 0;
  const g = hitGlow(main?.now ?? 0, main?.trail ?? 0, max);
  const shake = t !== undefined && !reduced && g > 0 ? Math.sin(t * 0.13 + (side === "a" ? 0 : 1.7)) * 4 * g : 0;
  return (
    <div className={`${css.side} ${side === "b" ? css.sideB : css.sideA}`} data-side={side}>
      <div className={css.nameRow}>
        <Sticker size="small" tilt={side === "a" ? -1.5 : 1.5} slap={frame.namesIn} className={css.tape}>{info.name}</Sticker>
        <span className={css.lvl}>{levelLabel(info.level)}</span>
      </div>
      <span
        className={css.hpBar}
        role="meter"
        aria-label={`${info.name} HP`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={now}
        style={shake !== 0 ? { transform: `translateX(${shake.toFixed(2)}px)` } : undefined}
      >
        <span className={css.hpTrail} style={{ width: pct(main?.trail ?? 0, max || 1) }} />
        <span className={css.hpFill} style={{ width: pct(main?.now ?? 0, max || 1) }} />
        {g > 0 ? <span className={css.hpFlash} style={{ opacity: (reduced ? 0.35 : 0.85) * g }} /> : null}
      </span>
    </div>
  );
}

function HpNumber({ side, frame }: { side: Side; frame: HudFrame }) {
  const main = frame.hp[`${side}0` as ActorId];
  const now = main ? Math.max(0, Math.round(main.now)) : 0;
  const g = hitGlow(main?.now ?? 0, main?.trail ?? 0, main?.max ?? 0);
  const style = g > 0 ? { transform: `scale(${(1 + 0.18 * g).toFixed(3)})` } : undefined;
  return <span className={`${css.hpNum} ${side === "b" ? css.hpNumB : ""} ${now === 0 ? css.hpZero : ""}`} data-hp={now} style={style}>{now}</span>;
}

export function Hud({ frame, sides, levelLabel = (n) => `LV ${n}`, t, turn, reduced = false }: HudProps) {
  return (
    <header className={css.hud}>
      <SideHud side="a" frame={frame} info={sides.a} levelLabel={levelLabel} t={t} reduced={reduced} />
      <div className={css.hudMid}>
        {turn !== undefined ? <span className={css.badge}>{turn > 0 ? `Turn ${turn}` : "Ready"}</span> : null}
        <div className={css.hpNums}>
          <HpNumber side="a" frame={frame} />
          <HpNumber side="b" frame={frame} />
        </div>
      </div>
      <SideHud side="b" frame={frame} info={sides.b} levelLabel={levelLabel} t={t} reduced={reduced} />
    </header>
  );
}
