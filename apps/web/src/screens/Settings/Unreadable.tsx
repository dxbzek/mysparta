/**
 * Neither save slot could be read (brief 3.14). This is never treated as an empty save: the
 * bytes were copied to a backup key, and nothing is written until the player picks one of the two
 * ways out. A new save backs up the damaged slot before it replaces it.
 * Review r2: Reload is the primary way out; starting over is a plain button that asks once
 * before it acts; the paste box has a visible label; no storage key is shown to the player.
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
  const [confirming, setConfirming] = useState(false);
  return (
    <main className={css.unreadable} role="alert">
      <Panel title={failed ? UI.recovery.title : UI.recovery.unreadableTitle}>
        <div className={css.stack}>
          <p className={css.help}>{failed ? UI.recovery.failed : UI.recovery.unreadableLine}</p>
          {!failed ? <p className={css.help}>{backupKey ? UI.recovery.backupKey(backupKey) : UI.recovery.noBackup}</p> : null}
          <label className={css.codeLabel} htmlFor="rz-recover-code">{UI.recovery.pasteLabel}</label>
          <textarea id="rz-recover-code" className={css.code} value={paste} rows={3} placeholder={UI.recovery.pastePlaceholder} onChange={(e) => { setPaste(e.target.value); setBad(false); }} />
          <Button disabled={!paste.trim()} onClick={() => void actions.importCode(paste).then((r) => (r.ok ? go({ name: "locker" }) : setBad(true)), (e: Error) => toast(e.message))}>{UI.recovery.importInstead}</Button>
          {bad ? <p className={common.error}>{UI.settings.importBad}</p> : null}
          <Button variant="primary" onClick={() => location.reload()}>{failed ? UI.recovery.retry : UI.recovery.reload}</Button>
          {confirming ? (
            <div className={css.stack} role="group" aria-label={UI.recovery.newSave}>
              <p className={css.help}>{UI.recovery.newSaveConfirm}</p>
              <Button onClick={() => void actions.newSave().then(() => go({ name: "create" }), (e: Error) => toast(e.message))}>{UI.recovery.newSaveYes}</Button>
              <Button onClick={() => setConfirming(false)}>{UI.recovery.newSaveNo}</Button>
            </div>
          ) : (
            <Button onClick={() => setConfirming(true)}>{UI.recovery.newSave}</Button>
          )}
        </div>
      </Panel>
    </main>
  );
}
