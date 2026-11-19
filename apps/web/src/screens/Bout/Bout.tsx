/**
 * D. The bout (brief 3.11 D). The fight screen is the fight-screen lane's; this screen feeds it
 * the stored bout and the result card's numbers, and marks the bout watched when it ends or is
 * skipped. The save already holds the result: the result card shows the XP moving from the
 * `before` value. While a level-up is now waiting, "Next bout" is not offered.
 */
import { useCallback, useMemo } from "react";
import { useDoc, useGame } from "../../app/context";
import type { ResultCardData, Settings } from "../../contracts";
import { RigGate } from "../../app/RigGate";
import { FightScreen } from "../../fight/FightScreen";
import { resultLine } from "../../text/results";
import { UI } from "../../text/ui";
import { BOSS_LINES, RUNG_TITLE, rankLabel, rungRank } from "../../text/ladder";
import type { BossIntro, ResultAction } from "../../contracts";
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
    const left = rec ? core.energyNow(rec, clock.now()) : 0;
    if (bout.boss !== undefined) {
      // a boss bout: the boss has the last word, and a win shows the rank reached
      const lines = BOSS_LINES[bout.boss];
      return { won, line: `${bout.snapshotB.name}: "${won ? lines?.beaten ?? "" : lines?.gloat ?? ""}"`, xpBefore: bout.before.xp, xpAfter,
        xpToNext, levelUp, energy: levelUp ? 0 : left, boss: true,
        ...(won ? { rankUp: { rank: rungRank(bout.boss), title: RUNG_TITLE[bout.boss] ?? "" } } : {}) };
    }
    return { won, line: resultLine(bout.lineId, won, bout.snapshotA.name, bout.snapshotB.name), xpBefore: bout.before.xp, xpAfter,
      xpToNext, levelUp, energy: levelUp ? 0 : left };
  }, [bout?.id, rec?.id, core, clock]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSettings = useCallback((patch: Partial<Settings>) => void actions.setSettings(patch).catch((e: Error) => toast(e.message)), [actions, toast]);
  const onFinished = useCallback(() => void actions.markWatched(id).catch((e: Error) => toast(e.message)), [actions, id, toast]);
  const onAction = useCallback(async (a: ResultAction) => {
    await actions.markWatched(id).catch(() => undefined);
    if (a === "levelup") go({ name: "levelup" });
    else if (a === "prize") go({ name: "prize" });
    else if (a === "ladder") go({ name: "ladder" });
    else if (a === "next") go({ name: "card" });
    else if (a === "replay") go({ name: "replay", id });
    else go({ name: "locker" });
  }, [actions, go, id]);

  // a boss bout's banner, and both ranks in the HUD (the player's from before the bout)
  const intro: BossIntro | undefined = bout?.boss !== undefined
    ? { name: bout.snapshotB.name, title: `${rungRank(bout.boss)} · ${RUNG_TITLE[bout.boss] ?? ""}`, taunt: BOSS_LINES[bout.boss]?.taunt ?? "" } : undefined;
  const ranks = bout?.boss !== undefined ? { a: rankLabel(bout.boss - 1), b: rungRank(bout.boss) } : rec ? { a: rankLabel(core.ladderOf(rec).rank), b: "" } : undefined;
  if (!bout || !log || !result) {
    return <main className={common.body}><Panel><p>{UI.bout.missing}</p></Panel></main>;
  }
  return (
    <RigGate>
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
      {...(intro !== undefined ? { intro } : {})}
      {...(ranks !== undefined ? { ranks } : {})}
    />
    </RigGate>
  );
}
