/**
 * Neither save slot could be read (brief 3.14). This is never treated as an empty save: the
 * bytes were copied to a backup key, and nothing is written until the player picks one of the two
 * ways out. A new save backs up the damaged slot before it replaces it.
 */
import { useState } from "react";
import { useGame } from "../../app/context";
import { UI } from "../../text/ui";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import common from "../common.module.css";
import css from "./Settings.module.css";

export function Unreadable({ backupKey, failed }: { backupKey: string | null; failed?: boolean }) {
  const { actions, go, toast } = useGame();
  const [paste, setPaste] = useState("");
  const [bad, setBad] = useState(false);
  return (
    <main className={css.unreadable} role="alert">
      <Panel title={failed ? UI.recovery.title : UI.recovery.unreadableTitle}>
        <div className={css.stack}>
          <p className={css.help}>{failed ? UI.recovery.failed : UI.recovery.unreadableLine}</p>
          {!failed ? <p className={css.help}>{backupKey ? UI.recovery.backupKey(backupKey) : UI.recovery.noBackup}</p> : null}
          <textarea className={css.code} value={paste} rows={3} aria-label={UI.recovery.importInstead} onChange={(e) => { setPaste(e.target.value); setBad(false); }} />
          <Button disabled={!paste.trim()} onClick={() => void actions.importCode(paste).then((r) => (r.ok ? go({ name: "locker" }) : setBad(true)), (e: Error) => toast(e.message))}>{UI.recovery.importInstead}</Button>
          {bad ? <p className={common.error}>{UI.settings.importBad}</p> : null}
          <Button variant="primary" onClick={() => void actions.newSave().then(() => go({ name: "create" }), (e: Error) => toast(e.message))}>{UI.recovery.newSave}</Button>
          <Button onClick={() => location.reload()}>{failed ? UI.recovery.retry : UI.recovery.reload}</Button>
        </div>
      </Panel>
    </main>
  );
}
