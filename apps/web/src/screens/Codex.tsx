/** Everything the Rift can give you: found in colour, the rest greyed out. */
import { useState } from "react";
import { BEASTS, BOONS, TECHNIQUES, TRUMPS, WEAPONS, beast, skill, type Champion } from "@agoge/core";
import { PetSprite } from "../pixelPets.js";
import { WeaponIcon } from "../weaponIcons.js";
import { SkillIcon, type SkillKind } from "../skillIcons.js";
import { PixIcon } from "../pixelIcons.js";
import { DISCIPLINE_NAME } from "../ui.js";


type CodexShelf = "weapons" | "boons" | "techniques" | "trumps" | "pets";

export function Codex({ champion, onBack }: { champion: Champion; onBack: () => void }) {
  const found = WEAPONS.filter((w) => champion.weapons.includes(w.id)).length;
  // Tap-to-inspect: title tooltips never fire on touch, so on phones the
  // Codex was a grid of names with zero information. One selection, one
  // detail strip, shared by every case.
  const [sel, setSel] = useState<{ name: string; detail: string } | null>(null);
  /*
   * One shelf at a time. All five stacked ran 3,065px — three and a half
   * phone screens of grid with no way to reach the pets except scrolling past
   * every weapon and skill in the game. A collection screen should let you go
   * straight to the case you are filling.
   */
  const [shelf, setShelf] = useState<CodexShelf>("weapons");
  const inspect = (name: string, detail: string) =>
    setSel((cur) => (cur?.name === name ? null : { name, detail }));
  const skillsIn = (list: typeof BOONS) => list.filter((s) => champion.skills.includes(s.id)).length;
  const SHELVES: Array<{ id: CodexShelf; label: string; have: number; all: number }> = [
    { id: "weapons", label: "Weapons", have: found, all: WEAPONS.length },
    { id: "boons", label: "Boons", have: skillsIn(BOONS), all: BOONS.length },
    { id: "techniques", label: "Techniques", have: skillsIn(TECHNIQUES), all: TECHNIQUES.length },
    { id: "trumps", label: "Trumps", have: skillsIn(TRUMPS), all: TRUMPS.length },
    { id: "pets", label: "Pets", have: champion.beasts.length, all: BEASTS.length },
  ];
  return (
    <div className="codex">
      <div className="arena-head">
        <button className="btn ghost" onClick={onBack}><PixIcon name="arrowLeft" size={11} /> Hall</button>
        <h2>Codex</h2>
        <span className="muted small">
          {SHELVES.reduce((n, s) => n + s.have, 0)}/{SHELVES.reduce((n, s) => n + s.all, 0)}
        </span>
      </div>
      <div className="tabs" role="tablist" aria-label="Codex shelf">
        {SHELVES.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={shelf === s.id}
            className={`tab${shelf === s.id ? " on" : ""}`}
            onClick={() => {
              setShelf(s.id);
              setSel(null);
            }}
          >
            {s.label} <span className="muted small">{s.have}/{s.all}</span>
          </button>
        ))}
      </div>
      {sel && (
        <p className="notice codex-detail" aria-live="polite">
          <b>{sel.name}</b> — {sel.detail}
        </p>
      )}

      {shelf === "weapons" && (
      <CodexCase title="Weapons" have={found} all={WEAPONS.length}>
        {WEAPONS.map((w) => (
          <CodexTile
            onTap={inspect}
            key={w.id}
            name={w.name}
            owned={champion.weapons.includes(w.id)}
            detail={`${DISCIPLINE_NAME[w.discipline] ?? w.discipline}${w.ammo ? ` · ${w.ammo} throws` : ""}${w.twoHanded ? " · two-handed" : ""} — ${w.flavour}`}
          >
            <span className="rack-tile">
              <WeaponIcon d={w.id} size={64} />
            </span>
          </CodexTile>
        ))}
      </CodexCase>
      )}

      {[
        { id: "boons" as const, title: "Boons", note: "always-on passives", list: BOONS },
        { id: "techniques" as const, title: "Techniques", note: "trigger on their own", list: TECHNIQUES },
        { id: "trumps" as const, title: "Trumps", note: "big moves that fire on instinct", list: TRUMPS },
      ]
        .filter((group) => shelf === group.id)
        .map((group) => (
        <CodexCase
          key={group.title}
          title={group.title}
          note={group.note}
          have={group.list.filter((s) => champion.skills.includes(s.id)).length}
          all={group.list.length}
        >
          {group.list.map((s) => (
            <CodexTile onTap={inspect} key={s.id} name={s.name} owned={champion.skills.includes(s.id)} detail={s.text}>
              <SkillIcon id={s.id} kind={s.kind as SkillKind} size={48} />
            </CodexTile>
          ))}
        </CodexCase>
      ))}

      {shelf === "pets" && (
      <CodexCase title="Pets" have={champion.beasts.length} all={BEASTS.length} wide>
        {BEASTS.map((b) => (
          <CodexTile
            onTap={inspect}
            key={b.id}
            name={b.name}
            owned={champion.beasts.includes(b.id)}
            detail={`HP ${b.hpBase}+level · hits ${b.dmgMin}–${b.dmgMax} · costs ${b.gritTax} Endurance — ${b.flavour}`}
          >
            <span className="pet-tile">
              <PetSprite beastId={b.id} size={56} />
            </span>
          </CodexTile>
        ))}
      </CodexCase>
      )}
    </div>
  );
}

/** One shelf of the Codex, with how much of it you have found. */
/** Tap-to-inspect: `title` never fires on touch, so hover-only tooltips made
 *  the Codex a grid of names with zero information on phones — the platform
 *  the collection screen most needs to sell chase targets on. */
function CodexCase({
  title,
  note,
  have,
  all,
  wide,
  children,
}: {
  title: string;
  note?: string;
  have: number;
  all: number;
  /** pets are drawn wider than they are tall and need the room */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`card codex-case${wide ? " wide" : ""}`}>
      <h3>
        {title}{" "}
        <span className="muted small">
          {note ? `${note} — ` : ""}{have}/{all} found
        </span>
      </h3>
      <div className="codex-grid">{children}</div>
    </section>
  );
}

/** A found thing is in colour. An unfound one is the same art, drained. */
function CodexTile({
  name,
  owned,
  detail,
  onTap,
  children,
}: {
  name: string;
  owned: boolean;
  detail: string;
  onTap: (name: string, detail: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`codex-tile ${owned ? "" : "locked"}`}
      title={`${name} — ${detail}`}
      onClick={() => onTap(name, detail)}
    >
      {children}
      <em>{name}</em>
    </button>
  );
}
