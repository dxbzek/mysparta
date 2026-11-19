/**
 * The result card, over the bottom of the full-screen stage (the camera keeps the outro clear of
 * it: stage CAMERA.resultRoomPx). It slides up and its XP bar fills, both from `HudFrame.resultIn`
 * (0 to 1, from the fight clock): no CSS animation, no timer. In replay mode there is no XP:
 * the card names the winner and offers Replay and Locker.
 */
import type { ResultAction, ResultCardData } from "../contracts";
import { Button } from "../ui/Button";
import css from "./fight.module.css";

export type { ResultAction };

const ease = (u: number): number => 1 - (1 - u) * (1 - u) * (1 - u);

/** Where the card is and how full the XP bar is at `resultIn`. Pure. */
export function resultPose(resultIn: number): { slide: number; fill: number } {
  const u = resultIn < 0 ? 0 : resultIn > 1 ? 1 : resultIn;
  return { slide: ease(Math.min(1, u * 3)), fill: ease(Math.max(0, (u - 0.3) / 0.7)) };
}

function LogLink({ onLog }: { onLog?(): void }) {
  return onLog ? <button type="button" className={css.resultLog} onClick={onLog} aria-label="Open the bout log and the fighter cards">Log</button> : null;
}

export function ResultCard({ resultIn, data, winnerName, onAction, doneLabel = "Locker", onLog }: { resultIn: number; data: ResultCardData | null; winnerName: string; onAction(a: ResultAction): void; doneLabel?: string; onLog?(): void }) {
  const { slide, fill } = resultPose(resultIn);
  const style = { transform: `translateY(${((1 - slide) * 115).toFixed(2)}%)` };
  if (data === null) {
    return (
      <section className={css.result} style={style} aria-label="Result">
        <div className={css.resultHead}>
          <h2 className={`${css.verdict} ${css.verdictWin}`}>{winnerName.toUpperCase()} WINS</h2>
          <LogLink onLog={onLog} />
        </div>
        <div className={css.resultButtons}>
          <Button variant="primary" onClick={() => onAction("replay")}>Replay</Button>
          <Button onClick={() => onAction("locker")}>{doneLabel}</Button>
        </div>
      </section>
    );
  }
  const xpNow = data.xpBefore + (data.xpAfter - data.xpBefore) * fill;
  const shown = Math.round(xpNow);
  const pct = data.xpToNext > 0 ? Math.min(1, xpNow / data.xpToNext) : 1;
  const buttons: { a: ResultAction; label: string }[] = [];
  if (data.levelUp) buttons.push({ a: "levelup", label: "Level up!" });
  else if (data.rankUp !== undefined) buttons.push({ a: "prize", label: "Claim prize" });
  if (data.boss === true) buttons.push({ a: "ladder", label: "Ladder" });
  else if (data.energy > 0) buttons.push({ a: "next", label: "Next bout" });
  buttons.push({ a: "replay", label: "Replay" }, { a: "locker", label: "Locker" });
  return (
    <section className={css.result} style={style} aria-label="Result">
      <div className={css.resultHead}>
        <h2 className={`${css.verdict} ${data.won ? css.verdictWin : css.verdictLoss}`}>{data.won ? "WIN" : "LOSS"}</h2>
        <p className={css.resultLine}>{data.line}</p>
        <LogLink onLog={onLog} />
      </div>
      {data.rankUp !== undefined ? (
        <p className={css.rankUp} data-testid="rank-up"><b>RANK UP!</b> <span>{data.rankUp.rank}: {data.rankUp.title}</span></p>
      ) : null}
      <div className={css.xpRow}>
        <span>XP</span>
        <span className={css.xpTrack} role="progressbar" aria-label="XP" aria-valuemin={0} aria-valuemax={data.xpToNext} aria-valuenow={shown}>
          <span className={css.xpFill} style={{ width: `${(pct * 100).toFixed(2)}%` }} />
        </span>
        <span>{shown} / {data.xpToNext}</span>
      </div>
      <div className={css.resultButtons}>
        {buttons.map((b, i) => (
          <Button key={b.a} variant={i === 0 ? "primary" : "secondary"} onClick={() => onAction(b.a)}>{b.label}</Button>
        ))}
      </div>
    </section>
  );
}
