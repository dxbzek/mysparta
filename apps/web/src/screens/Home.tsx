/** The Hall: your champion, what they carry, and the one button that matters. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  LEVEL_CAP,
  STAT_LABEL,
  beast,
  costToNext,
  maxHp,
  omen,
  skill,
  weapon,
} from "@agoge/core";
import { PetSprite } from "../pixelPets.js";
import { WeaponIcon } from "../weaponIcons.js";
import { SkillIcon, type SkillKind } from "../skillIcons.js";
import { PixIcon } from "../pixelIcons.js";
import { AuraSparks, FighterBust, FighterFig, lookFor, type FighterAnim } from "../fighters.js";
import { ARENAS } from "../arenas.js";
import { arenaScene } from "../arenaArt.js";
import { gearDetail, gearItem, gearPool, gearStatLine, lookWithGear, resolveExtras, type GearItem, type GearSlot } from "../gear.js";
import { encodeSave, questProgress, questsForDay, untilReset, type SaveV1 } from "../save.js";
import type { Look } from "../paperdoll.js";
import { DISCIPLINE_NAME, StandingsStrip } from "../ui.js";

const PORTRAIT_POSES: Array<{ id: FighterAnim; name: string }> = [
  { id: "stance", name: "Guard" },
  { id: "idle", name: "At ease" },
  { id: "attack1", name: "Strike" },
  { id: "attack2", name: "Thrust" },
  { id: "run", name: "Charge" },
];

/**
 * The Hall portrait: a framed plate with a painted arena behind the champion,
 * who stands on its ground line. Both the pose and the backdrop are the
 * player's to choose — this is the picture of their hunter.
 */
