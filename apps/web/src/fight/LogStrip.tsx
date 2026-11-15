/**
 * The slim log strip under the stage: the newest two sentences, the newest bold, skill and Move
 * names coloured, and the "Log" button that opens the full text log in a sheet. It shows the
 * steps below `HudFrame.stepsShown` and nothing else.
 */
import { memo } from "react";
import type { Side, Step } from "@rankzero/core";
import { sideOf } from "@rankzero/core";
import type { ActorNames } from "../text/log";
import { logLine } from "../text/log";
import { NAMES } from "../text/names";
import css from "./fight.module.css";

export interface LogPart { text: string; skill?: Side }

/** One strip line as parts: a skill that fired leads in capitals, a Move name is marked. Pure. */
export function stripParts(step: Step, names: ActorNames): LogPart[] {
  const line = logLine(step, names);
  const parts: LogPart[] = [];
  if ("procs" in step && step.procs && step.procs[0]) {
    const p = step.procs[0];
    parts.push({ text: `${NAMES[p.skill].toUpperCase()}.`, skill: sideOf(p.by) }, { text: " " });
  }
  if (step.t === "move") {
    const name = NAMES[step.move];
    const at = line.indexOf(name);
    if (at >= 0) {
      parts.push({ text: line.slice(0, at) }, { text: name.toUpperCase(), skill: sideOf(step.actor) }, { text: line.slice(at + name.length) });
      return parts;
    }
  }
  parts.push({ text: line });
  return parts;
}

/** The newest `n` steps shown at `stepsShown`, newest first. Pure. */
export function stripSteps(steps: readonly Step[], stepsShown: number, n = 2): Step[] {
  const out: Step[] = [];
  for (let i = Math.min(steps.length, stepsShown) - 1; i >= 0 && out.length < n; i--) out.push(steps[i]!);
  return out;
}

function LogStripView({ steps, stepsShown, names, live, onOpen }: { steps: readonly Step[]; stepsShown: number; names: ActorNames; live: boolean; onOpen(): void }) {
  const lines = stripSteps(steps, stepsShown);
  return (
    <div className={css.strip}>
      <ol className={css.stripLines} aria-label="Latest in the bout" aria-live={live ? "polite" : "off"} aria-relevant="additions">
        {lines.length === 0 ? <li className={css.stripLine}>&nbsp;</li> : null}
        {lines.map((s, i) => (
          <li key={stepsShown - i} className={`${css.stripLine} ${i === 0 ? css.stripNew : ""}`}>
            {stripParts(s, names).map((p, j) => (
              <span key={j} className={p.skill === "a" ? css.skillA : p.skill === "b" ? css.skillB : undefined}>{p.text}</span>
            ))}
          </li>
        ))}
      </ol>
      <button type="button" className={css.logButton} onClick={onOpen} aria-label="Open the full bout log">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
        <span>Log</span>
      </button>
    </div>
  );
}

/** Re-renders only when the number of shown steps changes. */
export const LogStrip = memo(LogStripView);
