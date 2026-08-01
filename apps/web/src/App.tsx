import { useMemo, useState } from "react";
import {
  applyDraft,
  arenaBoard,
  combineSeed,
  costToNext,
  createChampion,
  describeOffer,
  fightXp,
  generateDraft,
  kleosDelta,
  maxHp,
  omen,
  simulateFight,
  skill,
  snapshot,
  weapon,
  type BattlePlan,
  type Champion,
  type FateOffer,
  type FightResult,
  type GambitId,
  type Rival,
  type Stance,
  type TrumpTrigger,
} from "@agoge/core";
import { hashString, type Discipline } from "@agoge/core";
import { FightTheatre, type StageFigure } from "./FightTheatre.js";
import { DisciplineGlyph, HelmBust, HopliteFigure, paletteFromHues } from "./art.js";
import {
  applyDailyReset,
  load,
  newSave,
  persist,
  todayKey,
  wipe,
  type SaveV1,
  VIGOR_CAP,
} from "./save.js";

type Screen =
  | { s: "forge" }
  | { s: "home" }
  | { s: "arena" }
  | { s: "plan"; rival: Rival }
  | { s: "fight"; result: FightResult; rival: Rival }
  | { s: "tapestry" };

const STANCES: { id: Stance; name: string; blurb: string }[] = [
  { id: "aggressive", name: "Aggressive", blurb: "+15% damage, faster swings — thinner guard" },
  { id: "measured", name: "Measured", blurb: "+6 Accuracy, chip damage through blocks" },
  { id: "guarded", name: "Guarded", blurb: "+12 Block, counters and ripostes bite harder" },
];

const GAMBITS: { id: GambitId; name: string; blurb: string }[] = [
  { id: "close_the_gap", name: "Close the Gap", blurb: "+20 Initiative; foe's first counter denied" },
  { id: "hold_ground", name: "Hold Ground", blurb: "Slower start; first counter/riposte +30%" },
  { id: "hurl_first", name: "Hurl First", blurb: "Open with a throw (spends the weapon if melee)" },
  { id: "feint", name: "Feint", blurb: "First blow feigned; foe's guard −15 for 300 ticks" },
  { id: "test_the_shield", name: "Test the Shield", blurb: "Disarm doubled on first 3 landed hits" },
  { id: "war_cry", name: "War Cry", blurb: "Delayed start; foe Accuracy −8 for 500 ticks" },
  { id: "loose_the_beast", name: "Loose the Beast", blurb: "Beasts strike 100 ticks earlier; you −30 Initiative" },
];

const TRIGGERS: { id: TrumpTrigger; name: string }[] = [
  { id: "first_clash", name: "At the First Clash" },
  { id: "first_blood_taken", name: "First Blood Taken" },
  { id: "first_blood_drawn", name: "First Blood Drawn" },
  { id: "when_bloodied", name: "When Bloodied (<50%)" },
  { id: "deaths_door", name: "At Death's Door (<20%)" },
  { id: "foe_bloodied", name: "When the Foe is Bloodied" },
  { id: "when_disarmed", name: "When Disarmed" },
  { id: "beast_falls", name: "When Your Beast Falls" },
  { id: "first_crit", name: "On Your First Crit" },
  { id: "tenth_exchange", name: "After the Tenth Exchange" },
];

