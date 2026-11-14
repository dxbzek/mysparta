/**
 * D. The bout (brief 3.11 D). The fight screen is the fight-screen lane's; this screen feeds it
 * the stored bout and the result card's numbers, and marks the bout watched when it ends or is
 * skipped. The save already holds the result: the result card shows the XP moving from the
 * `before` value. While a level-up is now waiting, "Next bout" is not offered.
 */
import { useCallback, useMemo } from "react";
import { useDoc, useGame } from "../../app/context";
import type { ResultCardData, Settings } from "../../contracts";
import { FightScreen } from "../../fight/FightScreen";
import { resultLine } from "../../text/results";
import { UI } from "../../text/ui";
import { Panel } from "../../ui/Panel";
import common from "../common.module.css";

export function BoutScreen({ id }: { id: string }) {
  const { core, clock, actions, go, toast } = useGame();
  const doc = useDoc();
  const bout = doc.history.find((b) => b.id === id);
  const rec = bout ? doc.fighters.find((f) => f.id === bout.fighterId) : undefined;
  const log = useMemo(() => (bout ? bout.log ?? core.simulateFight(bout.seed, bout.snapshotA, bout.snapshotB, 1) : null), [bout?.id, core]); // eslint-disable-line react-hooks/exhaustive-deps

  const result: ResultCardData | null = useMemo(() => {
    if (!bout) return null;
    const won = bout.result.winner === "a";
    const xpToNext = core.xpToNext(bout.snapshotA.level);
    const xpAfter = bout.before.xp + bout.xp;
    const levelUp = xpAfter >= xpToNext;
    const left = rec ? core.boutsLeft(rec, clock.today()) : 0;
    return { won, line: resultLine(bout.lineId, won, bout.snapshotA.name, bout.snapshotB.name), xpBefore: bout.before.xp, xpAfter,
      xpToNext, levelUp, boutsLeft: levelUp ? 0 : left };
  }, [bout?.id, rec?.id, core, clock]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSettings = useCallback((patch: Partial<Settings>) => void actions.setSettings(patch).catch((e: Error) => toast(e.message)), [actions, toast]);
  const onFinished = useCallback(() => void actions.markWatched(id).catch((e: Error) => toast(e.message)), [actions, id, toast]);
  const onAction = useCallback(async (a: "levelup" | "next" | "replay" | "locker") => {
    await actions.markWatched(id).catch(() => undefined);
    if (a === "levelup") go({ name: "levelup" });
    else if (a === "next") go({ name: "card" });
    else if (a === "replay") go({ name: "replay", id });
    else go({ name: "locker" });
  }, [actions, go, id]);

  if (!bout || !log || !result) {
    return <main className={common.body}><Panel><p>{UI.bout.missing}</p></Panel></main>;
  }
  return (
    <FightScreen
      log={log}
      a={bout.snapshotA}
      b={bout.snapshotB}
      mode="live"
      settings={doc.settings}
      onSettings={onSettings}
      onFinished={onFinished}
      result={result}
      onResultAction={(a) => void onAction(a)}
    />
  );
}
