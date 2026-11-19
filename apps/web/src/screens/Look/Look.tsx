/**
 * The look editor from home (content v3 batch 4, plan 13.12): #/look, opened from the Locker's hero
 * ("Change look") and from the Kit's portrait. A live preview on top (the same rig the fight draws,
 * idling, with the bag's weapon and the gear worn, which can be taken off to see what is under the
 * hat), the editor below, the two dice as shortcuts, and Save. The look is stored per scrapper
 * (`actions.setLook`); it is cosmetic, so the stats never change.
 */
import { useEffect, useMemo, useState } from "react";
import type { HeldId, Look } from "@rankzero/core";
import { activeRecord } from "../../app/guards";
import { useDoc, useGame } from "../../app/context";
import { shownRecord } from "../../state/actions";
import { LOOK_WORDS } from "../../text/looks";
import { UI } from "../../text/ui";
import { ActorStage } from "../../ui/ActorStage";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { BackGlyph, DiceGlyph } from "../parts/Glyphs";
import { LookEditor, takeParts } from "../parts/LookEditor";
import common from "../common.module.css";
import css from "./Look.module.css";

const randomInt = (): number => Math.floor(Math.random() * 2 ** 31);

export function LookScreen() {
  const { actions, core, go, toast } = useGame();
  const doc = useDoc();
  const rec = activeRecord(doc);
  const shown = rec ? shownRecord(doc, rec) : null;
  const saved = useMemo(() => (rec ? core.lookOf(rec) : null), [core, rec]);
  const [draft, setDraft] = useState<Look | null>(saved);
  const [gear, setGear] = useState(true);
  const [busy, setBusy] = useState(false);
  // another scrapper picked in the roster while this screen is open starts from its own look
  useEffect(() => { setDraft(saved); }, [rec?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheet = useMemo(() => (shown ? core.sheetOf(shown) : null), [core, shown]);
  if (!rec || !saved || !draft || !sheet) return null;
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const held = (sheet.loadout.weapons[0] ?? null) as HeldId | null;
  const roll = (which: "shape" | "colour"): void => setDraft((d) => takeParts(d ?? saved, core.rollLook(rec.seed, randomInt(), randomInt()), which));
  const save = async (): Promise<void> => {
    if (busy || !changed) return;
    setBusy(true);
    try {
      const r = await actions.setLook(rec.id, draft);
      if (r.ok) toast(LOOK_WORDS.saved);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={common.screen}>
      <header className={common.top}>
        <Button square onClick={() => go({ name: "locker" })} aria-label={UI.back}><BackGlyph /></Button>
        <div className={common.titles}>
          <span className={common.kicker}>{rec.name} · {UI.level(sheet.level)}</span>
          <h1 className={common.h1}>{LOOK_WORDS.title}</h1>
        </div>
        <span />
      </header>
      <main className={common.body}>
        <div className={css.sticky}>
          <Panel tone="dark" flush className={css.stage}>
            <ActorStage look={draft} held={gear ? held : null} shield={gear ? sheet.loadout.shield : null} {...(gear ? { gear: sheet.loadout.gear } : {})}
              height={230} floorAt={0.88} window={{ w: 150, h: 110 }} label={LOOK_WORDS.preview(rec.name)} />
          </Panel>
        </div>
        <div className={css.tools}>
          <Button onClick={() => roll("shape")}><DiceGlyph />{LOOK_WORDS.shape}</Button>
          <Button onClick={() => roll("colour")}><DiceGlyph />{LOOK_WORDS.colours}</Button>
          <Button pressed={gear} onClick={() => setGear((g) => !g)}>{LOOK_WORDS.gear}</Button>
        </div>
        <Panel>
          <LookEditor look={draft} onChange={setDraft} id="look-home" />
        </Panel>
        <div className={css.actions}>
          <Button variant="primary" disabled={!changed || busy} onClick={() => void save()}>{LOOK_WORDS.save}</Button>
          <Button disabled={!changed} onClick={() => setDraft(saved)}>{LOOK_WORDS.undo}</Button>
        </div>
      </main>
    </div>
  );
}
