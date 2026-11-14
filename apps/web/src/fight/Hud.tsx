/**
 * The HUD over the stage (64 px, mirrored). It reads ONE thing that changes: the `HudFrame`
 * the player gives for the current `t`. The names, levels and actor kinds are fixed for the
 * bout. No timer, no state, no CSS animation.
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
}

const pct = (v: number, max: number): string => `${(max > 0 ? Math.max(0, Math.min(1, v / max)) * 100 : 0).toFixed(2)}%`;

function SideHud({ side, frame, info, actors, levelLabel }: { side: Side; frame: HudFrame; info: HudSideInfo; actors: readonly ActorInit[]; levelLabel(n: number): string }) {
  const main = frame.hp[`${side}0` as ActorId];
  const now = main ? Math.max(0, Math.round(main.now)) : 0;
  const pets = actors.filter((a) => a.id.startsWith(side) && a.kind !== "scrapper");
  return (
    <div className={`${css.side} ${side === "b" ? css.sideB : ""}`} data-side={side}>
      <div className={css.nameRow}>
        <Sticker size="small" tilt={side === "a" ? -1.5 : 1.5} slap={frame.namesIn}>{info.name}</Sticker>
        <span className={css.lvl}>{levelLabel(info.level)}</span>
      </div>
      <div className={css.hpRow}>
        <span
          className={css.hpBar}
          role="meter"
          aria-label={`${info.name} HP`}
          aria-valuemin={0}
          aria-valuemax={main?.max ?? 0}
          aria-valuenow={now}
        >
          <span className={css.hpTrail} style={{ width: pct(main?.trail ?? 0, main?.max ?? 1) }} />
          <span className={css.hpFill} style={{ width: pct(main?.now ?? 0, main?.max ?? 1) }} />
        </span>
        <span className={css.hpNum} data-hp={now}>{now}</span>
      </div>
      {pets.length > 0 ? (
        <div className={css.pets}>
          {pets.map((p) => {
            const hp = frame.hp[p.id];
            return (
              <span key={p.id} className={css.petBar} role="meter" aria-label={`${p.kind} HP`} aria-valuemin={0} aria-valuemax={hp?.max ?? 0} aria-valuenow={Math.round(hp?.now ?? 0)}>
                <span className={css.hpTrail} style={{ width: pct(hp?.trail ?? 0, hp?.max ?? 1) }} />
                <span className={css.hpFill} style={{ width: pct(hp?.now ?? 0, hp?.max ?? 1) }} />
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function Hud({ frame, sides, actors, levelLabel = (n) => `LV ${n}` }: HudProps) {
  return (
    <div className={css.hud}>
      <SideHud side="a" frame={frame} info={sides.a} actors={actors} levelLabel={levelLabel} />
      <SideHud side="b" frame={frame} info={sides.b} actors={actors} levelLabel={levelLabel} />
    </div>
  );
}