function ChampionPortrait({
  look,
  aura,
  particles,
  portrait,
  onChange,
}: {
  look: Look;
  aura: number;
  particles?: string;
  portrait: { arena: number; pose: string };
  onChange: (p: { arena: number; pose: string }) => void;
}) {
  const SCALE = 3;
  const NW = 78;
  const NH = 82;
  const arena = ARENAS[portrait.arena % ARENAS.length]!;
  /*
   * The champion has to fit the plate, and the plate's height is decided by
   * CSS — capped by viewport height on short screens, stretched by the card on
   * wide ones. A fixed 3x sprite in a 115px-tall plate loses its head, so the
   * figure is measured against the box it actually got rather than assumed.
   * Integer scales only: this is pixel art, and 2.4x is mush.
   */
  const plateRef = useRef<HTMLDivElement>(null);
  const [figScale, setFigScale] = useState(SCALE);
  useLayoutEffect(() => {
    const fit = () => {
      const h = plateRef.current?.clientHeight ?? 0;
      if (!h) return;
      // The sprite stands on the ground line, which CSS clamps to 22% of the
      // plate on short boxes — so what it actually has is the 78% above that.
      const usable = h * 0.78;
      setFigScale(Math.max(1, Math.min(SCALE, Math.floor(usable / 48))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (plateRef.current) ro.observe(plateRef.current);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);
  const pose = (PORTRAIT_POSES.find((p) => p.id === portrait.pose) ?? PORTRAIT_POSES[0]!).id;
  const poseAt = PORTRAIT_POSES.findIndex((p) => p.id === pose);
  const step = (d: number) =>
    onChange({ ...portrait, pose: PORTRAIT_POSES[(poseAt + d + PORTRAIT_POSES.length) % PORTRAIT_POSES.length]!.id });
  const shift = (d: number) =>
    onChange({ ...portrait, arena: (portrait.arena + d + ARENAS.length) % ARENAS.length });

  return (
    <div className="portrait-wrap">
      {/*
        The plate is a fixed composition — scene, ground line and figure are all
        sized off SCALE. Handing CSS the natural size and the ground line as a
        percentage lets the phone stretch the whole thing to the card's width
        (see .champ-card .portrait) without the champion floating off the
        horizon or shrinking to a speck in the middle of it.
      */}
      <div
        className="portrait"
        ref={plateRef}
        style={
          {
            backgroundImage: `url(${arenaScene(arena, NW, NH)})`,
            "--plate-w": `${NW * SCALE}`,
            "--plate-h": `${NH * SCALE}`,
            // Where the ground line falls once the scene is scaled to the
            // plate's WIDTH — in hundredths of that width, so the phone rule
            // can crop the scene's height without the champion leaving it.
            "--ground-cqw": `${(1 - arena.horizon) * (NH / NW) * 100 - 100 / NW}`,
          } as React.CSSProperties
        }
      >
        <AuraSparks aura={aura} />
        <span
          className="portrait-figure"
          style={
            {
              // A var, not an inline `bottom` — the phone rule below has to be
              // able to win, and an inline declaration beats any stylesheet.
              "--ground-pct": `${(1 - arena.horizon) * 100 - 100 / NH}%`,
            } as React.CSSProperties
          }
        >
          <FighterFig look={look} height={48 * figScale} anim={pose} aura={aura} particles={particles} />
        </span>
      </div>
      {/*
        Two steppers, each its own group. Flat, the six controls were one wrap
        context: when the row ran out of width the LAST arrow dropped to a line
        of its own, orphaned from the label it belongs to. Grouped, a pair
        either fits or moves as a pair.
      */}
      <div className="portrait-controls">
        <div className="stepper" role="group" aria-label="Pose">
          <button className="nudge" onClick={() => step(-1)} aria-label="Previous pose">
            <PixIcon name="arrowLeft" size={9} />
          </button>
          <span className="portrait-label">{PORTRAIT_POSES[poseAt]!.name}</span>
          <button className="nudge flip" onClick={() => step(1)} aria-label="Next pose">
            <PixIcon name="arrowLeft" size={9} />
          </button>
        </div>
        <div className="stepper" role="group" aria-label="Backdrop">
          <button className="nudge" onClick={() => shift(-1)} aria-label="Previous backdrop">
            <PixIcon name="arrowLeft" size={9} />
          </button>
          <span className="portrait-label wide">{arena.name}</span>
          <button className="nudge flip" onClick={() => shift(1)} aria-label="Next backdrop">
            <PixIcon name="arrowLeft" size={9} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** What each stat actually buys, so the Stats card teaches instead of
 *  listing four numbers and leaving the rest of the panel empty. */
const STAT_DOES: Record<string, string> = {
  Strength: "damage on every hit",
  Agility: "evasion, blocks and ripostes",
  Speed: "how often you act",
  Endurance: "health, and how many pets you can keep",
};

function StatRow({ label, value, teach }: { label: string; value: number; teach: boolean }) {
  // 24 is comfortably past a maxed early-game stat, so the bar keeps meaning
  const pct = Math.max(4, Math.min(100, (value / 24) * 100));
  return (
    // What the stat buys is worth saying once, while the player is learning.
    // Kept on every row forever it was four lines of noise that doubled the
    // card's height, so after the first few fights it lives on the tooltip.
    <li title={`${label} — ${STAT_DOES[label]}`}>
      <b>{label}</b>
      <span className="statbar"><i style={{ width: `${pct}%` }} /></span>
      <span className="num">{value}</span>
      {teach && <em className="stat-does">{STAT_DOES[label]}</em>}
    </li>
  );
}

function Quest({ at, of, children }: { at: number; of: number; children: React.ReactNode }) {
  const done = at >= of;
  return (
    <li className={done ? "qdone" : ""}>
      <span className="qbox">{done && <PixIcon name="check" size={9} />}</span>
      <span className="qbody">
        <span className="qtext">{children}</span>
        <span className="qbar">
          <span className="qbar-fill" style={{ width: `${Math.min(100, (at / of) * 100)}%` }} />
        </span>
      </span>
      <span className="qcount">{Math.min(at, of)}/{of}</span>
    </li>
  );
}


/**
 * A weapon's character at a glance: how hard it hits, how often, how far it
 * reaches. Bars beat "dmg 10 · steady" because two weapons can be compared
 * without doing arithmetic.
 */
function WeaponBars({ w }: { w: ReturnType<typeof weapon> }) {
  if (w.discipline === "aspis") {
    return <div className="muted small">Raised to turn blows aside — never swung.</div>;
  }
  // 900ms is about the slowest swing in the game; invert so faster reads fuller
  const speed = Math.max(6, Math.min(100, ((450 - w.interval) / 270) * 100));
  const rows: Array<[string, number]> = [
    ["Damage", Math.min(100, (w.dmg / 22) * 100)],
    ["Speed", speed],
    ["Reach", Math.min(100, ((w.reach + 1) / 4) * 100)],
  ];
  return (
    <div className="wbars">
      {rows.map(([label, pct]) => (
        <div className="wbar-row" key={label}>
          <span>{label}</span>
          <span className="statbar"><i style={{ width: `${pct}%` }} /></span>
        </div>
      ))}
    </div>
  );
}


export function Home(props: {
  save: SaveV1;
  onArena: () => void;
  onHistory: () => void;
  onCodex: () => void;
  onLadder: () => void;
  onRoster: () => void;
  onReorder: (from: number, to: number) => void;
  onDelete: () => void;
  onEquip: (slot: GearSlot, id: string | undefined) => void;
  onPortrait: (p: { arena: number; pose: string }) => void;
}) {
  const { save } = props;
  const c = save.champion;
  const baseLook = save.look ?? lookFor(c.displayName);
  const worn = lookWithGear(baseLook, save.equipped);
  const extras = resolveExtras(save.aura ?? 0, save.equipped);
  const ownedGear = (save.gear ?? []).map((id) => gearItem(id)).filter((g): g is GearItem => !!g);
  const need = costToNext(c.level);
  const hpNow = maxHp(c.level, c.stats.grit, c.beasts, c.skills.includes("beast_bond"));
  /** The first few fights are the only time the Hall explains itself. */
  const teaching = save.totalFights < 3;
  const [armDelete, setArmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const q = save.quests;
  const todaysTasks = questsForDay();
  const tasksDone = todaysTasks.filter((d) => questProgress(q, d) >= d.need).length;
  useEffect(() => {
    if (!armDelete) return;
    const t = window.setTimeout(() => setArmDelete(false), 4000);
    return () => window.clearTimeout(t);
  }, [armDelete]);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <div className="home">
      {/*
        The asides are the first thing to go on a phone: the loop and the daily
        allowance survive, the parenthetical colour does not. One copy of the
        text, two lengths — see .say-more.
      */}
      {teaching && (
        <section className="card hint span-all">
          <p>
            <b>How it plays:</b> fight rivals → earn XP → level up → the Rift rolls your reward
            <span className="say-more"> (stats, weapons, skills, pets or gear — always a surprise)</span>.
            You get <b>6 fights a day</b>
            <span className="say-more"> (they bank up to 12)</span>.
            <span className="muted say-more"> Your name set your awakening — the Rift decides the rest.</span>
          </p>
        </section>
      )}

      <section className="card champ-card">
        {/* a framed portrait: the champion standing in an arena of their choosing */}
        <ChampionPortrait
          look={worn}
          aura={extras.aura}
          particles={extras.particles}
          portrait={save.portrait ?? { arena: 0, pose: "stance" }}
          onChange={(p) => props.onPortrait(p)}
        />
        <div className="champ-meta">
          <h2 className="champ-name">
            {c.displayName} <span className="epithet">{extras.title ?? c.epithet}</span>
          </h2>
          <div className="muted">
            {omen(c.omen).name} · Level {c.level}
          </div>
          {/* XP is a labelled meter with its number on it, not a rule drawn
              across the card with the reading stranded on the line below. */}
          {/* At the cap there is no next level, and costToNext says so with
              Infinity — which the meter printed straight to the player as
              "XP 0/Infinity". The top of the ladder should read as an
              achievement, not a broken number. */}
          {c.level >= LEVEL_CAP ? (
            <>
              <div className="xp-row">
                <span className="xp-cap">RANK</span>
                <div className="xpbar maxed" title="Nothing left to level — the Rift has given you everything">
                  <div className="xpbar-fill" style={{ width: "100%" }} />
                </div>
                <span className="xp-num">MAX</span>
              </div>
              {/* The cap used to be the end of the game. It is a fifty-day
                  climb; the least it can do is point at what comes next. */}
              <p className="muted small note capped-note">
                {c.displayName} has taken everything the Rift will give. The rating still moves —
                and a second hunter finds a different {" "}
                <button className="linkish" onClick={props.onRoster}>road through it</button>.
              </p>
            </>
          ) : (
            <div className="xp-row">
              <span className="xp-cap">XP</span>
              <div className="xpbar" title={`XP toward level ${c.level + 1}`}>
                <div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / need) * 100)}%` }} />
              </div>
              <span className="xp-num">{c.xp}/{need}</span>
            </div>
          )}
          {/* Two facts, not four. "Gear" repeated the Wardrobe's own counter and
              "Fights left" repeated the top bar, so half this row was an echo —
              which is what made it read as filler rather than information. */}
          <dl className="facts">
            <div>
              <dt>Record</dt>
              <dd>{save.wins}W – {save.losses}L</dd>
            </div>
            <div>
              <dt>Health</dt>
              <dd>{hpNow}</dd>
            </div>
          </dl>
          {/* The one verb in the game belongs next to the champion, not at the
              bottom of the page under the wardrobe. */}
          <button className="btn primary big card-cta" onClick={props.onArena} disabled={save.vigor <= 0}>
            <PixIcon name="swords" size={15} />{" "}
            {save.vigor > 0 ? `Fight in the Arena (${save.vigor} left)` : `Next fights in ${untilReset().text}`}
          </button>
        </div>
      </section>

      <section className="grid-2">
        <div className="card stats-card">
          <h3>Stats</h3>
          <ul className="stats">
            <StatRow label={STAT_LABEL.might} value={c.stats.might} teach={teaching} />
            <StatRow label={STAT_LABEL.grace} value={c.stats.grace} teach={teaching} />
            <StatRow label={STAT_LABEL.tempo} value={c.stats.tempo} teach={teaching} />
            <StatRow label={STAT_LABEL.grit} value={c.stats.grit} teach={teaching} />
          </ul>
        </div>
        <div className="card">
          <h3>Weapons <span className="muted small">(drawn in this order)</span></h3>
          <ul className="arsenal rack">
            {c.weapons.map((id, i) => (
              <li key={id}>
                <span className="rack-tile">
                  <WeaponIcon d={id} size={32} />
                </span>
                <div className="wbody">
                  <div className="wtop">
                    <b>{weapon(id).name}</b>
                    <span className="wtag">{DISCIPLINE_NAME[weapon(id).discipline] ?? weapon(id).discipline}</span>
                  </div>
                  <WeaponBars w={weapon(id)} />
                </div>
                <span className="reorder">
                  <button aria-label="draw earlier" disabled={i === 0} onClick={() => props.onReorder(i, i - 1)}><PixIcon name="chevronUp" size={7} /></button>
                  <button aria-label="draw later" disabled={i === c.weapons.length - 1} onClick={() => props.onReorder(i, i + 1)}><PixIcon name="chevronDown" size={7} /></button>
                </span>
              </li>
            ))}
            <li className="muted">
              <span className="rack-tile">
                <WeaponIcon d="fists" size={32} />
              </span>
              <div className="wbody">
                <div className="wtop"><b>Fists</b><span className="wtag">always last</span></div>
                <div className="muted small">What is left when the steel is gone.</div>
              </div>
            </li>
          </ul>
          {/* An empty rack should say how it gets filled, not just sit there. */}
          {c.weapons.length === 0 && (
            <p className="muted small note">
              No steel yet. Weapons drop from the Rift when you level
              <span className="say-more"> — once you hold more than one, this is where you set which comes out first</span>.
            </p>
          )}
        </div>
      </section>

      {/* The tasks live behind a small button (player call: the always-open
          strip took a full row for three lines that rarely change). The
          button carries the count, so opening it is optional. */}
      {showTasks && (
        <section className="card quests quests-strip span-all">
          <h3>Today's Tasks {save.quests?.claimed && <span className="owned-badge">DONE — gear dropped!</span>}</h3>
          <ul className="qlist">
            {todaysTasks.map((d) => (
              <Quest key={d.metric + d.need} at={questProgress(save.quests, d)} of={d.need}>
                {d.text}
              </Quest>
            ))}
          </ul>
          <p className="muted small note say-more">Complete all three for a bonus gear drop. Resets daily.</p>
        </section>
      )}

      {(c.skills.length > 0 || c.beasts.length > 0) && (
        <section className="card">
          <h3>Skills & Pets</h3>
          <div className="plaques">
            {c.skills.map((s) => (
              <span key={s} className="plaque" title={skill(s).text}>
                <SkillIcon id={s} kind={skill(s).kind as SkillKind} size={40} />
                <em>{skill(s).name}</em>
              </span>
            ))}
            {c.beasts.map((b, i) => (
              <span key={`${b}${i}`} className="plaque" title={beast(b).flavour}>
                <span className="pet-tile">
                  <PetSprite beastId={b} size={44} />
                </span>
                <em>{beast(b).name}</em>
              </span>
            ))}
          </div>
        </section>
      )}

      <StandingsStrip save={save} />

      <section className="card wardrobe span-all">
        <h3>
          Wardrobe{" "}
          <span className="muted small">
            {ownedGear.length}/{gearPool().length} found
            <span className="say-more"> — drops are random, wear what you own</span>
          </span>
        </h3>
        {ownedGear.length === 0 ? (
          <div className="wardrobe-empty">
            {(["Armor", "Helm", "Cloak", "Trinket", "Title"] as const).map((label) => (
              <span className="slot-empty" key={label}>
                <span className="slot-frame" />
                <em>{label}</em>
              </span>
            ))}
            <p className="muted small">
              Nothing yet — every level up
              <span className="say-more"> (and some victories)</span> drops a random piece of gear.
            </p>
          </div>
        ) : (
          (["body", "helm", "cloak", "trinket", "title"] as GearSlot[]).map((slot) => {
            const items = ownedGear.filter((g) => g.slot === slot);
            if (items.length === 0) return null;
            const labels: Record<GearSlot, string> = {
              body: "Armor",
              helm: "Helm",
              cloak: "Cloak",
              trinket: "Trinket",
              title: "Title",
            };
            return (
              <div key={slot} className="wardrobe-row">
                <h4 className="slot-label">{labels[slot]}</h4>
                <div className="chips">
                  {items.map((g) => {
                    const worn = save.equipped?.[slot] === g.id;
                    return (
                      <button
                        key={g.id}
                        className={`chip gear-chip ${worn ? "worn" : ""}`}
                        title={g.flavour}
                        onClick={() => props.onEquip(slot, worn ? undefined : g.id)}
                      >
                        {/* worn by your own hunter, so you see it before choosing */}
                        <FighterBust look={lookWithGear(baseLook, { [slot]: g.id })} size={46} />
                        <span className="gear-text">
                          <b>{g.name}</b>
                          <span className="gear-stat">{gearStatLine(g) || gearDetail(g)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Reference screens, not actions — the action lives on the champion card. */}
      <div className="actions secondary">
        <button className="btn ghost" onClick={() => setShowTasks((v) => !v)} aria-expanded={showTasks}>
          Today's Tasks {save.quests?.claimed ? "✓" : `${tasksDone}/${todaysTasks.length}`}
        </button>
        <button className="btn ghost" onClick={props.onHistory}>
          Level-Up History ({c.tapestry.length})
        </button>
        <button className="btn ghost" onClick={props.onRoster}>
          Your Hunters
        </button>
        <button className="btn ghost" onClick={props.onLadder}>
          Ladder
        </button>
        <button className="btn ghost" onClick={props.onCodex}>
          Codex
        </button>
      </div>

      <div className="devrow">
        {/* The save lives in this browser; the code is the copy you keep. */}
        <button
          className="btn tiny"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(encodeSave(save));
              setCopied(true);
            } catch {
              /* clipboard denied in sandboxed embeds — the button just stays */
            }
          }}
        >
          {copied ? "Copied — keep it safe!" : "Copy rescue code"}
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

