/** Everything the Rift can give you: found in colour, the rest greyed out. */
import { useState } from "react";
import { BEASTS, BOONS, TECHNIQUES, TRUMPS, WEAPONS, beast, skill, type Champion } from "@agoge/core";
import { PetSprite } from "../pixelPets.js";
import { WeaponIcon } from "../weaponIcons.js";
import { SkillIcon, type SkillKind } from "../skillIcons.js";
import { PixIcon } from "../pixelIcons.js";
import { DISCIPLINE_NAME } from "../ui.js";


export function Codex({ champion, onBack }: { champion: Champion; onBack: () => void }) {
  const found = WEAPONS.filter((w) => champion.weapons.includes(w.id)).length;
  // Tap-to-inspect: title tooltips never fire on touch, so on phones the
  // Codex was a grid of names with zero information. One selection, one
  // detail strip, shared by every case.
  const [sel, setSel] = useState<{ name: string; detail: string } | null>(null);
  const inspect = (name: string, detail: string) =>
    setSel((cur) => (cur?.name === name ? null : { name, detail }));
  return (
    <div className="codex">
      <div className="arena-head">
        <button className="btn ghost" onClick={onBack}><PixIcon name="arrowLeft" size={11} /> Hall</button>
        <h2>Codex</h2>
        <span />
      </div>
      <p className="muted">
        Everything the Rift can give you, laid out in full. What you have found is in colour;
        the rest is greyed until it drops. Tap any of them for what it does.
      </p>
      {sel && (
        <p className="notice codex-detail" aria-live="polite">
          <b>{sel.name}</b> — {sel.detail}
        </p>
      )}

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
              <WeaponIcon d={w.id} size={48} />
            </span>
          </CodexTile>
        ))}
      </CodexCase>

      {[
        { title: "Boons", note: "always-on passives", list: BOONS },
        { title: "Techniques", note: "trigger on their own", list: TECHNIQUES },
        { title: "Trumps", note: "big moves that fire on instinct", list: TRUMPS },
      ].map((group) => (
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

      <CodexCase title="Pets" have={champion.beasts.length} all={BEASTS.length}>
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
  children,
}: {
  title: string;
  note?: string;
  have: number;
  all: number;
  children: React.ReactNode;
}) {
  return (
    <section className="card codex-case">
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
