/**
 * The sandbox route (#/sandbox, plan WP5 and acceptance 17): pick any perks and a level for two
 * test scrappers, and the sim plays the bout on the real fight screen. It builds two
 * `FighterSnapshot` objects by hand and NEVER writes the save: a save stores only seed and picks,
 * so a scrapper cannot be "given" a perk.
 */
import { useMemo, useState } from "react";
import { COMPANION_IDS, SHIELD_IDS, SKILL_IDS, WEAPON_IDS, api } from "@rankzero/core";
import type { BoutLog, FighterSnapshot, PerkId, StatKey } from "@rankzero/core";
import type { Settings } from "../../contracts";
import { RigGate } from "../RigGate";
import { FightScreen } from "../../fight/FightScreen";
import { NAMES } from "../../text/names";
import { UI } from "../../text/ui";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import common from "../../screens/common.module.css";
import css from "./Sandbox.module.css";

const GROUPS: readonly { title: string; ids: readonly PerkId[] }[] = [
  { title: UI.kit.weapons, ids: WEAPON_IDS },
  { title: UI.kit.skills, ids: SKILL_IDS },
  { title: UI.kit.pets, ids: COMPANION_IDS },
  { title: UI.kit.shields, ids: SHIELD_IDS },
];

/** "Everything" for a test scrapper: every weapon and skill, three pets that may be owned
 *  together, and one shield (a scrapper carries at most one). */
const EVERYTHING_A: readonly PerkId[] = [...WEAPON_IDS, ...SKILL_IDS, "goose", "crow", "stray-dog", "riot-shield"];
const EVERYTHING_B: readonly PerkId[] = [...WEAPON_IDS, ...SKILL_IDS, "boar", "crow", "alley-cat", "car-door"];

/** A hand-built snapshot. Stats grow with the level so a level-30 sandbox is not made of paper. */
export function sandboxSnapshot(id: string, name: string, level: number, perks: readonly PerkId[], lookSeed: number): FighterSnapshot {
  const per = 2 + Math.floor((level - 1) / 2);
  const points: Record<StatKey, number> = { health: per + 2, strength: per + 1, agility: per, speed: per };
  return { id, name, look: api.rollLook(lookSeed, 0, 0), level, perks: [...perks], rulesVersion: 1,
    stats: { points, mult: { health: 100, strength: 100, agility: 100, speed: 100 } } };
}

function Side({ title, picked, onToggle, onAll, onNone }: { title: string; picked: readonly PerkId[]; onToggle(id: PerkId): void; onAll(): void; onNone(): void }) {
  return (
    <Panel title={title} className={css.side}>
      <div className={css.chips}>
        <Button variant="primary" onClick={onAll}>{UI.sandbox.all}</Button>
        <Button onClick={onNone}>{UI.sandbox.none}</Button>
      </div>
      {GROUPS.map((g) => (
        <fieldset key={g.title} className={css.group}>
          <legend className={css.legend}>{g.title}</legend>
          <div className={css.chips}>
            {g.ids.map((id) => {
              const on = picked.includes(id);
              return <Button key={id} variant={on ? "dark" : "secondary"} pressed={on} className={css.chip} onClick={() => onToggle(id)}>{NAMES[id]}</Button>;
            })}
          </div>
        </fieldset>
      ))}
    </Panel>
  );
}

export function SandboxScreen() {
  const [level, setLevel] = useState(30);
  const [seed, setSeed] = useState(1);
  const [a, setA] = useState<PerkId[]>([...EVERYTHING_A]);
  const [b, setB] = useState<PerkId[]>([...EVERYTHING_B]);
  const [bout, setBout] = useState<{ log: BoutLog; a: FighterSnapshot; b: FighterSnapshot } | null>(null);
  const [settings, setSettings] = useState<Settings>({ sound: true, speed: 1, reducedMotion: "system", liveLog: true });
  /** Shields: one at most, so picking a shield replaces the other. */
  const toggle = (set: (f: (p: PerkId[]) => PerkId[]) => void) => (id: PerkId) => set((p) => {
    if (p.includes(id)) return p.filter((x) => x !== id);
    const isShield = (SHIELD_IDS as readonly string[]).includes(id);
    return [...(isShield ? p.filter((x) => !(SHIELD_IDS as readonly string[]).includes(x)) : p), id];
  });
  const snaps = useMemo(() => ({
    a: sandboxSnapshot("sandbox-a", "Lefty", level, a, seed * 2 + 1),
    b: sandboxSnapshot("sandbox-b", "Righty", level, b, seed * 2 + 2),
  }), [level, a, b, seed]);

  if (bout) {
    return (
      <RigGate>
      <FightScreen log={bout.log} a={bout.a} b={bout.b} mode="replay" settings={settings}
        onSettings={(p) => setSettings((s) => ({ ...s, ...p }))} onFinished={() => undefined} result={null}
        onResultAction={() => setBout(null)} />
      </RigGate>
    );
  }
  return (
    <div className={`${common.screen} ${common.wide}`}>
      <header className={common.top}>
        <span />
        <div className={common.titles}>
          <span className={common.kicker}>{UI.sandbox.line}</span>
          <h1 className={common.h1}>{UI.sandbox.title}</h1>
        </div>
        <span />
      </header>
      <main className={common.body}>
        <Panel className={css.controls}>
          <label className={css.num}>{UI.sandbox.level}
            <input className={common.field} type="number" min={1} max={60} value={level} onChange={(e) => setLevel(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
          </label>
          <label className={css.num}>{UI.sandbox.seed}
            <input className={common.field} type="number" value={seed} onChange={(e) => setSeed(Math.trunc(Number(e.target.value) || 0))} />
          </label>
          <Button variant="primary" onClick={() => setBout({ log: api.simulateFight(seed, snaps.a, snaps.b, 1), a: snaps.a, b: snaps.b })}>{UI.sandbox.run}</Button>
        </Panel>
        <div className={css.sides}>
          <Side title={UI.sandbox.sideA} picked={a} onToggle={toggle(setA)} onAll={() => setA([...EVERYTHING_A])} onNone={() => setA([])} />
          <Side title={UI.sandbox.sideB} picked={b} onToggle={toggle(setB)} onAll={() => setB([...EVERYTHING_B])} onNone={() => setB([])} />
        </div>
      </main>
    </div>
  );
}
