import { useEffect, useMemo, useRef, useState } from "react";
import type { Discipline, FightResult } from "@agoge/core";
import { HopliteFigure, ImpactBurst, Laurel, type Palette } from "./art.js";
import { narrate, type Line } from "./narrate.js";

export interface StageFigure {
  palette: Palette;
  discipline: Discipline | "fists";
}

interface Props {
  result: FightResult;
  names: [string, string];
  figures: [StageFigure, StageFigure];
  onDone: () => void;
}

/**
 * The arena stage: chunky cartoon champions, impact bursts, floating damage
 * numbers, and a caption feed — all paced from the deterministic event log.
 */
export function FightTheatre({ result, names, figures, onDone }: Props) {
  const lines = useMemo(() => narrate(result, names), [result, names]);
  const [shown, setShown] = useState(1);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [skipped, setSkipped] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<1 | 2>(1);
  speedRef.current = speed;

  const finished = skipped || shown >= lines.length;

  useEffect(() => {
    if (finished) return;
    const line = lines[shown - 1];
    const hold = (line?.hold ?? 600) / speedRef.current;
    const id = window.setTimeout(() => setShown((s) => s + 1), hold);
    return () => window.clearTimeout(id);
  }, [shown, finished, lines, speed]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [shown, skipped]);

  const visible: Line[] = skipped ? lines : lines.slice(0, shown);
  const idx = visible.length;
  const current = visible[visible.length - 1];
  const hp = current?.hp ?? [result.hpMax[0], result.hpMax[1]];
  const winnerName = names[result.winner];
  const loser: 0 | 1 = result.winner === 0 ? 1 : 0;

  // Animation classes derived from the latest caption.
  const fx = !skipped ? current?.fx : undefined;
  const dealer = fx && !fx.heal ? (fx.target === 0 ? 1 : 0) : undefined;
  const figClass = (side: 0 | 1): string => {
    const cls: string[] = ["fig"];
    if (finished && side === loser && result.reason === "ko") cls.push("felled");
    else if (fx && !fx.heal && fx.target === side) cls.push("hurt");
    else if (dealer === side) cls.push(side === 0 ? "lunge-r" : "lunge-l");
    return cls.join(" ");
  };

  return (
    <div className="theatre">
      <div className="stage">
        <div className="stage-floor" />
        <div className="stage-hp">
          <HpBar name={names[0]} hp={hp[0]!} max={result.hpMax[0]} mirror={false} />
          <HpBar name={names[1]} hp={hp[1]!} max={result.hpMax[1]} mirror={true} />
        </div>
        <div className="vs-badge">VS</div>

        <div className="stage-figs">
          <div key={`a${idx}`} className={figClass(0)}>
            <HopliteFigure height={168} palette={figures[0].palette} discipline={figures[0].discipline} />
            {fx && fx.target === 0 && (
              <>
                {!fx.heal && (
                  <span className="burst on-right">
                    <ImpactBurst size={fx.crit ? 84 : 60} crit={!!fx.crit} />
                  </span>
                )}
                <span className={`floater ${fx.crit ? "crit" : ""} ${fx.heal ? "heal" : ""}`}>
                  {fx.heal ? `+${fx.amount}` : `−${fx.amount}`}
                </span>
              </>
            )}
          </div>
          <div key={`b${idx}`} className={figClass(1)}>
            <HopliteFigure height={168} palette={figures[1].palette} discipline={figures[1].discipline} mirror />
            {fx && fx.target === 1 && (
              <>
                {!fx.heal && (
                  <span className="burst on-left">
                    <ImpactBurst size={fx.crit ? 84 : 60} crit={!!fx.crit} />
                  </span>
                )}
                <span className={`floater ${fx.crit ? "crit" : ""} ${fx.heal ? "heal" : ""}`}>
                  {fx.heal ? `+${fx.amount}` : `−${fx.amount}`}
                </span>
              </>
            )}
          </div>
        </div>

        {finished && (
          <div className="verdict-wrap">
            <Laurel size={150} color={result.winner === 0 ? "#7c8a3a" : "#8a7550"} />
            <div className={`verdict ${result.winner === 0 ? "won" : "lost"}`}>
              {result.winner === 0 ? "VICTORY" : "DEFEAT"}
            </div>
            <div className="verdict-sub">
              {winnerName} · {result.ticks} ticks · sim v{result.simVersion}
            </div>
          </div>
        )}
      </div>

      <div className="feed" ref={feedRef} role="log" aria-live="polite">
        {visible.map((l, i) => (
          <p key={i} className={`line line-${l.kind} ${l.side === 0 ? "mine" : l.side === 1 ? "theirs" : "mid"}`}>
            {l.text}
          </p>
        ))}
      </div>

      <div className="theatre-controls">
        {!finished ? (
          <>
            <button className="btn ghost" onClick={() => setSpeed(speed === 1 ? 2 : 1)}>
              {speed === 1 ? "2× speed" : "1× speed"}
            </button>
            <button className="btn ghost" onClick={() => setSkipped(true)}>
              Skip
            </button>
          </>
        ) : (
          <button className="btn primary big" onClick={onDone}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function HpBar({ name, hp, max, mirror }: { name: string; hp: number; max: number; mirror: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round((hp / max) * 100)));
  return (
    <div className={`hpbar ${mirror ? "mirror" : ""}`}>
      <div className="hpbar-name">{name}</div>
      <div className="hpbar-track">
        <div
          className={`hpbar-fill ${pct <= 20 ? "danger" : pct <= 50 ? "warn" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="hpbar-num">
        {Math.max(0, hp)} / {max}
      </div>
    </div>
  );
}
