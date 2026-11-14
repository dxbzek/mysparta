/**
 * The settings sheet (brief 3.11): sound, reduced motion (follow system / on / off), the live log,
 * export and import of the save code, credits.
 */
import { useState } from "react";
import { useDoc, useGame } from "../../app/context";
import type { Settings } from "../../contracts";
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

export function SettingsSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { actions, toast } = useGame();
  const doc = useDoc();
  const s = doc.settings;
  const [code, setCode] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const set = (patch: Partial<Settings>): void => void actions.setSettings(patch).catch((e: Error) => toast(e.message));
  const onOff = [{ v: true, label: UI.settings.on }, { v: false, label: UI.settings.off }] as const;
  return (
    <Sheet open={open} title={UI.settings.title} onClose={onClose}>
      <div className={css.body}>
        <Choice label={UI.settings.sound} value={s.sound} options={onOff} onPick={(v) => set({ sound: v })} />
        <Choice label={UI.settings.motion} value={s.reducedMotion} options={[{ v: "system", label: UI.settings.motionSystem }, { v: "on", label: UI.settings.on }, { v: "off", label: UI.settings.off }] as const} onPick={(v) => set({ reducedMotion: v })} />
        <Choice label={UI.settings.liveLog} value={s.liveLog} options={onOff} onPick={(v) => set({ liveLog: v })} />

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
          <textarea className={css.code} value={paste} rows={3} aria-label={UI.settings.import} onChange={(e) => { setPaste(e.target.value); setMsg(null); }} />
          <Button
            disabled={paste.trim().length === 0}
            onClick={() => void actions.importCode(paste).then((r) => {
              setMsg(r.ok ? UI.settings.importDone : UI.settings.importBad);
              if (r.ok) setPaste("");
            }, (e: Error) => setMsg(e.message))}
          >{UI.settings.importButton}</Button>
          {msg ? <p className={msg === UI.settings.importDone ? css.help : common.error} role="status">{msg}</p> : null}
        </section>

        <section className={css.block}>
          <h3 className={css.blockTitle}>{UI.settings.credits}</h3>
          {UI.settings.creditsLines.map((l) => <p key={l} className={css.help}>{l}</p>)}
        </section>
      </div>
    </Sheet>
  );
}
