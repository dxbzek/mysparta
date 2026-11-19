/**
 * G. Replay (brief 3.11 G): the fight screen with its scrub bar and no XP. A bout older than the
 * last 50 has no stored log; it is played again from its seed and snapshots, which gives the same
 * log while the sim is the same. A bout made by an older sim (core SIM_VERSION) can come out
 * differently, so the rebuilt log is used only when its result equals the stored one; otherwise
 * the replay is refused (it would show a different fight, even a different winner).
 */
import { useCallback, useMemo } from "react";
import { useDoc, useGame } from "../../app/context";
import type { BoutLog, BoutResult, CoreApi } from "@rankzero/core";
import type { BoutRecord, Settings } from "../../contracts";
import { RigGate } from "../../app/RigGate";
import { FightScreen } from "../../fight/FightScreen";
import { UI } from "../../text/ui";
import { Panel } from "../../ui/Panel";
import common from "../common.module.css";

const sameResult = (x: BoutResult, y: BoutResult): boolean => x.winner === y.winner && x.reason === y.reason
  && x.turns === y.turns && x.hpPct.a === y.hpPct.a && x.hpPct.b === y.hpPct.b;

/** The log to replay: the stored one, or the bout played again when that gives the stored result.
 *  Null when it cannot be rebuilt (an older sim, or a broken record). */
export function replayLog(core: Pick<CoreApi, "simulateFight">, bout: BoutRecord): BoutLog | null {
  if (bout.log) return bout.log;
  try {
    const log = core.simulateFight(bout.seed, bout.snapshotA, bout.snapshotB, 1);
    if (sameResult(log.result, bout.result)) return log;
    console.warn("replay: this bout was made by an older version of the fight rules; it is not played again");
    return null;
  } catch (e) {
    console.warn("replay: could not rebuild the bout", e);
    return null;
  }
}

export function ReplayScreen({ id }: { id: string }) {
  const { core, actions, go, toast } = useGame();
  const doc = useDoc();
  const bout = doc.history.find((b) => b.id === id);
  const log = useMemo(() => (bout ? replayLog(core, bout) : null), [bout?.id, core]); // eslint-disable-line react-hooks/exhaustive-deps
  const onSettings = useCallback((patch: Partial<Settings>) => void actions.setSettings(patch).catch((e: Error) => toast(e.message)), [actions, toast]);
  const onFinished = useCallback(() => undefined, []);
  if (!bout || !log) return <main className={common.body}><Panel><p>{UI.replay.missing}</p></Panel></main>;
  return (
    <RigGate>
    <FightScreen
      log={log}
      a={bout.snapshotA}
      b={bout.snapshotB}
      mode="replay"
      settings={doc.settings}
      onSettings={onSettings}
      onFinished={onFinished}
      result={null}
      onResultAction={(a) => go(a === "locker" ? { name: "locker" } : { name: "bouts" })}
    />
    </RigGate>
  );
}
