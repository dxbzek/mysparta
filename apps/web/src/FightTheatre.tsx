import { useEffect, useMemo, useRef, useState } from "react";
import type { FightResult } from "@agoge/core";
import { narrate, type Line } from "./narrate.js";

interface Props {
  result: FightResult;
  names: [string, string];
  onDone: () => void;
}

/**
 * DOM fight theatre (prototype): paces the deterministic event log into a
 * 30–45 s presentation with 1×/2×/skip. PixiJS staging arrives with real
 * art in the MVP (06-ui-ux.md §7).
 */
export function FightTheatre({ result, names, onDone }: Props) {
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
  const current = visible[visible.length - 1];
  const hp = current?.hp ?? [result.hpMax[0], result.hpMax[1]];
  const winnerName = names[result.winner];

  return (
    <div className="theatre">
      <div className="theatre-hp">
        <HpBar name={names[0]} hp={hp[0]!} max={result.hpMax[0]} mirror={false} />
        <div className="vs">VS</div>
        <HpBar name={names[1]} hp={hp[1]!} max={result.hpMax[1]} mirror={true} />
      </div>

      <div className="feed" ref={feedRef} role="log" aria-live="polite">
        {visible.map((l, i) => (
          <p key={i} className={`line line-${l.kind} ${l.side === 0 ? "mine" : l.side === 1 ? "theirs" : "mid"}`}>
            {l.text}
          </p>
        ))}
        {finished && (
          <div className={`verdict ${result.winner === 0 ? "won" : "lost"}`}>
            {result.winner === 0 ? "VICTORY" : "DEFEAT"}
            <span className="verdict-sub">
              {winnerName} — {result.ticks} ticks, sim v{result.simVersion}, seed {result.seed >>> 0}
            </span>
          </div>
        )}
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
          <button className="btn primary" onClick={onDone}>
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
