/**
 * The settings sheet (brief 3.11): sound, reduced motion (follow system / on / off), the live log,
 * export and import of the save code, credits. Plus a TEMPORARY "VIP (test)" switch under the
 * test arena, so the owner can try 3x fight speed before the shop sells VIP (plan 13.13).
 */
import { useEffect, useState } from "react";
import { useDoc, useGame } from "../../app/context";
import { sharedAudio } from "../../audio/engine";
import type { Settings } from "../../contracts";
import { summaryOf } from "../../state/actions";
import type { SaveSummary } from "../../state/actions";
import type { BackupEntry } from "../../state/slots";
import { UI } from "../../text/ui";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import common from "../common.module.css";
import css from "./Settings.module.css";

function Choice<T extends string | boolean>({ label, value, options, onPick }: { label: string; value: T; options: readonly { v: T; label: string }[]; onPick(v: T): void }) {
  return (
    <div className={css.setting} role="radiogroup" aria-label={label}>
      <span className={css.settingName}>{label}</span>
      <span className={css.choices}>
        {options.map((o) => (
          <Button key={String(o.v)} role="radio" aria-checked={o.v === value} variant={o.v === value ? "dark" : "secondary"} onClick={() => onPick(o.v)}>{o.label}</Button>
        ))}
      </span>
    </div>
  );
}

/** A volume slider, 0 to 100 in steps of 5. It moves the sound live while dragged and saves when
 *  let go (one write, not one per pixel). */
