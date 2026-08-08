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
import { encodeSave, questProgress, questsForDay, untilReset, VIGOR_CAP, VIGOR_DAILY, type SaveV1 } from "../save.js";
import { CHAR, type Look } from "../paperdoll.js";
import { DISCIPLINE_NAME, StandingsStrip, WeaponBars } from "../ui.js";

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
  // The scene, repainted for the box the plate actually got. It used to be
  // painted once at 78x82 and stretched with background-size: cover — a
  // continuously FRACTIONAL scale on the most-viewed art in the game, mushy
  // pixels under a strictly integer-scaled champion. Now the plate picks an
  // integer scale, paints the scene at ceil(box/scale) native pixels, and
  // blows it up exactly scale times, same as the fight stage.
  const [plate, setPlate] = useState({ w: NW, h: NH, scale: SCALE });
  useLayoutEffect(() => {
    const fit = () => {
      const w = plateRef.current?.clientWidth ?? 0;
      const h = plateRef.current?.clientHeight ?? 0;
      if (!w || !h) return;
      // The sprite stands on the ground line, which CSS clamps to 22% of the
      // plate on short boxes — so what it actually has is the 78% above that.
      const usable = h * 0.78;
      setFigScale(Math.max(1, Math.min(SCALE, Math.floor(usable / CHAR.h))));
      const scale = Math.max(1, Math.min(4, Math.floor(w / NW)));
      setPlate({ w: Math.ceil(w / scale), h: Math.ceil(h / scale), scale });
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
            backgroundImage: `url(${arenaScene(arena, plate.w, plate.h)})`,
            // exact integer blow-up, anchored to the ground — overrides the
            // stylesheet's cover/stretch on every layout branch
            backgroundSize: `${plate.w * plate.scale}px ${plate.h * plate.scale}px`,
            backgroundPosition: "center bottom",
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
          <FighterFig look={look} height={CHAR.h * figScale} anim={pose} aura={aura} particles={particles} />
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

/**
 * What a weapon is, shown only when you ask for it. Draw order is the one
 * decision on this card, so it moves from here rather than from the tile.
 */
function WeaponDetail({
  w,
  at,
  of,
  onMove,
  onClose,
}: {
  w: ReturnType<typeof weapon>;
  at: number;
  of: number;
  onMove: (to: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="rack-detail" role="group" aria-label={w.name}>
      <div className="rack-detail-head">
        <b>{w.name}</b>
        <span className="wtag">{DISCIPLINE_NAME[w.discipline] ?? w.discipline}</span>
        <button className="rack-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <WeaponBars w={w} />
      <p className="muted small">{w.flavour}</p>
      <div className="rack-move">
        <span className="muted small">
          Drawn {at + 1} of {of}
        </span>
        <button className="btn ghost" disabled={at === 0} onClick={() => onMove(at - 1)}>
          <PixIcon name="chevronUp" size={7} /> Earlier
        </button>
        <button className="btn ghost" disabled={at === of - 1} onClick={() => onMove(at + 1)}>
          <PixIcon name="chevronDown" size={7} /> Later
        </button>
      </div>
    </div>
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
  const [showCode, setShowCode] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  /** Which weapon on the rack board has its details open. */
  const [open, setOpen] = useState<number | null>(null);
  /** Which wardrobe slot is showing its options. */
  const [slotOpen, setSlotOpen] = useState<GearSlot | null>(null);
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
            Winning also moves your <b>Rating</b>
            <span className="say-more"> — every rival card shows what a win or loss is worth</span>.
            You get <b>{VIGOR_DAILY} fights a day</b>
            <span className="say-more"> (they bank up to {VIGOR_CAP} — today you start with a full tank)</span>.
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
        {/*
          The rack was one full-width row per weapon — name, discipline and
          three bars each — so six weapons ran past a phone screen to tell you
          things you only want when you are deciding. It is a board now: the
          weapons as tiles in draw order, and the detail on tap.
        */}
        <div className="card">
          <h3>Weapons <span className="muted small">(drawn in this order)</span></h3>
          <div className="rack-board">
            {c.weapons.map((id, i) => (
              <button
                key={id}
                type="button"
                className={`rack-tile rack-pick${open === i ? " picked" : ""}`}
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
                title={weapon(id).name}
              >
                <WeaponIcon d={id} size={32} />
                <span className="sr-only">
                  {weapon(id).name}, drawn {i + 1}
                </span>
              </button>
            ))}
            <span className="rack-tile rack-fists" title="Fists — always last">
              <WeaponIcon d="fists" size={32} />
              <span className="sr-only">Fists, always last</span>
            </span>
          </div>
          {open !== null && c.weapons[open] && (
            <WeaponDetail
              w={weapon(c.weapons[open]!)}
              at={open}
              of={c.weapons.length}
              onMove={(to) => {
                props.onReorder(open, to);
                setOpen(to);
              }}
              onClose={() => setOpen(null)}
            />
          )}
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
          <p className="muted small note say-more">Complete all three for a bonus drop. Resets daily.</p>
        </section>
      )}

      {(c.skills.length > 0 || c.beasts.length > 0) && (
        <section className="card">
          <h3>Skills & Pets</h3>
          <div className="plaques">
            {c.skills.map((s) => (
              <span key={s} className="plaque" title={skill(s).text}>
                <SkillIcon id={s} kind={skill(s).kind as SkillKind} size={32} />
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
            const on = save.equipped?.[slot];
            const wornItem = items.find((g) => g.id === on);
            const isOpen = slotOpen === slot;
            return (
              <div key={slot} className="wardrobe-row">
                {/*
                  One line per slot: what you are wearing, and how many others
                  you own. Five slots x a rail of 62px chips was 544px of Hall
                  spent on a decision you make once a level.
                */}
                <button
                  className={`slot-summary${isOpen ? " picked" : ""}`}
                  aria-expanded={isOpen}
                  onClick={() => setSlotOpen(isOpen ? null : slot)}
                >
                  <span className="slot-label">{labels[slot]}</span>
                  <b>{wornItem ? wornItem.name : "Nothing"}</b>
                  <span className="muted small">{items.length}</span>
                  <PixIcon name={isOpen ? "chevronUp" : "chevronDown"} size={7} />
                </button>
                {isOpen && (
                  <div className="chips">
                    {items.map((g) => {
                      const worn = on === g.id;
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
                )}
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
              setShowCode(false);
            } catch {
              // Clipboard is denied in exactly the sandboxed embeds rescue
              // codes exist for. Silence here meant the game's only backup
              // mechanism failed with zero feedback — show the code instead
              // so it can be selected and copied by hand.
              setShowCode(true);
            }
          }}
        >
          {copied ? "Copied — keep it safe!" : "Copy rescue code"}
        </button>
        <button
          className={`btn tiny danger devrow-delete ${armDelete ? "armed" : ""}`}
          onClick={() => (armDelete ? props.onDelete() : setArmDelete(true))}
        >
          {armDelete ? "Tap again — deletes forever!" : "Delete Hunter"}
        </button>
      </div>
      {showCode && (
        <textarea
          className="rescue-out"
          readOnly
          value={encodeSave(save)}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Your rescue code — select and copy it"
        />
      )}
    </div>
  );
}

