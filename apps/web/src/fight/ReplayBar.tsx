/**
 * The replay scrub bar: it moves by event. Dragging seeks the fight clock to the end of a step:
 * the state is rebuilt from the log at once, with no sound and no leftover effects (brief 3.12).
 */
import css from "./fight.module.css";

/** The clock time that shows the first `n` steps done: the end of step n - 1, or 0. */
export function seekTimeFor(stepEnd: readonly number[], n: number): number {
  if (n <= 0) return 0;
  return stepEnd[Math.min(n, stepEnd.length) - 1] ?? 0;
}

export function ReplayBar({ stepsShown, total, onSeekStep }: { stepsShown: number; total: number; onSeekStep(n: number): void }) {
  return (
    <div className={css.replay}>
      <span>Replay</span>
      <input
        className={css.scrub}
        type="range"
        min={0}
        max={total}
        step={1}
        value={Math.min(stepsShown, total)}
        aria-label="Event"
        aria-valuetext={`Event ${Math.min(stepsShown, total)} of ${total}`}
        onChange={(e) => onSeekStep(Number(e.currentTarget.value))}
      />
      <span>{Math.min(stepsShown, total)}/{total}</span>
    </div>
  );
}
