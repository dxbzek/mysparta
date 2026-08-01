import { useEffect, useMemo, useState } from "react";
import {
  BEASTS,
  BOONS,
  STAT_LABEL,
  TECHNIQUES,
  TRUMPS,
  WEAPONS,
  applyDraft,
  arenaBoard,
  beast,
  combineSeed,
  costToNext,
  createChampion,
  describeOffer,
  fightXp,
  generateDraft,
  kleosDelta,
  makeRng,
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
import { FightTheatre, type StageFigure } from "./FightTheatre.js";
import { BeastFigure, DisciplineGlyph } from "./art.js";
import { HEROES, HeroBust, HeroSprite, heroIndexFor } from "./heroes.js";
import {
  applyDailyReset,
  freshQuests,
  load,
  newSave,
  persist,
  todayKey,
  wipe,
  type SaveV1,
  VIGOR_CAP,
} from "./save.js";
import { sound } from "./sound.js";

type Screen =
  | { s: "forge" }
  | { s: "home" }
  | { s: "arena" }
  | { s: "fight"; result: FightResult; rival: Rival; rewards: { xp: number; kleos: number } }
  | { s: "history" }
  | { s: "codex" };

/** League tiers give the rating number meaning (03-gdd-systems.md §1.4). */
function league(kleos: number): { name: string; color: string } {
  if (kleos >= 1950) return { name: "S-Rank", color: "#f4c94e" };
  if (kleos >= 1850) return { name: "A-Rank", color: "#f47c8e" };
  if (kleos >= 1750) return { name: "B-Rank", color: "#a78bfa" };
  if (kleos >= 1650) return { name: "C-Rank", color: "#5fc9f5" };
  if (kleos >= 1550) return { name: "D-Rank", color: "#4ed4a7" };
  return { name: "E-Rank", color: "#aab3c8" };
}

/**
 * Pure-RNG fight behaviour (MyBrute style): every fight, both sides get a
 * seeded-random stance, opening and instinct for their special moves —
 * no player input, but deterministic per fight seed so replays hold.
 */
function randomPlan(c: Champion, seed: number): BattlePlan {
  const rng = makeRng(seed);
  const stances: Stance[] = ["aggressive", "measured", "guarded"];
  const gambits: GambitId[] = ["close_the_gap", "hold_ground", "feint", "test_the_shield", "war_cry"];
  if (c.weapons.some((w) => weapon(w).discipline === "akontia")) gambits.push("hurl_first");
  if (c.beasts.length > 0) gambits.push("loose_the_beast");
  const plan: BattlePlan = { stance: rng.pick(stances), gambit: rng.pick(gambits) };
  const trumps = c.skills.filter((s) => skill(s).kind === "trump");
  if (trumps.length > 0) {
    const triggers: TrumpTrigger[] = [
      "first_clash", "first_blood_taken", "when_bloodied", "deaths_door",
      "foe_bloodied", "first_crit", "tenth_exchange",
    ];
    plan.trumpSkill = rng.pick(trumps);
    plan.trumpTrigger = rng.pick(triggers);
  }
  return plan;
}

/** Weapon in hand at the bell (first non-shield in draw order). */
function heldWeaponId(weapons: string[]): string | undefined {
  return weapons.find((id) => weapon(id).discipline !== "aspis");
}

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

  if (!save || screen.s === "forge") {
    return (
      <Shell>
        <Forge
          onForge={(champion, hero) => {
            const s = newSave(champion, { stance: "measured", gambit: "close_the_gap" }, hero);
            update(s);
            setScreen({ s: "home" });
          }}
        />
      </Shell>
    );
  }

  const c = save.champion;

  const startFight = (rival: Rival) => {
    const fresh = applyDailyReset(save);
    if (fresh.vigor <= 0) return;
    const champion = structuredClone(fresh.champion);
    const seed = combineSeed(champion.seed, fresh.totalFights, rival.snapshot.name, todayKey());
    const plan = randomPlan(champion, combineSeed(seed, "plan"));
    const result = simulateFight({
      seed,
      attacker: snapshot(champion, plan),
      defender: rival.snapshot,
    });
    const won = result.winner === 0;
    const xpGain = fightXp(won, fresh.kleos, rival.kleos);
    const kd = kleosDelta(won, fresh.kleos, rival.kleos);
    champion.xp += xpGain;

    // Daily tasks: fight 3, win 2, land a crit → +1 reroll.
    const q = fresh.quests?.day === todayKey() ? { ...fresh.quests } : freshQuests();
    q.fights += 1;
    if (won) q.wins += 1;
    if (result.events.some((e) => e.type === "hit" && e.side === 0 && e.crit)) q.crits += 1;
    if (!q.claimed && q.fights >= 3 && q.wins >= 2 && q.crits >= 1) {
      q.claimed = true;
      champion.favour = Math.min(6, champion.favour + 1);
    }

    const next: SaveV1 = {
      ...fresh,
      champion,
      vigor: fresh.vigor - 1,
      totalFights: fresh.totalFights + 1,
      wins: fresh.wins + (won ? 1 : 0),
      losses: fresh.losses + (won ? 0 : 1),
      kleos: Math.max(1000, fresh.kleos + kd),
      plan,
      seenPlans: { ...fresh.seenPlans, [rival.snapshot.name]: rival.snapshot.plan },
      quests: q,
    };
    update(next);
    setScreen({ s: "fight", result, rival, rewards: { xp: xpGain, kleos: kd } });
  };

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

  return (
    <Shell
      header={
        <header className="topbar">
          <button className="wordmark" onClick={() => setScreen({ s: "home" })}>
            RANK ZERO
          </button>
          <div className="topbar-right">
            <span
              className="pill league-pill"
              style={{ background: league(save.kleos).color }}
              title={`Rating ${save.kleos} — ${league(save.kleos).name} league`}
            >
              {league(save.kleos).name} {save.kleos}
            </span>
            <span className="pill" title={`Fights refill daily (+6, up to ${VIGOR_CAP})`}>
              ⚡ {save.vigor} fights
            </span>
            <button
              className="pill sound-toggle"
              onClick={() => {
                sound.setMuted(!sound.isMuted());
                update({ ...save });
              }}
              title={sound.isMuted() ? "Sound is off" : "Sound is on"}
            >
              {sound.isMuted() ? "🔇" : "🔊"}
            </button>
          </div>
        </header>
      }
    >
      {screen.s === "home" && (
        <Home
          save={save}
          onArena={() => setScreen({ s: "arena" })}
          onHistory={() => setScreen({ s: "history" })}
          onCodex={() => setScreen({ s: "codex" })}
          onReorder={(from, to) => {
            const champion = structuredClone(c);
            const [moved] = champion.weapons.splice(from, 1);
            champion.weapons.splice(to, 0, moved!);
            update({ ...save, champion });
          }}
          onRefill={() => update({ ...save, vigor: Math.min(VIGOR_CAP, save.vigor + 6) })}
          onDelete={() => {
            // Confirmation happens in-app (two taps) — window.confirm is
            // silently blocked in sandboxed embeds.
            wipe();
            setSave(null);
            setDraft(null);
            setScreen({ s: "forge" });
          }}
        />
      )}

      {screen.s === "arena" && (
        <Arena
          save={save}
          onBack={() => setScreen({ s: "home" })}
          onRefresh={() => update({ ...save, boardRefresh: save.boardRefresh + 1 })}
          onFight={startFight}
        />
      )}

      {screen.s === "fight" && (
        <FightTheatre
          result={screen.result}
          rewards={screen.rewards}
          names={[c.displayName, screen.rival.snapshot.name]}
          figures={
            [
              {
                hero: save.hero ?? heroIndexFor(c.displayName),
                weaponId: heldWeaponId(c.weapons),
                beasts: c.beasts,
              },
              {
                hero: heroIndexFor(screen.rival.snapshot.name),
                weaponId: heldWeaponId(screen.rival.snapshot.weapons),
                beasts: screen.rival.snapshot.beasts,
              },
            ] satisfies [StageFigure, StageFigure]
          }
          onDone={() => {
            openDraftIfDue(save);
            setScreen({ s: "arena" });
          }}
        />
      )}

      {screen.s === "history" && <History champion={c} onBack={() => setScreen({ s: "home" })} />}
      {screen.s === "codex" && <Codex champion={c} onBack={() => setScreen({ s: "home" })} />}

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

/* ================= shell ================= */

function Shell({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
  return (
    <div className="shell">
      {header}
      <main className="content">{children}</main>
      <footer className="foot">
        RANK ZERO prototype — deterministic sim v1 · your progress is saved in this browser
      </footer>
    </div>
  );
}

/* ================= forge (2 steps: name → style) ================= */

function Forge({ onForge }: { onForge: (c: Champion, hero: number) => void }) {
  const [name, setName] = useState("");
  const [champ, setChamp] = useState<Champion | null>(null);
  const [hero, setHero] = useState<number | null>(null);
  const preview = useMemo(() => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return null;
    try {
      return createChampion(trimmed);
    } catch {
      return null;
    }
  }, [name]);

  if (!champ) {
    return (
      <div className="forge">
        <h1 className="forge-title">Enter your name.</h1>
        <p className="forge-sub">Every name awakens a different hunter — same name, same hunter, always.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (preview) {
              setChamp(preview);
              setHero(heroIndexFor(preview.displayName));
            }
          }}
        >
          <input
            className="forge-input"
            value={name}
            maxLength={24}
            placeholder="e.g. Kassia"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            aria-label="Champion name"
          />
          {preview && (
            <div className="forge-preview card">
              <HeroBust hero={heroIndexFor(preview.displayName)} size={72} />
              <div>
                <div className="champ-name">
                  {preview.displayName} <span className="epithet">{preview.epithet}</span>
                </div>
                <div className="muted">{omen(preview.omen).name}</div>
                <div className="statline">
                  {STAT_LABEL.might} {preview.stats.might} · {STAT_LABEL.grace} {preview.stats.grace} ·{" "}
                  {STAT_LABEL.tempo} {preview.stats.tempo} · {STAT_LABEL.grit} {preview.stats.grit}
                </div>
              </div>
            </div>
          )}
          <button className="btn primary big" type="submit" disabled={!preview}>
            Awaken my Hunter
          </button>
        </form>
        <p className="fineprint">Next: choose their form. Stats and gear grow from your choices as you level.</p>
      </div>
    );
  }

  const picked = hero ?? heroIndexFor(champ.displayName);

  return (
    <div className="forge">
      <h1 className="forge-title">Choose your form.</h1>
      <p className="forge-sub">
        {champ.displayName} <span className="epithet">{champ.epithet}</span> — the look is yours to choose; strength you earn.
      </p>
      <div className="styler">
        <div className="styler-stage">
          <HeroSprite hero={picked} height={210} />
          <div className="hero-caption">
            <b>{HEROES[picked]!.name}</b>
            <span className="muted small">{HEROES[picked]!.blurb}</span>
          </div>
        </div>

        <div className="roster">
          {HEROES.map((h, i) => (
            <button key={h.name} className={`hero-card ${picked === i ? "picked" : ""}`} onClick={() => setHero(i)}>
              <HeroSprite hero={i} height={110} />
              <b>{h.name}</b>
              <span className="muted small">{h.role}</span>
            </button>
          ))}
        </div>

        <div className="actions">
          <button className="btn ghost" onClick={() => setHero(Math.floor(Math.random() * HEROES.length))}>
            Surprise me
          </button>
          <button className="btn primary big" onClick={() => onForge(champ, picked)}>
            Start Hunting →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= home ================= */

function Home(props: {
  save: SaveV1;
  onArena: () => void;
  onHistory: () => void;
  onCodex: () => void;
  onReorder: (from: number, to: number) => void;
  onRefill: () => void;
  onDelete: () => void;
}) {
  const { save } = props;
  const c = save.champion;
  const need = costToNext(c.level);
  const hpNow = maxHp(c.level, c.stats.grit, c.beasts, c.skills.includes("beast_bond"));
  const [armDelete, setArmDelete] = useState(false);
  useEffect(() => {
    if (!armDelete) return;
    const t = window.setTimeout(() => setArmDelete(false), 4000);
    return () => window.clearTimeout(t);
  }, [armDelete]);

  return (
    <div className="home">
      {save.totalFights < 3 && (
        <section className="card hint">
          <p>
            <b>How it plays:</b> fight rivals → earn XP → level up → pick 1 of 3 upgrades
            (stats, weapons, skills or beasts). You get <b>6 fights a day</b> (they bank up to 12).{" "}
            <span className="muted">Your name set your awakening — your choices decide the rest.</span>
          </p>
        </section>
      )}

      <section className="card champ-card">
        <HeroBust hero={save.hero ?? heroIndexFor(c.displayName)} size={92} />
        <div className="champ-meta">
          <h2 className="champ-name">
            {c.displayName} <span className="epithet">{c.epithet}</span>
          </h2>
          <div className="muted">
            {omen(c.omen).name} · Level {c.level}
          </div>
          <div className="xpbar" title={`XP toward level ${c.level + 1}`}>
            <div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / need) * 100)}%` }} />
          </div>
          <div className="statline">
            XP {c.xp}/{need} · {save.wins}W – {save.losses}L · HP {hpNow} · Rerolls: {c.favour}
          </div>
        </div>
        <div className="hero-fig">
          <HeroSprite hero={save.hero ?? heroIndexFor(c.displayName)} height={150} />
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>Stats</h3>
          <ul className="stats">
            <li><b>{STAT_LABEL.might}</b><span>{c.stats.might}</span></li>
            <li><b>{STAT_LABEL.grace}</b><span>{c.stats.grace}</span></li>
            <li><b>{STAT_LABEL.tempo}</b><span>{c.stats.tempo}</span></li>
            <li><b>{STAT_LABEL.grit}</b><span>{c.stats.grit}</span></li>
          </ul>
        </div>
        <div className="card">
          <h3>Weapons <span className="muted small">(drawn in this order)</span></h3>
          <ul className="arsenal">
            {c.weapons.map((id, i) => (
              <li key={id}>
                <span className="wname">
                  <DisciplineGlyph d={weapon(id).discipline} /> {weapon(id).name}
                  <span className="muted small">
                    {weapon(id).discipline === "aspis"
                      ? "shield"
                      : `dmg ${weapon(id).dmg} · ${weapon(id).interval <= 240 ? "fast" : weapon(id).interval <= 320 ? "steady" : "heavy"}`}
                  </span>
                </span>
                <span className="reorder">
                  <button aria-label="draw earlier" disabled={i === 0} onClick={() => props.onReorder(i, i - 1)}>▲</button>
                  <button aria-label="draw later" disabled={i === c.weapons.length - 1} onClick={() => props.onReorder(i, i + 1)}>▼</button>
                </span>
              </li>
            ))}
            <li className="muted"><span className="wname"><DisciplineGlyph d="fists" /> Fists</span><span className="small">always last</span></li>
          </ul>
        </div>
      </section>

      <section className="card quests">
        <h3>Today's Tasks {save.quests?.claimed && <span className="owned-badge">DONE — +1 Reroll</span>}</h3>
        <ul className="qlist">
          <li className={(save.quests?.fights ?? 0) >= 3 ? "qdone" : ""}>
            Fight 3 times ({Math.min(3, save.quests?.fights ?? 0)}/3)
          </li>
          <li className={(save.quests?.wins ?? 0) >= 2 ? "qdone" : ""}>
            Win 2 fights ({Math.min(2, save.quests?.wins ?? 0)}/2)
          </li>
          <li className={(save.quests?.crits ?? 0) >= 1 ? "qdone" : ""}>
            Land a critical hit ({Math.min(1, save.quests?.crits ?? 0)}/1)
          </li>
        </ul>
        <p className="muted small">Complete all three for +1 reroll. Resets daily.</p>
      </section>

      {(c.skills.length > 0 || c.beasts.length > 0) && (
        <section className="card">
          <h3>Skills & Pets</h3>
          <div className="chips">
            {c.skills.map((s) => (
              <span key={s} className={`chip chip-${skill(s).kind}`} title={skill(s).text}>
                {skill(s).name}
              </span>
            ))}
            {c.beasts.map((b, i) => (
              <span key={`${b}${i}`} className="chip chip-beast" title={beast(b).flavour}>
                {beast(b).name}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="actions">
        <button className="btn primary big" onClick={props.onArena}>
          ⚔ Fight in the Arena
        </button>
        <button className="btn ghost" onClick={props.onHistory}>
          Level-Up History ({c.tapestry.length})
        </button>
        <button className="btn ghost" onClick={props.onCodex}>
          Codex
        </button>
      </div>

      <div className="devrow">
        <button className="btn tiny ghost" onClick={props.onRefill} title="Testing only — fights are never sold in the real game">
          Dev: +6 fights
        </button>
        <button
          className={`btn tiny danger ${armDelete ? "armed" : ""}`}
          onClick={() => (armDelete ? props.onDelete() : setArmDelete(true))}
        >
          {armDelete ? "Tap again — deletes forever!" : "Delete Hunter"}
        </button>
      </div>
    </div>
  );
}

/* ================= arena ================= */

function Arena(props: {
  save: SaveV1;
  onBack: () => void;
  onRefresh: () => void;
  onFight: (r: Rival) => void;
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
        <button className="btn ghost" onClick={props.onRefresh}>New rivals</button>
      </div>
      {save.vigor <= 0 && (
        <p className="notice">
          You're out of fights for today — 6 more arrive at the daily reset (midnight UTC).
          For testing, use "Dev: +6 fights" in your Hall.
        </p>
      )}
      <div className="rivals">
        {board.map((r) => {
          return (
            <div className="card rival" key={r.snapshot.name}>
              <div className="rival-top">
                <HeroBust hero={heroIndexFor(r.snapshot.name)} size={52} mirror />
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
                {r.snapshot.beasts.length > 0 &&
                  ` · ${r.snapshot.beasts.map((b) => beast(b).name).join(", ")}`}
              </div>
              <button className="btn primary" disabled={save.vigor <= 0} onClick={() => props.onFight(r)}>
                Fight (1 ⚡)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= level-up draft ================= */

function DraftModal(props: {
  champion: Champion;
  offers: FateOffer[];
  canReroll: boolean;
  onReroll: () => void;
  onPick: (i: number) => void;
}) {
  const { champion, offers } = props;
  useEffect(() => {
    sound.levelUp();
  }, []);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Level up">
      <div className="draft card">
        <h2>Level up!</h2>
        <p className="muted">
          Choose one of three for level {champion.level + 1} — the choice is permanent.
        </p>
        <div className="fate-row">
          {offers.map((o, i) => (
            <button key={i} className="fate-card" onClick={() => props.onPick(i)}>
              <span className="fate-kind">
                {o.kind.startsWith("stat") ? "Stats" : o.kind === "weapon" ? "New weapon" : o.kind === "skill" ? "New skill" : "New pet"}
              </span>
              <b>{describeOffer(o)}</b>
              <span className="fate-detail">{offerDetail(o)}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost" disabled={!props.canReroll} onClick={props.onReroll}>
          Reroll all three ({champion.favour} reroll{champion.favour === 1 ? "" : "s"} left)
        </button>
      </div>
    </div>
  );
}

function offerDetail(o: FateOffer): string {
  if (o.kind === "weapon") return weapon(o.weapon).flavour;
  if (o.kind === "skill") return skill(o.skill).text;
  if (o.kind === "beast") return `${beast(o.beast).flavour} Costs ${beast(o.beast).gritTax} Endurance while it fights for you.`;
  return "Reliable. Permanent. Yours.";
}

/* ================= history (the Tapestry) ================= */

function History({ champion, onBack }: { champion: Champion; onBack: () => void }) {
  return (
    <div className="tapestry">
      <div className="arena-head">
        <button className="btn ghost" onClick={onBack}>← Hall</button>
        <h2>Level-Up History</h2>
        <span />
      </div>
      <p className="muted">
        Every level-up choice {champion.displayName} has made — kept picks highlighted, declined ones struck through.
      </p>
      {champion.tapestry.length === 0 && <p className="muted">Nothing yet — win fights to level up.</p>}
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

/* ================= codex ================= */

function Codex({ champion, onBack }: { champion: Champion; onBack: () => void }) {
  const speedLabel = (interval: number) =>
    interval <= 240 ? "Fast" : interval <= 320 ? "Steady" : "Heavy";
  return (
    <div className="codex">
      <div className="arena-head">
        <button className="btn ghost" onClick={onBack}>← Hall</button>
        <h2>Codex</h2>
        <span />
      </div>
      <p className="muted">
        Relic weapons and skills recovered from the Rifts, and the beasts tamed there. New ones arrive through level-up choices — nothing is ever sold.
      </p>

      <section className="card">
        <h3>Weapons — {WEAPONS.length} ({champion.weapons.length} owned)</h3>
        {WEAPONS.map((w) => (
          <div className="codex-row" key={w.id}>
            <DisciplineGlyph d={w.discipline} size={26} />
            <div className="grow">
              <div className="cname">{w.name}</div>
              <div className="cmeta">
                {w.discipline === "aspis"
                  ? "Shield"
                  : `Damage ${w.dmg} · ${speedLabel(w.interval)}${w.ammo ? ` · ${w.ammo} throws` : ""}${w.twoHanded ? " · two-handed" : ""}`}{" "}
                — {w.flavour}
              </div>
            </div>
            {champion.weapons.includes(w.id) ? (
              <span className="owned-badge">OWNED</span>
            ) : (
              <span className="locked-badge">level up to find</span>
            )}
          </div>
        ))}
      </section>

      {[
        { title: "Boons — always-on passives", list: BOONS },
        { title: "Techniques — trigger on their own", list: TECHNIQUES },
        { title: "Trumps — big moves that fire on instinct", list: TRUMPS },
      ].map((group) => (
        <section className="card" key={group.title}>
          <h3>
            {group.title} ({group.list.filter((s) => champion.skills.includes(s.id)).length}/{group.list.length})
          </h3>
          {group.list.map((s) => (
            <div className="codex-row" key={s.id}>
              <div className="grow">
                <div className="cname">{s.name}</div>
                <div className="cmeta">{s.text}</div>
              </div>
              {champion.skills.includes(s.id) ? (
                <span className="owned-badge">OWNED</span>
              ) : (
                <span className="locked-badge">level up to find</span>
              )}
            </div>
          ))}
        </section>
      ))}

      <section className="card">
        <h3>Pets — {BEASTS.length} ({champion.beasts.length} at your side)</h3>
        {BEASTS.map((b) => (
          <div className="codex-row" key={b.id}>
            <BeastFigure beastId={b.id} size={52} />
            <div className="grow">
              <div className="cname">{b.name}</div>
              <div className="cmeta">
                HP {b.hpBase}+level · hits {b.dmgMin}–{b.dmgMax} · costs {b.gritTax} Endurance — {b.flavour}
              </div>
            </div>
            {champion.beasts.includes(b.id) ? (
              <span className="owned-badge">WITH YOU</span>
            ) : (
              <span className="locked-badge">level up to find</span>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
