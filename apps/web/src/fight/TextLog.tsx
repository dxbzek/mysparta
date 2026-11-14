/**
 * The live text log: one plain sentence per step, newest at the top, the last 6 visible and the
 * rest a scroll away. It shows the steps below `HudFrame.stepsShown` and nothing else. A polite
 * live region when the setting is on (brief 3.15).
 */
import { memo } from "react";
import type { Step } from "@rankzero/core";
import type { ActorNames } from "../text/log";
import { logLine } from "../text/log";
import css from "./fight.module.css";

/** The sentences shown for `stepsShown`, newest first. Pure, for the test. */
export function logLines(steps: readonly Step[], stepsShown: number, names: ActorNames): string[] {
  const out: string[] = [];
  const n = Math.max(0, Math.min(steps.length, stepsShown));
  for (let i = n - 1; i >= 0; i--) out.push(logLine(steps[i]!, names));
  return out;
}

function TextLogView({ steps, stepsShown, names, live, label = "Bout log" }: { steps: readonly Step[]; stepsShown: number; names: ActorNames; live: boolean; label?: string }) {
  const lines = logLines(steps, stepsShown, names);
  return (
    <ol className={css.log} aria-label={label} aria-live={live ? "polite" : "off"} aria-relevant="additions" reversed>
      {lines.map((line, i) => (
        <li key={lines.length - i} className={css.logLine}>{line}</li>
      ))}
    </ol>
  );
}

/** Re-renders only when the number of shown steps (or the setting) changes, not on every frame. */
export const TextLog = memo(TextLogView);