function Volume({ label, value, disabled, onLive, onCommit }: { label: string; value: number; disabled: boolean; onLive(v: number): void; onCommit(v: number): void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = (): void => { if (v !== value) onCommit(v); };
  return (
    <label className={css.setting}>
      <span className={css.settingName}>{label} <span className={css.volumeValue}>{UI.settings.volume(v)}</span></span>
      <input className={css.slider} type="range" min={0} max={100} step={5} value={v} disabled={disabled} aria-label={label}
        aria-valuetext={UI.settings.volume(v)}
        onChange={(e) => { const n = Number(e.currentTarget.value); setV(n); onLive(n); }}
        onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
    </label>
  );
}

export function SettingsSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { actions, toast } = useGame();
  const doc = useDoc();
  const s = doc.settings;
  const [code, setCode] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  /** The code's contents, waiting for the player to confirm the replace (finding 38). */
  const [pending, setPending] = useState<SaveSummary | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [restoreKey, setRestoreKey] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void actions.listBackups().then((b) => { if (live) setBackups(b); }, () => undefined);
    return () => { live = false; };
  }, [open, actions, doc.rev]);
  const mine = summaryOf(doc);
  const doImport = (): void => void actions.importCode(paste).then((r) => {
    setPending(null);
    setMsg(r.ok ? UI.settings.importDone : UI.settings.importBad);
    if (r.ok) setPaste("");
  }, (e: Error) => { setPending(null); setMsg(e.message); });
  const doRestore = (key: string): void => void actions.restoreBackup(key).then((r) => {
    setRestoreKey(null);
    toast(r.ok ? UI.settings.restoreDone : UI.settings.importBad);
  }, (e: Error) => { setRestoreKey(null); toast(e.message); });
  const set = (patch: Partial<Settings>): void => void actions.setSettings(patch).catch((e: Error) => toast(e.message));
  const onOff = [{ v: true, label: UI.settings.on }, { v: false, label: UI.settings.off }] as const;
  return (
    <Sheet open={open} title={UI.settings.title} onClose={onClose}>
      <div className={css.body}>
        <Choice label={UI.settings.sound} value={s.sound} options={onOff} onPick={(v) => set({ sound: v })} />
        <Volume label={UI.settings.music} value={s.musicVolume} disabled={!s.sound}
          onLive={(n) => sharedAudio().setVolumes({ music: n / 100, sfx: s.sfxVolume / 100 })} onCommit={(n) => set({ musicVolume: n })} />
        <Volume label={UI.settings.effects} value={s.sfxVolume} disabled={!s.sound}
          onLive={(n) => sharedAudio().setVolumes({ music: s.musicVolume / 100, sfx: n / 100 })} onCommit={(n) => set({ sfxVolume: n })} />
        <Choice label={UI.settings.motion} value={s.reducedMotion} options={[{ v: "system", label: UI.settings.motionSystem }, { v: "on", label: UI.settings.on }, { v: "off", label: UI.settings.off }] as const} onPick={(v) => set({ reducedMotion: v })} />
        <Choice label={UI.settings.liveLog} value={s.liveLog} options={onOff} onPick={(v) => set({ liveLog: v })} />

        <section className={css.block}>
          <h3 className={css.blockTitle}>{UI.settings.testing}</h3>
          {/* TEMPORARY: VIP test switch. Remove when the shop sells VIP (plan 13.13). Turning it
              off drops a 3x speed to 2x, so the save never keeps a speed it cannot play. */}
          <Choice label={UI.settings.vipTest} value={s.isVip} options={onOff}
            onPick={(v) => set(v ? { isVip: true } : { isVip: false, speed: s.speed === 3 ? 2 : s.speed })} />
          <p className={css.help}>{UI.settings.vipTestHelp}</p>
          {/* review r2: the test arena is a testing tool, so it sits behind the same test switch
              (the #/sandbox address still opens it) */}
          {s.isVip ? (
            <>
              <p className={css.help}>{UI.settings.testArenaHelp}</p>
              <Button onClick={() => { location.hash = "#/sandbox"; }}>{UI.settings.testArena}</Button>
            </>
          ) : null}
        </section>

        <section className={css.block}>
          <h3 className={css.blockTitle}>{UI.settings.export}</h3>
          <p className={css.help}>{UI.settings.exportHelp}</p>
          {code === null ? (
            <Button onClick={() => void actions.exportCode().then(setCode)}>{UI.settings.export}</Button>
          ) : (
            <>
              <textarea className={css.code} readOnly value={code} rows={4} aria-label={UI.settings.export} onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={() => void navigator.clipboard?.writeText(code).then(() => toast(UI.settings.copied), () => undefined)}>{UI.settings.copy}</Button>
            </>
          )}
        </section>

        <section className={css.block}>
          <h3 className={css.blockTitle}>{UI.settings.import}</h3>
          <p className={css.help}>{UI.settings.importHelp}</p>
          <textarea className={css.code} value={paste} rows={3} aria-label={UI.settings.import} onChange={(e) => { setPaste(e.target.value); setMsg(null); setPending(null); }} />
          {pending === null ? (
            <Button
              disabled={paste.trim().length === 0}
              onClick={() => void actions.previewCode(paste).then((p) => {
                if (p === null) setMsg(UI.settings.importBad);
                else if (mine.active.length === 0 && mine.retired === 0) doImport();
                else setPending(p);
              }, (e: Error) => setMsg(e.message))}
            >{UI.settings.importButton}</Button>
          ) : (
            <div className={css.confirm} role="group" aria-label={UI.settings.importConfirmTitle}>
              <p className={css.confirmTitle}>{UI.settings.importConfirmTitle}</p>
              <p className={css.help}>{UI.settings.importLoses(mine.active, mine.retired)}</p>
              <p className={css.help}>{UI.settings.importGets(pending.active, pending.retired)}</p>
              <p className={css.help}>{UI.settings.importBackup}</p>
              <span className={css.choices}>
                <Button variant="primary" onClick={doImport}>{UI.settings.importReplace}</Button>
                <Button onClick={() => setPending(null)}>{UI.settings.cancel}</Button>
              </span>
            </div>
          )}
          {msg ? <p className={msg === UI.settings.importDone ? css.help : common.error} role="status">{msg}</p> : null}
        </section>

        {backups.length > 0 ? (
          <section className={css.block}>
            <h3 className={css.blockTitle}>{UI.settings.backups}</h3>
            <p className={css.help}>{UI.settings.backupsHelp}</p>
            {backups.map((b) => (
              <div key={b.key} className={css.confirm}>
                <p className={css.help}>{UI.settings.backupLine(summaryOf(b.doc!).active, b.doc!.retired.length, new Date(b.doc!.updatedAt).toLocaleDateString())}</p>
                {restoreKey === b.key ? (
                  <span className={css.choices}>
                    <Button variant="primary" onClick={() => doRestore(b.key)}>{UI.settings.restoreConfirm}</Button>
                    <Button onClick={() => setRestoreKey(null)}>{UI.settings.cancel}</Button>
                  </span>
                ) : (
                  <Button onClick={() => setRestoreKey(b.key)}>{UI.settings.restore}</Button>
                )}
              </div>
            ))}
          </section>
        ) : null}

        <section className={css.block}>
          <h3 className={css.blockTitle}>{UI.settings.credits}</h3>
          {UI.settings.creditsLines.map((l) => <p key={l} className={css.help}>{l}</p>)}
        </section>
      </div>
    </Sheet>
  );
}
