/**
 * The HUD over the stage (since 19 Nov 2026 an overlay on the full-screen stage; fight screen v2, after the owner's style-13 sample): mirrored name tapes
 * and level tags, HP bars with the trailing segment, big inked HP numbers and the turn badge in the
 * middle. It reads ONE thing that changes: the `HudFrame` for the current `t` (and `t` itself, for
 * a bar that was just hit). No timer, no state, no CSS animation.
 *
 * A bar that was just hit lights up a little: the size is the gap between the fill and its trail,
 * which the player already animates from the fight clock. It never shakes or swells (calm camera,
 * owner 15 Nov 2026: "I'm getting dizzy watching it").
 */
import type { ActorId, ActorInit, Side } from "@rankzero/core";
import type { HudFrame } from "@rankzero/stage";
import { Sticker } from "../ui/Sticker";
import { nameSize } from "./FighterCard";
import css from "./fight.module.css";

const sizeClass = (name: string): string => { const k = nameSize(name); return k === "long" ? css.nameLong! : k === "mid" ? css.nameMid! : ""; };

/** `rank` (the ladder): a short rank tag beside the level ("R10", "R0"), with its words for a screen reader. */
export interface HudSideInfo { name: string; level: number; rank?: { short: string; label: string } }

export interface HudProps {
  frame: HudFrame;
  sides: Readonly<Record<Side, HudSideInfo>>;
  actors: readonly ActorInit[];
  levelLabel?(n: number): string;
  /** The fight clock's time. Kept for hosts that pass it; the bars no longer shake (calm camera). */
  t?: number;
  /** The turn badge. Absent: no badge. */
  turn?: number;
  reduced?: boolean;
  /** A tap on a side's name and HP bar opens that fighter's card (the fight drawer). Absent: plain. */
  onCard?(side: Side): void;
}

const pct = (v: number, max: number): string => `${(max > 0 ? Math.max(0, Math.min(1, v / max)) * 100 : 0).toFixed(2)}%`;

/** How hard a bar reacts: 0 when the trail has caught up, 1 for a fresh loss of a quarter of the bar. */
export function hitGlow(now: number, trail: number, max: number): number {
  if (max <= 0) return 0;
  const g = ((trail - now) / max) * 4;
  return g <= 0 ? 0 : g > 1 ? 1 : g;
}

function SideHud({ side, frame, info, levelLabel, reduced, onCard }: { side: Side; frame: HudFrame; info: HudSideInfo; levelLabel(n: number): string; reduced: boolean; onCard?(side: Side): void }) {
  const main = frame.hp[`${side}0` as ActorId];
  const max = main?.max ?? 0;
  const now = main ? Math.max(0, Math.round(main.now)) : 0;
  const g = hitGlow(main?.now ?? 0, main?.trail ?? 0, max);
  const body = (
    <>
      <div className={css.nameRow}>
        <Sticker size="small" tilt={side === "a" ? -1.5 : 1.5} slap={frame.namesIn} className={`${css.tape} ${sizeClass(info.name)}`}>{info.name}</Sticker>
        <span className={css.lvl}>{levelLabel(info.level)}</span>
      </div>
      <span
        className={css.hpBar}
        role="meter"
        aria-label={`${info.name} HP`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={now}
      >
        <span className={css.hpTrail} style={{ width: pct(main?.trail ?? 0, max || 1) }} />
        <span className={css.hpFill} style={{ width: pct(main?.now ?? 0, max || 1) }} />
        {g > 0 ? <span className={css.hpFlash} style={{ opacity: (reduced ? 0.25 : 0.4) * g }} /> : null}
      </span>
      {/* the rank (the ladder) hangs under the HP bar, so the name keeps its room and the HUD its height */}
      {info.rank !== undefined ? <span className={css.rankTag} data-testid={`hud-rank-${side}`}>{info.rank.label}</span> : null}
    </>
  );
  const cls = `${css.side} ${side === "b" ? css.sideB : css.sideA}`;
  // over the stage the whole name-and-bar block is one 44 px button to that fighter's card
  return onCard ? (
    <button type="button" className={`${cls} ${css.sideButton}`} data-side={side} onClick={() => onCard(side)} aria-label={`${info.name}, ${levelLabel(info.level)}${info.rank !== undefined ? `, ${info.rank.label}` : ""}, ${now} of ${max} HP. Open the fighter card.`}>{body}</button>
  ) : <div className={cls} data-side={side}>{body}</div>;
}

function hpOf(side: Side, frame: HudFrame): number {
  const main = frame.hp[`${side}0` as ActorId];
  return main ? Math.max(0, Math.round(main.now)) : 0;
}

function HpNumber({ side, frame }: { side: Side; frame: HudFrame }) {
  const now = hpOf(side, frame);
  return <span className={`${css.hpNum} ${side === "b" ? css.hpNumB : css.hpNumA} ${now === 0 ? css.hpZero : ""}`} data-hp={now}>{now}</span>;
}

export function Hud({ frame, sides, levelLabel = (n) => `LV ${n}`, turn, reduced = false, onCard }: HudProps) {
  return (
    <header className={css.hud}>
      <SideHud side="a" frame={frame} info={sides.a} levelLabel={levelLabel} reduced={reduced} onCard={onCard} />
      <div className={css.hudMid}>
        {turn !== undefined ? <span className={css.badge}>{turn > 0 ? `Turn ${turn}` : "Ready"}</span> : null}
        {/* review r2: two bare numbers side by side read as a score; each now wears its side's
            colour, with an HP divider between them */}
        <div className={css.hpNums} role="group" aria-label={`${sides.a.name} ${hpOf("a", frame)} HP, ${sides.b.name} ${hpOf("b", frame)} HP`}>
          <HpNumber side="a" frame={frame} />
          <span className={css.hpSep} aria-hidden="true">HP</span>
          <HpNumber side="b" frame={frame} />
        </div>
      </div>
      <SideHud side="b" frame={frame} info={sides.b} levelLabel={levelLabel} reduced={reduced} onCard={onCard} />
    </header>
  );
}