export function App() {
  const [save, setSave] = useState<SaveV1 | null>(() => load());
  const [screen, setScreen] = useState<Screen>(save ? { s: "home" } : { s: "forge" });
  const [draft, setDraft] = useState<{ offers: FateOffer[]; nonce: number } | null>(null);

  const update = (next: SaveV1) => {
    persist(next);
    setSave(next);
  };

  const openDraftIfDue = (s: SaveV1) => {
    const c = s.champion;
    if (c.level < 50 && c.xp >= costToNext(c.level)) {
      setDraft({ offers: generateDraft(c, c.level + 1, 0), nonce: 0 });
    } else {
      setDraft(null);
    }
  };

  /* ---------------- forge ---------------- */

  if (!save || screen.s === "forge") {
    return (
      <Shell>
        <Forge
          onForge={(name) => {
            const champion = createChampion(name);
            champion.xp = 0;
            const s = newSave(champion, {
              stance: "measured",
              gambit: "close_the_gap",
            });
            update(s);
            setScreen({ s: "home" });
          }}
        />
      </Shell>
    );
  }

  const c = save.champion;
  const o = omen(c.omen);
  const hpNow = maxHp(c.level, c.stats.grit, c.beasts, c.skills.includes("beast_bond"));

  /* ---------------- fight orchestration ---------------- */

  const startFight = (rival: Rival, plan: BattlePlan) => {
    const fresh = applyDailyReset(save);
    if (fresh.vigor <= 0) return;
    const champion = structuredClone(fresh.champion);
    const seed = combineSeed(champion.seed, fresh.totalFights, rival.snapshot.name, todayKey());
    const result = simulateFight({
      seed,
      attacker: snapshot(champion, plan),
      defender: rival.snapshot,
    });
    const won = result.winner === 0;
    champion.xp += fightXp(won, fresh.kleos, rival.kleos);
    const next: SaveV1 = {
      ...fresh,
      champion,
      vigor: fresh.vigor - 1,
      totalFights: fresh.totalFights + 1,
      wins: fresh.wins + (won ? 1 : 0),
      losses: fresh.losses + (won ? 0 : 1),
      kleos: Math.max(1000, fresh.kleos + kleosDelta(won, fresh.kleos, rival.kleos)),
      plan,
      seenPlans: { ...fresh.seenPlans, [rival.snapshot.name]: rival.snapshot.plan },
    };
    update(next);
    setScreen({ s: "fight", result, rival });
  };

  /* ---------------- draft handling ---------------- */

  const pickDraft = (index: number) => {
    if (!draft) return;
    const champion = structuredClone(save.champion);
    champion.xp -= costToNext(champion.level);
    applyDraft(champion, draft.offers, index, draft.nonce > 0);
    const next = { ...save, champion };
    update(next);
    openDraftIfDue(next);
  };

  const rerollDraft = () => {
    if (!draft || save.champion.favour <= 0) return;
    const champion = structuredClone(save.champion);
    champion.favour -= 1;
    const nonce = draft.nonce + 1;
    update({ ...save, champion });
    setDraft({ offers: generateDraft(champion, champion.level + 1, nonce), nonce });
  };

  /* ---------------- screens ---------------- */

  return (
    <Shell
      header={
        <header className="topbar">
          <button className="wordmark" onClick={() => setScreen({ s: "home" })}>
            AGOGE
          </button>
          <div className="topbar-right">
            <span className="pill" title="Kleos rating">
              ✦ {save.kleos}
            </span>
            <VigorPips vigor={save.vigor} />
          </div>
        </header>
      }
    >
      {screen.s === "home" && (
        <Home
          save={save}
          hpNow={hpNow}
          omenName={o.name}
          onArena={() => setScreen({ s: "arena" })}
          onTapestry={() => setScreen({ s: "tapestry" })}
          onReorder={(from, to) => {
            const champion = structuredClone(c);
            const [moved] = champion.weapons.splice(from, 1);
            champion.weapons.splice(to, 0, moved!);
            update({ ...save, champion });
          }}
          onOffering={() => update({ ...save, vigor: Math.min(VIGOR_CAP, save.vigor + 6) })}
          onReset={() => {
            if (window.confirm("Return this Champion's thread to the Fates? This cannot be undone.")) {
              wipe();
              setSave(null);
              setDraft(null);
              setScreen({ s: "forge" });
            }
          }}
        />
      )}

      {screen.s === "arena" && (
        <Arena
          save={save}
          onBack={() => setScreen({ s: "home" })}
          onRefresh={() => update({ ...save, boardRefresh: save.boardRefresh + 1 })}
          onChallenge={(rival) => setScreen({ s: "plan", rival })}
        />
      )}

      {screen.s === "plan" && (
        <PlanSheet
          champion={c}
          rival={screen.rival}
          lastSeen={save.seenPlans[screen.rival.snapshot.name]}
          initial={save.plan}
          disabled={save.vigor <= 0}
          onCancel={() => setScreen({ s: "arena" })}
          onFight={(plan) => startFight(screen.rival, plan)}
        />
      )}

      {screen.s === "fight" && (
        <FightTheatre
          result={screen.result}
          names={[c.displayName, screen.rival.snapshot.name]}
          figures={
            [
              {
                palette: paletteFromHues(c.appearance.hue, c.appearance.hue2),
                discipline: primaryDiscipline(c.weapons),
              },
              {
                palette: rivalPalette(screen.rival.snapshot.name),
                discipline: primaryDiscipline(screen.rival.snapshot.weapons),
              },
            ] satisfies [StageFigure, StageFigure]
          }
          onDone={() => {
            openDraftIfDue(save);
            setScreen({ s: "arena" });
          }}
        />
      )}

      {screen.s === "tapestry" && <Tapestry champion={c} onBack={() => setScreen({ s: "home" })} />}

      {draft && (
        <DraftModal
          champion={c}
          offers={draft.offers}
          canReroll={c.favour > 0}
          onReroll={rerollDraft}
          onPick={pickDraft}
        />
      )}
    </Shell>
  );
}

