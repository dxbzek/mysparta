/**
 * A. Landing and create (brief 3.4, 3.11 A). The name is the seed: the preview changes as the
 * player types. Two dice: "Shape" and "Colours". Stats and kit stay hidden until the player
 * confirms; then the reveal plays (4 s or less, tap to skip) and "To the Locker" appears.
 */
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { RARITY_OF, REALM_SALT } from "@rankzero/core";
import type { ScrapperRecord, StatKey } from "@rankzero/core";
import { useDoc, useGame } from "../../app/context";
import { SLOT_LIMIT } from "../../state/schema";
import { STAT_KEYS } from "../../text/stats";
import { UI } from "../../text/ui";
import { ActorStage } from "../../ui/ActorStage";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { StatBar } from "../../ui/StatBar";
import { Sticker } from "../../ui/Sticker";
import { reducedFrom } from "../../fight/reduced";
import { DiceGlyph } from "../parts/Glyphs";
import { PerkRow } from "../parts/Perk";
import { useCountUp, useShortScreen } from "../parts/motion";
import common from "../common.module.css";
import css from "./Create.module.css";

/** The reveal: four bars one after another, then the perk card flips. */
export const REVEAL_BAR_MS = 550;
/** The scrapper drops onto the stage first; the stats count up after it lands. */
export const REVEAL_DROP_MS = 450;
export const REVEAL_MS = REVEAL_BAR_MS * 4 + 900;

