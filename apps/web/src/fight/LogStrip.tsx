/**
 * The log strip under the stage: the newest two sentences (more when the phone has room), the newest bold, skill and Move
 * names coloured, and the "Log" button that opens the full text log in a sheet. It shows the
 * steps below `HudFrame.stepsShown` and nothing else.
 */
import { memo } from "react";
import type { Side, Step } from "@rankzero/core";
import { sideOf } from "@rankzero/core";
import type { ActorNames } from "../text/log";
import { logLine } from "../text/log";
import { procName } from "../text/talents";
import { NAMES } from "../text/names";
import css from "./fight.module.css";

export interface LogPart { text: string; skill?: Side }

/** One strip line as parts: a skill that fired leads in capitals, a Move name is marked. Pure. */
export function stripParts(step: Step, names: ActorNames): LogPart[] {
  const line = logLine(step, names);
  const parts: LogPart[] = [];
  if ("procs" in step && step.procs && step.procs[0]) {
    const p = step.procs[0];
    parts.push({ text: `${procName(p.skill).toUpperCase()}.`, skill: sideOf(p.by) }, { text: " " });
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

/** Older lines shown under the newest two when the phone has spare height (review r2: the room
 *  under the cards was an empty band). They sit in a box that adds no height of its own, so on a
 *  short phone they simply do not show. */
export const STRIP_MORE = 8;

function Line({ step, names, cls }: { step: Step; names: ActorNames; cls: string | undefined }) {
  return (
    <li className={cls}>
      {stripParts(step, names).map((p, j) => (
        <span key={j} className={p.skill === "a" ? css.skillA : p.skill === "b" ? css.skillB : undefined}>{p.text}</span>
      ))}
    </li>
  );
}

function LogStripView({ steps, stepsShown, names, live, note = null, onOpen }: { steps: readonly Step[]; stepsShown: number; names: ActorNames; live: boolean; note?: string | null; onOpen(): void }) {
  const all = stripSteps(steps, stepsShown, 2 + STRIP_MORE);
  const lines = all.slice(0, 2);
  const more = all.slice(2);
  return (
    <div className={css.strip}>
      <div className={css.stripCol}>
        {/* a short note (the locked 3x) shows here, never on the stage where the damage numbers
            and tags are (owner: numbers and tags never overlap). The status box is always there,
            so a screen reader hears the note when it fills. */}
        <p className={note ? css.stripNote : "rz-visually-hidden"} role="status">{note ?? ""}</p>
        <ol className={css.stripLines} aria-label="Latest in the bout" aria-live={live ? "polite" : "off"} aria-relevant="additions">
          {lines.length === 0 ? <li className={css.stripLine}>&nbsp;</li> : null}
          {lines.map((s, i) => <Line key={stepsShown - i} step={s} names={names} cls={`${css.stripLine} ${i === 0 ? css.stripNew : ""}`} />)}
        </ol>
        {/* earlier lines repeat what was already announced, and the full log is one tap away */}
        <div className={css.stripMoreBox} aria-hidden="true">
          <ol className={css.stripMore}>
            {more.map((s, i) => <Line key={stepsShown - 2 - i} step={s} names={names} cls={css.stripLine} />)}
          </ol>
        </div>
      </div>
      <button type="button" className={css.logButton} onClick={onOpen} aria-label="Open the full bout log">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
        <span>Log</span>
      </button>
    </div>
  );
}

/** Re-renders only when the number of shown steps changes. */
export const LogStrip = memo(LogStripView);
