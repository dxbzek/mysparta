/**
 * The log's newest line (it was the strip under the stage until the stage-only fight screen, owner
 * 19 Nov 2026): the sentence parts with a fired skill leading, and the visually hidden live region
 * that reads the newest step aloud. It shows the steps below `HudFrame.stepsShown` and nothing else.
 */
import { memo } from "react";
import type { Side, Step } from "@rankzero/core";
import { sideOf } from "@rankzero/core";
import type { ActorNames } from "../text/log";
import { logLine } from "../text/log";
import { procName } from "../text/talents";
import { NAMES } from "../text/names";

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

/** The live line: the newest sentence, read aloud as a polite live region when the "Read the bout
 *  log aloud" setting is on (brief 3.15). Since the stage-only fight screen (owner, 19 Nov 2026)
 *  nothing of the log shows under the stage, so this region is visually hidden; the full log is in
 *  the fight drawer. Skill and Move names lead as in the log's own words. */
function LiveLineView({ steps, stepsShown, names, live }: { steps: readonly Step[]; stepsShown: number; names: ActorNames; live: boolean }) {
  const newest = stripSteps(steps, stepsShown, 1)[0];
  return (
    <p className="rz-visually-hidden" aria-live={live ? "polite" : "off"} aria-atomic="true" data-live-line="">
      {newest ? stripParts(newest, names).map((p) => p.text).join("") : ""}
    </p>
  );
}

/** Re-renders only when the number of shown steps changes. */
export const LiveLine = memo(LiveLineView);