/** True from 1100 px wide, where the preview stage is 520 px wide (brief 3.11 A). */
function useWide(): boolean {
  const q = "(min-width: 1100px)";
  const [wide, setWide] = useState(() => typeof matchMedia === "function" && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return undefined;
    const m = matchMedia(q);
    const on = (): void => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

/** The longest legal name (the core's rule: 3 to 14 characters after trimming). */
export const NAME_MAX = 14;

const randomInt = (): number => Math.floor(Math.random() * 2 ** 31);

export function CreateScreen() {
  const { actions, core, go, clock } = useGame();
  const doc = useDoc();
  const [name, setName] = useState("");
  const [lookSalt, setLookSalt] = useState(0);
  const [colourSalt, setColourSalt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<ScrapperRecord | null>(null);
  const placeholder = useMemo(() => core.randomName(Math.floor(clock.now() / 86_400_000)), [core, clock]);
  const seedName = name.trim() || placeholder;
  const look = useMemo(() => core.rollLook(core.fighterSeed(REALM_SALT, seedName), lookSalt, colourSalt), [core, seedName, lookSalt, colourSalt]);
  const canBack = doc.fighters.length > 0;
  const wide = useWide();

  const live = name.trim().length > 0 ? core.checkName(name) : null;
  const liveError = live && !live.ok && live.why === "chars" ? UI.create.errors.chars : null;

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    // An empty field makes the scrapper the preview shows: the placeholder name (finding 65).
    const chosen = name.trim() ? name : placeholder;
    const r0 = core.checkName(chosen);
    if (!r0.ok) {
      setError(r0.why === "chars" ? UI.create.errors.chars : UI.create.errors.length);
      return;
    }
    if (doc.fighters.length >= SLOT_LIMIT) {
      setError(UI.create.errors.slot);
      return;
    }
    setBusy(true);
    try {
      const r = await actions.create(chosen, lookSalt, colourSalt);
      if (r.ok) setMade(r.value);
      else setError(r.error === "name-taken" ? UI.create.errors.taken : r.error === "no-slot" ? UI.create.errors.slot : UI.create.errors.length);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  if (made) return <Reveal rec={made} onDone={() => go({ name: "locker" })} />;

  return (
    <div className={`${common.screen} ${css.screen}`}>
      <header className={css.logo}>
        <h1 className={css.title}>{UI.appName}</h1>
        <p className={css.tagline}>{UI.tagline}</p>
      </header>
      <main className={css.main}>
        <div className={css.stageWrap}>
          <Panel tone="dark" flush className={css.stage}>
            <ActorStage look={look} height={260} floorAt={0.86} window={{ w: wide ? 330 : 200, h: 130 }} label={UI.create.preview(seedName)} />
            <div className={css.stageName}>
              <Sticker tilt={-2}>{seedName.replace(/\s+/g, " ")}</Sticker>
            </div>
          </Panel>
          <div className={css.dice}>
            <Button onClick={() => setLookSalt((n) => n + 1)}><DiceGlyph />{UI.create.shape}</Button>
            <Button onClick={() => setColourSalt((n) => n + 1)}><DiceGlyph />{UI.create.colours}</Button>
          </div>
        </div>
        <form className={css.form} onSubmit={submit} noValidate>
          <Panel className={css.namePanel}>
            <div className={css.labelRow}>
              <label className={css.label} htmlFor="rz-name">{UI.create.nameLabel}</label>
              <span id="rz-name-count" className={`${css.count} ${name.length >= NAME_MAX ? css.countFull : ""}`} aria-live="polite">{UI.create.count(name.length, NAME_MAX)}</span>
            </div>
            <input
              id="rz-name"
              className={common.field}
              value={name}
              maxLength={NAME_MAX}
              autoComplete="off"
              autoCapitalize="words"
              spellCheck={false}
              placeholder={placeholder}
              aria-invalid={Boolean(error ?? liveError)}
              aria-describedby="rz-name-error rz-name-count"
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            <div className={css.nameRow}>
              <button type="button" className={common.link} onClick={() => { setName(core.randomName(randomInt())); setError(null); }}>{UI.create.randomName}</button>
              {canBack ? <button type="button" className={common.link} onClick={() => go({ name: "locker" })}>{UI.create.cancel}</button> : null}
            </div>
            <p id="rz-name-error" className={common.error} aria-live="polite">{error ?? liveError ?? ""}</p>
          </Panel>
          <Button type="submit" variant="primary" disabled={busy}>{UI.create.confirm}</Button>
          <ul className={css.bullets}>
            {UI.create.bullets.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </form>
      </main>
    </div>
  );
}

function Reveal({ rec, onDone }: { rec: ScrapperRecord; onDone(): void }) {
  const { core, store } = useGame();
  const sheet = useMemo(() => core.sheetOf(rec), [core, rec]);
  const reduced = reducedFrom(store.doc.settings.reducedMotion);
  const short = useShortScreen();
  const [done, setDone] = useState(reduced);
  useEffect(() => {
    if (done) return undefined;
    const id = window.setTimeout(() => setDone(true), REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [done]);
  const top = Math.max(6, ...STAT_KEYS.map((k) => sheet.effective[k]));
  const hp = useCountUp(sheet.maxHp, REVEAL_DROP_MS, REVEAL_BAR_MS * 2, !done);
  const rarity = RARITY_OF[sheet.startPerk];
  return (
    <div className={`${common.screen} ${css.screen}`} onClick={() => setDone(true)} data-reveal={done ? "done" : "playing"}>
      <main className={`${css.reveal} ${done ? css.revealDone : ""}`}>
        <Panel tone="dark" flush className={css.revealStage}>
          <div className={css.drop}>
            <ActorStage look={sheet.look} clip="win" restMs={1400} height={short ? 180 : 220} floorAt={0.9} window={{ w: 280, h: 150 }} label={UI.create.revealHeading(rec.name)} />
          </div>
          <h1 className={css.revealTitle}>{UI.create.revealHeading(rec.name)}</h1>
        </Panel>
        <Panel className={css.revealStats}>
          <div className={css.hpRow}><span>{UI.maxHp}</span><strong className={css.hpNum}>{hp}</strong></div>
          {STAT_KEYS.map((k, i) => <RevealBar key={k} stat={k} value={sheet.effective[k]} max={top} delay={REVEAL_DROP_MS + i * REVEAL_BAR_MS} run={!done} />)}
        </Panel>
        <div className={`${css.perk} ${css[`glow-${rarity}`] ?? ""}`} style={{ animationDelay: `${REVEAL_BAR_MS * 4}ms` }}>
          <p className={css.perkLabel}>{UI.create.startPerk}</p>
          <PerkRow id={sheet.startPerk} owned={sheet.perks} />
        </div>
        <div className={css.revealAction}>
          {done ? (
            <Button variant="primary" autoFocus onClick={onDone} className={css.toLocker}>{UI.create.toLocker}</Button>
          ) : (
            <p className={css.skip}>{UI.create.tapToSkip}</p>
          )}
        </div>
      </main>
    </div>
  );
}

function RevealBar({ stat, value, max, delay, run }: { stat: StatKey; value: number; max: number; delay: number; run: boolean }) {
  const v = useCountUp(value, delay, REVEAL_BAR_MS, run);
  return <div className={css.bar}><StatBar stat={stat} value={v} max={max} /></div>;
}
