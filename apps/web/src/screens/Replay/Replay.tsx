/**
 * G. Replay (brief 3.11 G): the fight screen with its scrub bar and no XP. A bout older than the
 * last 50 has no stored log; it is played again from its seed and snapshots, which gives the same
 * log (the sim is deterministic).
 */
import { useCallback, useMemo } from "react";
import { useDoc, useGame } from "../../app/context";
import type { Settings } from "../../contracts";
import { RigGate } from "../../app/RigGate";
import { FightScreen } from "../../fight/FightScreen";
import { UI } from "../../text/ui";
import { Panel } from "../../ui/Panel";
import common from "../common.module.css";

export function ReplayScreen({ id }: { id: string }) {
  const { core, actions, go, toast } = useGame();
  const doc = useDoc();
  const bout = doc.history.find((b) => b.id === id);
  const log = useMemo(() => {
    if (!bout) return null;
    try {
      return bout.log ?? core.simulateFight(bout.seed, bout.snapshotA, bout.snapshotB, 1);
    } catch (e) {
      console.warn("replay: could not rebuild the bout", e);
      return null;
    }
  }, [bout?.id, core]); // eslint-disable-line react-hooks/exhaustive-deps
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