/* ================= components ================= */

function Shell({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
  return (
    <div className="shell">
      {header}
      <main className="content">{children}</main>
      <footer className="foot">
        AGOGE prototype — deterministic sim v1 · your legend is saved in this browser
      </footer>
    </div>
  );
}

function Forge({ onForge }: { onForge: (name: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return null;
    try {
      return createChampion(trimmed);
    } catch {
      return null;
    }
  }, [name]);

  return (
    <div className="forge">
      <h1 className="forge-title">Speak a name.</h1>
      <p className="forge-sub">The Fates will do the rest.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed.length < 2 || trimmed.length > 24) {
            setError("A name needs 2–24 characters.");
            return;
          }
          onForge(trimmed);
        }}
      >
        <input
          className="forge-input"
          value={name}
          maxLength={24}
          placeholder="e.g. Kassia"
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          aria-label="Champion name"
        />
        {error && <p className="error">{error}</p>}
        {preview && (
          <div className="forge-preview card">
            <Medallion champion={preview} size={72} />
            <div>
              <div className="champ-name">
                {preview.displayName} <span className="epithet">{preview.epithet}</span>
              </div>
              <div className="muted">{omen(preview.omen).name}</div>
              <div className="statline">
                M {preview.stats.might} · G {preview.stats.grace} · T {preview.stats.tempo} · Gr{" "}
                {preview.stats.grit}
              </div>
            </div>
          </div>
        )}
        <button className="btn primary big" type="submit" disabled={name.trim().length < 2}>
          Forge my Champion
        </button>
      </form>
      <p className="fineprint">
        Same name, same Champion — the seed decides flavour, your drafts decide fate.
      </p>
    </div>
  );
}

function Medallion({ champion, size }: { champion: Champion; size: number }) {
  const { hue, hue2 } = champion.appearance;
  return <HelmBust size={size} palette={paletteFromHues(hue, hue2)} />;
}

/** The discipline that defines a loadout's stage pose. */
function primaryDiscipline(weapons: string[]): Discipline | "fists" {
  const held = weapons.find((id) => weapon(id).discipline !== "aspis");
  if (held) return weapon(held).discipline;
  return weapons.length > 0 ? "aspis" : "fists";
}

