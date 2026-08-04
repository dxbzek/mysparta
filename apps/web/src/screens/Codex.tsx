/** Everything the Rift can give you: found in colour, the rest greyed out. */
import { BEASTS, BOONS, TECHNIQUES, TRUMPS, WEAPONS, beast, skill, type Champion } from "@agoge/core";
import { PetSprite } from "../pixelPets.js";
import { WeaponIcon } from "../weaponIcons.js";
import { SkillIcon, type SkillKind } from "../skillIcons.js";
import { PixIcon } from "../pixelIcons.js";
import { DISCIPLINE_NAME } from "../ui.js";


export function Codex({ champion, onBack }: { champion: Champion; onBack: () => void }) {
  const found = WEAPONS.filter((w) => champion.weapons.includes(w.id)).length;
  return (
    <div className="codex">
      <div className="arena-head">
        <button className="btn ghost" onClick={onBack}><PixIcon name="arrowLeft" size={11} /> Hall</button>
        <h2>Codex</h2>
        <span />
      </div>
      <p className="muted">
        Everything the Rift can give you, laid out in full. What you have found is in colour;
        the rest is greyed until it drops. Hover any of them for what it does.
      </p>

      <CodexCase title="Weapons" have={found} all={WEAPONS.length}>
        {WEAPONS.map((w) => (
          <CodexTile
            key={w.id}
            name={w.name}
            owned={champion.weapons.includes(w.id)}
            detail={`${DISCIPLINE_NAME[w.discipline] ?? w.discipline}${w.ammo ? ` · ${w.ammo} throws` : ""}${w.twoHanded ? " · two-handed" : ""} — ${w.flavour}`}
          >
            <span className="rack-tile">
              <WeaponIcon d={w.id} size={40} />
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
            <CodexTile key={s.id} name={s.name} owned={champion.skills.includes(s.id)} detail={s.text}>
              <SkillIcon id={s.id} kind={s.kind as SkillKind} size={46} />
            </CodexTile>
          ))}
        </CodexCase>
      ))}

      <CodexCase title="Pets" have={champion.beasts.length} all={BEASTS.length}>
        {BEASTS.map((b) => (
          <CodexTile
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
  children,
}: {
  name: string;
  owned: boolean;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`codex-tile ${owned ? "" : "locked"}`} title={`${name} — ${detail}`}>
      {children}
      <em>{name}</em>
    </span>
  );
}