function rivalPalette(name: string) {
  const h = hashString(name.toLowerCase());
  return paletteFromHues(h % 360, (h * 7) % 360);
}

function VigorPips({ vigor }: { vigor: number }) {
  return (
    <span className="pips" title={`Vigor ${vigor}/${VIGOR_CAP}`} aria-label={`Vigor ${vigor} of ${VIGOR_CAP}`}>
      {Array.from({ length: VIGOR_CAP }, (_, i) => (
        <i key={i} className={i < vigor ? "pip on" : "pip"} />
      ))}
    </span>
  );
}

function Home(props: {
  save: SaveV1;
  hpNow: number;
  omenName: string;
  onArena: () => void;
  onTapestry: () => void;
  onReorder: (from: number, to: number) => void;
  onOffering: () => void;
  onReset: () => void;
}) {
  const { save, hpNow, omenName } = props;
  const c = save.champion;
  const need = costToNext(c.level);
  return (
    <div className="home">
      <section className="card champ-card">
        <Medallion champion={c} size={96} />
        <div className="champ-meta">
          <h2 className="champ-name">
            {c.displayName} <span className="epithet">{c.epithet}</span>
          </h2>
          <div className="muted">
            {omenName} · Level {c.level}
          </div>
          <div className="xpbar" title={`${c.xp}/${need} XP to level ${c.level + 1}`}>
            <div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / need) * 100)}%` }} />
          </div>
          <div className="statline">
            {save.wins}W – {save.losses}L · HP {hpNow} · Favour {c.favour}
          </div>
        </div>
        <div className="hero-fig">
          <HopliteFigure
            height={150}
            palette={paletteFromHues(c.appearance.hue, c.appearance.hue2)}
            discipline={primaryDiscipline(c.weapons)}
          />
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>Stats</h3>
          <ul className="stats">
            <li><b>Might</b><span>{c.stats.might}</span></li>
            <li><b>Grace</b><span>{c.stats.grace}</span></li>
            <li><b>Tempo</b><span>{c.stats.tempo}</span></li>
            <li><b>Grit</b><span>{c.stats.grit}</span></li>
          </ul>
        </div>
        <div className="card">
          <h3>Arsenal <span className="muted small">(draw order)</span></h3>
          <ul className="arsenal">
            {c.weapons.map((id, i) => (
              <li key={id}>
                <span className="wname">
                  <DisciplineGlyph d={weapon(id).discipline} /> {weapon(id).name}
                </span>
                <span className="reorder">
                  <button aria-label="earlier" disabled={i === 0} onClick={() => props.onReorder(i, i - 1)}>▲</button>
                  <button aria-label="later" disabled={i === c.weapons.length - 1} onClick={() => props.onReorder(i, i + 1)}>▼</button>
                </span>
              </li>
            ))}
            <li className="muted"><span>Fists</span><span className="small">always last</span></li>
          </ul>
        </div>
      </section>

      {(c.skills.length > 0 || c.beasts.length > 0) && (
        <section className="card">
          <h3>Skills & Beasts</h3>
          <div className="chips">
            {c.skills.map((s) => (
              <span key={s} className={`chip chip-${skill(s).kind}`} title={skill(s).text}>
                {skill(s).name}
              </span>
            ))}
            {c.beasts.map((b, i) => (
              <span key={`${b}${i}`} className="chip chip-beast">{b.replace(/_/g, " ")}</span>
            ))}
          </div>
        </section>
      )}

      <div className="actions">
        <button className="btn primary big" onClick={props.onArena}>
          To the Arena
        </button>
        <button className="btn ghost" onClick={props.onTapestry}>
          Tapestry ({c.tapestry.length})
        </button>
      </div>

      <div className="devrow">
        <button className="btn tiny ghost" onClick={props.onOffering} title="Prototype only — Vigor is never sold">
          ⚱ Offer to the Fates (+6 Vigor · prototype)
        </button>
        <button className="btn tiny danger" onClick={props.onReset}>
          Return the thread
        </button>
      </div>
    </div>
  );
}

function Arena(props: {
  save: SaveV1;
  onBack: () => void;
  onRefresh: () => void;
  onChallenge: (r: Rival) => void;
}) {
  const { save } = props;
  const board = useMemo(
    () => arenaBoard(save.champion, todayKey(), save.boardRefresh),
    [save.champion, save.boardRefresh],
  );
  return (
    <div className="arena">
      <div className="arena-head">
        <button className="btn ghost" onClick={props.onBack}>← Hall</button>
        <h2>The Arena</h2>
        <button className="btn ghost" onClick={props.onRefresh}>Seek new rivals</button>
      </div>
      {save.vigor <= 0 && (
        <p className="notice">Your Vigor is spent. The Fates refill it at dawn (UTC) — or make a prototype offering from your Hall.</p>
      )}
      <div className="rivals">
        {board.map((r) => {
          const seen = save.seenPlans[r.snapshot.name];
          return (
            <div className="card rival" key={r.snapshot.name}>
              <div className="rival-top">
                <HelmBust size={52} palette={rivalPalette(r.snapshot.name)} mirror />
                <span className="champ-name small">{r.snapshot.name}</span>
                <span className="pill">Lv {r.snapshot.level}</span>
              </div>
              <div className="muted small">
                ✦ {r.kleos} · {r.snapshot.weapons.map((w) => weapon(w).name).join(", ") || "Fists"}
              </div>
              <div className="muted small">
                {r.snapshot.skills.length > 0
                  ? r.snapshot.skills.map((s) => skill(s).name).join(", ")
                  : "No known skills"}
                {r.snapshot.beasts.length > 0 && ` · beasts: ${r.snapshot.beasts.length}`}
              </div>
              <div className="lastseen small">
                {seen
                  ? `Last seen: ${seen.stance} / ${seen.gambit.replace(/_/g, " ")}`
                  : "Battle Plan unknown — never fought"}
              </div>
              <button
                className="btn primary"
                disabled={save.vigor <= 0}
                onClick={() => props.onChallenge(r)}
              >
                Challenge (1 ⚡)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanSheet(props: {
  champion: Champion;
  rival: Rival;
  lastSeen?: BattlePlan;
  initial: BattlePlan;
  disabled: boolean;
  onCancel: () => void;
  onFight: (plan: BattlePlan) => void;
}) {
  const { champion, rival } = props;
  const trumps = champion.skills.filter((s) => skill(s).kind === "trump");
  const [stance, setStance] = useState<Stance>(props.initial.stance);
  const [gambit, setGambit] = useState<GambitId>(props.initial.gambit);
  const [trumpSkill, setTrumpSkill] = useState<string | undefined>(
    props.initial.trumpSkill && trumps.includes(props.initial.trumpSkill)
      ? props.initial.trumpSkill
      : trumps[0],
  );
  const [trumpTrigger, setTrumpTrigger] = useState<TrumpTrigger>(
    props.initial.trumpTrigger ?? "when_bloodied",
  );

  const gambits = GAMBITS.filter(
    (g) => g.id !== "loose_the_beast" || champion.beasts.length > 0,
  );

  return (
    <div className="plansheet">
      <h2>Battle Plan</h2>
      <p className="muted">
        vs <b>{rival.snapshot.name}</b> (Lv {rival.snapshot.level}) —{" "}
        {props.lastSeen
          ? `last seen fighting ${props.lastSeen.stance} / ${props.lastSeen.gambit.replace(/_/g, " ")}`
          : "you have never seen their plan"}
      </p>

      <h3>Stance</h3>
      <div className="pick-row">
        {STANCES.map((s) => (
          <button
            key={s.id}
            className={`pick ${stance === s.id ? "picked" : ""}`}
            onClick={() => setStance(s.id)}
          >
            <b>{s.name}</b>
            <span>{s.blurb}</span>
          </button>
        ))}
      </div>

      <h3>Gambit</h3>
      <div className="pick-row wrap">
        {gambits.map((g) => (
          <button
            key={g.id}
            className={`pick ${gambit === g.id ? "picked" : ""}`}
            onClick={() => setGambit(g.id)}
          >
            <b>{g.name}</b>
            <span>{g.blurb}</span>
          </button>
        ))}
      </div>

      <h3>Trump</h3>
      {trumps.length === 0 ? (
        <p className="muted small">No Trump known yet — the Fates may offer one in a draft.</p>
      ) : (
        <div className="trump-row">
          <select value={trumpSkill} onChange={(e) => setTrumpSkill(e.target.value)} aria-label="Trump skill">
            {trumps.map((t) => (
              <option key={t} value={t}>{skill(t).name}</option>
            ))}
          </select>
          <span className="muted">when</span>
          <select
            value={trumpTrigger}
            onChange={(e) => setTrumpTrigger(e.target.value as TrumpTrigger)}
            aria-label="Trump trigger"
          >
            {TRIGGERS.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="actions">
        <button className="btn ghost" onClick={props.onCancel}>Back</button>
        <button
          className="btn primary big"
          disabled={props.disabled}
          onClick={() =>
            props.onFight({
              stance,
              gambit,
              trumpSkill: trumps.length > 0 ? trumpSkill : undefined,
              trumpTrigger: trumps.length > 0 ? trumpTrigger : undefined,
            })
          }
        >
          FIGHT
        </button>
      </div>
    </div>
  );
}

function DraftModal(props: {
  champion: Champion;
  offers: FateOffer[];
  canReroll: boolean;
  onReroll: () => void;
  onPick: (i: number) => void;
}) {
  const { champion, offers } = props;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Threads of Fate">
      <div className="draft card">
        <h2>Threads of Fate</h2>
        <p className="muted">
          Lachesis offers three threads for level {champion.level + 1}. Keep one.
        </p>
        <div className="fate-row">
          {offers.map((o, i) => (
            <button key={i} className="fate-card" onClick={() => props.onPick(i)}>
              <span className="fate-kind">{o.kind.startsWith("stat") ? "Vigour of the body" : o.kind === "weapon" ? "Bronze for the hand" : o.kind === "skill" ? "A gift of craft" : "A companion's oath"}</span>
              <b>{describeOffer(o)}</b>
              <span className="fate-detail">{offerDetail(o)}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost" disabled={!props.canReroll} onClick={props.onReroll}>
          Reroll — spend 1 Favour ({champion.favour} held)
        </button>
      </div>
    </div>
  );
}

function offerDetail(o: FateOffer): string {
  if (o.kind === "weapon") return weapon(o.weapon).flavour;
  if (o.kind === "skill") return skill(o.skill).text;
  if (o.kind === "beast") return "Takes a Grit tax while it fights beside you.";
  return "Reliable. Permanent. Yours.";
}

function Tapestry({ champion, onBack }: { champion: Champion; onBack: () => void }) {
  return (
    <div className="tapestry">
      <div className="arena-head">
        <button className="btn ghost" onClick={onBack}>← Hall</button>
        <h2>The Tapestry</h2>
        <span />
      </div>
      <p className="muted">
        Every draft, woven in order. This is {champion.displayName}'s public build history.
      </p>
      {champion.tapestry.length === 0 && <p className="muted">Nothing woven yet — win fights, level up.</p>}
      <ol className="bands">
        {[...champion.tapestry].reverse().map((band, i) => (
          <li key={i} className="card band">
            <span className="pill">Lv {band.level}</span>
            {band.offers.map((o, j) => (
              <span key={j} className={`thread ${j === band.picked ? "kept" : ""}`}>
                {describeOffer(o)}
              </span>
            ))}
            {band.rerolled && <span className="muted small">(rerolled)</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
