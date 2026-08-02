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
import { PetSprite } from "./pixelPets.js";
import { WeaponIcon } from "./weaponIcons.js";
import { SkillIcon, type SkillKind } from "./skillIcons.js";
import { PixIcon } from "./pixelIcons.js";
import { AURAS, AuraSparks, FighterBust, FighterFig, lookFor, rivalLook, type FighterAnim } from "./fighters.js";
import { ARENAS, arenaForFight, type Arena as ArenaDef } from "./arenas.js";
import { arenaScene } from "./arenaArt.js";
import {
  BEARDS,
  BUILDS,
  CLOTH_COLORS,
  EYE_COLORS,
  FEET,
  HAIRS,
  HAIR_COLORS,
  HEADS,
  LEGS,
  SKINS,
  TORSOS,
  normaliseLook,
  randomLook,
  torsosFor,
  type Look,
  type Part,
  type Tone,
} from "./paperdoll.js";
import { gearDetail, gearItem, gearPool, gearStatLine, gearStats, lookWithGear, resolveExtras, rollGearDrop, type Equipped, type GearItem, type GearSlot } from "./gear.js";
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
import { ladder, standing } from "./ladder.js";

type Screen =
  | { s: "forge" }
  | { s: "home" }
  | { s: "arena" }
  | {
      s: "fight";
      result: FightResult;
      rival: Rival;
      arena: ArenaDef;
      rewards: { xp: number; kleos: number; drops: string[] };
    }
  | { s: "history" }
  | { s: "ladder" }
  | { s: "codex" };

/** Screens that live at their own URL, so back/forward and refresh work. */
const ROUTES: Record<string, string> = {
  home: "hall",
  arena: "arena",
  history: "history",
  ladder: "ladder",
  codex: "codex",
  forge: "new",
};
const BREADCRUMB: Record<string, string> = {
  home: "Hall",
  arena: "Hall / Arena",
  history: "Hall / Level-Up History",
  ladder: "Hall / Ladder",
  codex: "Hall / Codex",
  forge: "New Hunter",
  fight: "Hall / Arena / Fight",
};

function routeOf(hash: string): Screen["s"] | null {
  const want = hash.replace(/^#\/?/, "");
  const hit = Object.entries(ROUTES).find(([, path]) => path === want);
  return (hit?.[0] as Screen["s"]) ?? null;
}

/** League tiers give the rating number meaning (03-gdd-systems.md §1.4). */
function league(kleos: number): { name: string; color: string } {
  // Tiers sit in the parchment palette — imported neon reads as a different app.
  if (kleos >= 1950) return { name: "S-Rank", color: "#e39a2e" };
  if (kleos >= 1850) return { name: "A-Rank", color: "#d95f43" };
  if (kleos >= 1750) return { name: "B-Rank", color: "#8a6bb5" };
  if (kleos >= 1650) return { name: "C-Rank", color: "#3f83c6" };
  if (kleos >= 1550) return { name: "D-Rank", color: "#6f9a3e" };
  return { name: "E-Rank", color: "#9a8c74" };
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
  const [screen, setScreen] = useState<Screen>(() => {
    const wanted = routeOf(location.hash);
    if (!save) return { s: "forge" };
    return wanted && wanted !== "fight" ? ({ s: wanted } as Screen) : { s: "home" };
  });
  const [draft, setDraft] = useState<{ offers: FateOffer[]; pick: number; drop?: GearItem } | null>(null);

  // The address bar follows the screen, so refresh and the back button land
  // where the player expects instead of dumping them at the Hall.
  useEffect(() => {
    const path = ROUTES[screen.s];
    if (path && location.hash !== `#/${path}`) {
      history.pushState(null, "", `#/${path}`);
    }
  }, [screen.s]);

  useEffect(() => {
    const onNav = () => {
      const s = routeOf(location.hash);
      if (s && s !== "fight") setScreen({ s } as Screen);
    };
    window.addEventListener("popstate", onNav);
    window.addEventListener("hashchange", onNav);
    return () => {
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("hashchange", onNav);
    };
  }, []);

  // One crisp tick for every button in the game.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest("button")) sound.click();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const update = (next: SaveV1) => {
    persist(next);
    setSave(next);
  };

  /**
   * Level-ups are RANDOM (MyBrute style): the Rift rolls one of the weighted
   * offers and one themed gear drop — the player only claims, never chooses.
   * Seeded from the champion, so the same hunter always rolls the same fate.
   */
  const openDraftIfDue = (s: SaveV1) => {
    const c = s.champion;
    if (c.level < 50 && c.xp >= costToNext(c.level)) {
      const offers = generateDraft(c, c.level + 1, 0);
      const pick = makeRng(combineSeed(c.seed, "roll", c.level + 1)).int(offers.length);
      const drop = rollGearDrop(s.gear ?? [], combineSeed(c.seed, "gear", c.level + 1));
      setDraft({ offers, pick, drop });
    } else {
      setDraft(null);
    }
  };

  if (!save || screen.s === "forge") {
    return (
      <Shell>
        <Forge
          onForge={(champion, look, aura) => {
            const s = newSave(champion, { stance: "measured", gambit: "close_the_gap" }, look, aura);
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
    // Worn gear is not decoration: its bonuses go in with the fighter.
    const kit = gearStats(fresh.equipped);
    for (const [k, v] of Object.entries(kit)) {
      champion.stats[k as keyof typeof champion.stats] += v as number;
    }
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

    // Random loot: victory has a chance to shake gear loose, and finishing
    // the daily tasks always drops a piece. New pieces auto-equip empty slots.
    let gear = fresh.gear ?? [];
    const equipped = { ...(fresh.equipped ?? {}) };
    const drops: string[] = [];
    const addDrop = (item?: GearItem) => {
      if (!item) return;
      gear = [...gear, item.id];
      if (!equipped[item.slot]) equipped[item.slot] = item.id;
      drops.push(item.name);
    };

    const q = fresh.quests?.day === todayKey() ? { ...fresh.quests } : freshQuests();
    q.fights += 1;
    if (won) q.wins += 1;
    if (result.events.some((e) => e.type === "hit" && e.side === 0 && e.crit)) q.crits += 1;
    if (!q.claimed && q.fights >= 3 && q.wins >= 2 && q.crits >= 1) {
      q.claimed = true;
      addDrop(rollGearDrop(gear, combineSeed(seed, "questdrop")));
    }
    if (won && makeRng(combineSeed(seed, "loot")).pct(25)) {
      addDrop(rollGearDrop(gear, combineSeed(seed, "lootdrop")));
    }

    const next: SaveV1 = {
      ...fresh,
      champion,
      gear,
      equipped,
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
    setScreen({
      s: "fight",
      result,
      rival,
      arena: arenaForFight(seed),
      rewards: { xp: xpGain, kleos: kd, drops },
    });
  };

  const claimReward = () => {
    if (!draft) return;
    const champion = structuredClone(save.champion);
    champion.xp -= costToNext(champion.level);
    applyDraft(champion, draft.offers, draft.pick, false);
    const gear = [...(save.gear ?? []), ...(draft.drop ? [draft.drop.id] : [])];
    const equipped = { ...(save.equipped ?? {}) };
    if (draft.drop && !equipped[draft.drop.slot]) equipped[draft.drop.slot] = draft.drop.id;
    const next = { ...save, champion, gear, equipped };
    update(next);
    openDraftIfDue(next);
  };

  return (
    <Shell
      crumb={BREADCRUMB[screen.s]}
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
              <PixIcon name="bolt" size={13} className="icon-gold" /> {save.vigor} fights
            </span>
            <button
              className="pill sound-toggle"
              onClick={() => {
                sound.setMuted(!sound.isMuted());
                update({ ...save });
              }}
              title={sound.isMuted() ? "Sound is off" : "Sound is on"}
            >
              <PixIcon name={sound.isMuted() ? "speakerOff" : "speaker"} size={13} />
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
          onLadder={() => setScreen({ s: "ladder" })}
          onReorder={(from, to) => {
            const champion = structuredClone(c);
            const [moved] = champion.weapons.splice(from, 1);
            champion.weapons.splice(to, 0, moved!);
            update({ ...save, champion });
          }}
          onPortrait={(portrait) => update({ ...save, portrait })}
          onEquip={(slot, id) => update({ ...save, equipped: { ...save.equipped, [slot]: id } })}
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
          arena={screen.arena}
          names={[c.displayName, screen.rival.snapshot.name]}
          figures={(() => {
            const extras = resolveExtras(save.aura ?? 0, save.equipped);
            return [
              {
                look: lookWithGear(save.look ?? lookFor(c.displayName), save.equipped),
                aura: extras.aura,
                particles: extras.particles,
                weaponId: heldWeaponId(c.weapons),
                beasts: c.beasts,
              },
              {
                ...rivalLook(screen.rival.snapshot.name),
                weaponId: heldWeaponId(screen.rival.snapshot.weapons),
                beasts: screen.rival.snapshot.beasts,
              },
            ] satisfies [StageFigure, StageFigure];
          })()}
          onDone={() => {
            openDraftIfDue(save);
            setScreen({ s: "arena" });
          }}
        />
      )}

      {screen.s === "ladder" && (
        <Ladder save={save} onBack={() => setScreen({ s: "home" })} />
      )}

      {screen.s === "history" && <History champion={c} onBack={() => setScreen({ s: "home" })} />}
      {screen.s === "codex" && <Codex champion={c} onBack={() => setScreen({ s: "home" })} />}

      {draft && (
        <RewardModal
          level={c.level + 1}
          offer={draft.offers[draft.pick]!}
          drop={draft.drop}
          onClaim={claimReward}
        />
      )}
    </Shell>
  );
}

/* ================= shell ================= */

function Shell({
  children,
  header,
  crumb,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  /** where you are, e.g. "Hall / Arena" */
  crumb?: string;
}) {
  return (
    <div className="shell">
      {header}
      {crumb && (
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumb.split(" / ").map((part, i, all) => (
            <span key={part}>
              {i > 0 && <span className="crumb-sep">/</span>}
              <span className={i === all.length - 1 ? "crumb on" : "crumb"}>{part}</span>
            </span>
          ))}
        </nav>
      )}
      <main className="content">{children}</main>
      <footer className="foot">
        RANK ZERO prototype — deterministic sim v1 · your progress is saved in this browser
        <br />
        characters and weapons from the LPC universal sprite set (CC BY-SA 3.0 / GPL 3.0) ·
        arenas, icons and pets drawn in-engine
      </footer>
    </div>
  );
}

/* ================= forge (2 steps: name → appearance) ================= */

function Forge({
  onForge,
}: {
  onForge: (c: Champion, look: Look, aura: number) => void;
}) {
  const [name, setName] = useState("");
  const [champ, setChamp] = useState<Champion | null>(null);
  const [look, setLook] = useState<Look | null>(null);
  const [aura, setAura] = useState(0);
  const [previewPose, setPreviewPose] = useState<"idle" | "attack1">("idle");
  const [tab, setTab] = useState<CreatorTab>("body");
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
              setLook(lookFor(preview.displayName));
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
              <FighterBust look={lookFor(preview.displayName)} size={72} />
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
        <p className="fineprint">Next: make them look like you want. Weapons, stats and skills are all found as you level.</p>
      </div>
    );
  }

  const me = normaliseLook(look ?? lookFor(champ.displayName));
  const c2 = champ;
  const set = (patch: Partial<Look>) => setLook(normaliseLook({ ...me, ...patch }));

  const tone = (label: string, tones: Tone[], value: number, key: keyof Look) => (
    <div className="picker swatch-picker">
      <span className="picker-label">
        {label}
        <em>{tones[value]!.name}</em>
      </span>
      <div className="swatches">
        {tones.map((t, i) => (
          <button
            key={t.name}
            className={`swatch ${value === i ? "picked" : ""}`}
            style={{ background: t.css }}
            onClick={() => set({ [key]: i } as Partial<Look>)}
            aria-label={`${t.name} ${label.toLowerCase()}`}
            title={t.name}
          />
        ))}
      </div>
    </div>
  );

  const part = (
    label: string,
    parts: Array<{ name: string }>,
    value: number,
    key: keyof Look,
    allowed?: number[],
  ) => (
    <PartPicker
      label={label}
      parts={parts}
      value={value}
      allowed={allowed}
      onPick={(i) => set({ [key]: i } as Partial<Look>)}
    />
  );

  return (
    <div className="forge">
      <h1 className="forge-title">Make them yours.</h1>
      <p className="forge-sub">
        {c2.displayName} <span className="epithet">{c2.epithet}</span> — this is just how you look.
        Weapons, stats and skills are found in the Rift as you level.
      </p>
      <div className="styler">
        <div
          className="styler-stage"
          onPointerDown={() => setPreviewPose("attack1")}
          onPointerUp={() => setPreviewPose("idle")}
          onPointerLeave={() => setPreviewPose("idle")}
          title="Hold to see the attack"
        >
          <AuraSparks aura={aura} />
          <FighterFig look={me} height={170} anim={previewPose} aura={aura} />
          <div className="hero-caption">
            <b>{BUILDS[me.build]!.name} · {HEADS[me.head]!.name}</b>
            <span className="muted small">
              {BUILDS[me.build]!.blurb} <em>(hold to preview the attack)</em>
            </span>
          </div>
        </div>

        <div className="card creator">
          {/* One category at a time, the way a console creator does it — the
              whole sheet used to be on screen at once and read as a wall. */}
          <div className="tabs" role="tablist">
            {CREATOR_TABS.map(([id, name]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`tab ${tab === id ? "on" : ""}`}
                onClick={() => setTab(id)}
              >
                {name}
              </button>
            ))}
          </div>

          {tab === "body" && (
            <>
              {part("Build", BUILDS, me.build, "build")}
              {tone("Skin", SKINS, me.skin, "skin")}
            </>
          )}
          {tab === "face" && (
            <>
              {part("Shape", HEADS, me.head, "head")}
              {part("Facial hair", BEARDS, me.beard, "beard")}
              {tone("Eyes", EYE_COLORS, me.eyes, "eyes")}
            </>
          )}
          {tab === "hair" && (
            <>
              {part("Style", HAIRS, me.hair, "hair")}
              {tone("Colour", HAIR_COLORS, me.hairColor, "hairColor")}
            </>
          )}
          {tab === "clothes" && (
            <>
              {part("Top", TORSOS, me.torso, "torso", torsosFor(me.build))}
              {tone("Top colour", CLOTH_COLORS, me.torsoColor, "torsoColor")}
              {part("Legs", LEGS, me.legs, "legs")}
              {tone("Leg colour", CLOTH_COLORS, me.legsColor, "legsColor")}
              {part("Feet", FEET, me.feet, "feet")}
              {tone("Feet colour", CLOTH_COLORS, me.feetColor, "feetColor")}
            </>
          )}
          {tab === "aura" && (
            <div className="picker swatch-picker">
              <span className="picker-label">
                Glow<em>{AURAS[aura]!.name}</em>
              </span>
              <div className="swatches">
                {AURAS.map((a, i) => (
                  <button
                    key={a.name}
                    className={`swatch ${aura === i ? "picked" : ""}`}
                    style={{ background: a.color, boxShadow: `0 0 10px ${a.color}88` }}
                    onClick={() => setAura(i)}
                    aria-label={`${a.name} aura`}
                    title={a.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="actions">
          <button
            className="btn big"
            onClick={() => {
              setLook(randomLook(Math.random));
              setAura(Math.floor(Math.random() * AURAS.length));
            }}
          >
            <PixIcon name="dice" size={14} /> Randomize
          </button>
          <button className="btn primary big" onClick={() => onForge(c2, me, aura)}>
            Start Hunting
          </button>
        </div>
      </div>
    </div>
  );
}

const CREATOR_TABS = [
  ["body", "Body"],
  ["face", "Face"],
  ["hair", "Hair"],
  ["clothes", "Clothes"],
  ["aura", "Aura"],
] as const;

type CreatorTab = (typeof CREATOR_TABS)[number][0];

/**
 * A long list of parts, browsed the way console creators do it: arrows to
 * step one at a time, a list to jump straight to one. Two dozen options fit
 * on a single row instead of filling the screen with chips.
 */
function PartPicker({
  label,
  parts,
  value,
  allowed,
  onPick,
}: {
  label: string;
  parts: Array<{ name: string }>;
  value: number;
  allowed?: number[];
  onPick: (i: number) => void;
}) {
  const list = allowed ?? parts.map((_, i) => i);
  const at = Math.max(0, list.indexOf(value));
  const step = (d: number) => onPick(list[(at + d + list.length) % list.length]!);
  return (
    <div className="picker">
      <span className="picker-label">
        {label}
        <em>{parts[value]!.name}</em>
      </span>
      <div className="picker-ctl">
        <button className="nudge" onClick={() => step(-1)} aria-label={`Previous ${label}`}>
          <PixIcon name="arrowLeft" size={9} />
        </button>
        <select
          value={value}
          onChange={(e) => onPick(Number(e.target.value))}
          aria-label={label}
        >
          {list.map((i) => (
            <option key={parts[i]!.name} value={i}>
              {parts[i]!.name}
            </option>
          ))}
        </select>
        <button className="nudge flip" onClick={() => step(1)} aria-label={`Next ${label}`}>
          <PixIcon name="arrowLeft" size={9} />
        </button>
        <span className="picker-count">
          {at + 1}/{list.length}
        </span>
      </div>
    </div>
  );
}


/** Poses the champion can hold for their portrait. */
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
  const pose = (PORTRAIT_POSES.find((p) => p.id === portrait.pose) ?? PORTRAIT_POSES[0]!).id;
  const poseAt = PORTRAIT_POSES.findIndex((p) => p.id === pose);
  const step = (d: number) =>
    onChange({ ...portrait, pose: PORTRAIT_POSES[(poseAt + d + PORTRAIT_POSES.length) % PORTRAIT_POSES.length]!.id });
  const shift = (d: number) =>
    onChange({ ...portrait, arena: (portrait.arena + d + ARENAS.length) % ARENAS.length });

  return (
    <div className="portrait-wrap">
      <div
        className="portrait"
        style={{
          width: NW * SCALE,
          height: NH * SCALE,
          backgroundImage: `url(${arenaScene(arena, NW, NH)})`,
        }}
      >
        <AuraSparks aura={aura} />
        <span
          className="portrait-figure"
          style={{ bottom: Math.round(NH * (1 - arena.horizon) * SCALE) - SCALE }}
        >
          <FighterFig look={look} height={48 * SCALE} anim={pose} aura={aura} particles={particles} />
        </span>
      </div>
      <div className="portrait-controls">
        <button className="nudge" onClick={() => step(-1)} aria-label="Previous pose">
          <PixIcon name="arrowLeft" size={9} />
        </button>
        <span className="portrait-label">{PORTRAIT_POSES[poseAt]!.name}</span>
        <button className="nudge flip" onClick={() => step(1)} aria-label="Next pose">
          <PixIcon name="arrowLeft" size={9} />
        </button>
        <button className="nudge" onClick={() => shift(-1)} aria-label="Previous backdrop">
          <PixIcon name="arrowLeft" size={9} />
        </button>
        <span className="portrait-label wide">{arena.name}</span>
        <button className="nudge flip" onClick={() => shift(1)} aria-label="Next backdrop">
          <PixIcon name="arrowLeft" size={9} />
        </button>
      </div>
    </div>
  );
}

/** A compact standings line so the Arena page shows where you stand. */
function StandingsStrip({ save }: { save: SaveV1 }) {
  const rows = useMemo(
    () => ladder(save.champion.displayName, save.champion.level, save.kleos),
    [save.champion.displayName, save.champion.level, save.kleos],
  );
  const me = standing(rows);
  const near = rows.slice(Math.max(0, me.rank - 3), me.rank + 2);
  return (
    <section className="card standings">
      <h3>
        Standings <span className="muted small">you are #{me.rank} of {me.of}</span>
      </h3>
      <ol className="ladder tight">
        {near.map((r) => (
          <li key={r.name} className={`ladder-row ${r.you ? "you" : ""}`}>
            <span className="lrank">{r.rank}</span>
            <span className="lname">{r.name}</span>
            <span className="lrating">
              <PixIcon name="star" size={9} className="icon-gold" /> {r.rating}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ================= ladder ================= */

/**
 * Standings for the realm. Every other name is generated from the realm seed,
 * so the table is stable — passing someone means you climbed, not that the
 * board reshuffled.
 */
function Ladder({ save, onBack }: { save: SaveV1; onBack: () => void }) {
  const rows = useMemo(
    () => ladder(save.champion.displayName, save.champion.level, save.kleos),
    [save.champion.displayName, save.champion.level, save.kleos],
  );
  const me = standing(rows);
  return (
    <div className="arena">
      <div className="arena-head">
        <button className="btn ghost" onClick={onBack}>
          <PixIcon name="arrowLeft" size={11} /> Hall
        </button>
        <h2>The Ladder</h2>
        <span className="pill">
          #{me.rank} of {me.of}
        </span>
      </div>
      {me.ahead && (
        <p className="notice">
          <b>{me.ahead.name}</b> is {me.ahead.rating - save.kleos} rating ahead of you at #{me.rank - 1}.
          Beat someone stronger to take the place.
        </p>
      )}
      <ol className="ladder">
        {rows.map((r) => (
          <li key={r.name} className={`ladder-row ${r.you ? "you" : ""}`}>
            <span className="lrank">{r.rank}</span>
            <span className="lname">{r.name}</span>
            <span className="llevel muted small">Lv {r.level}</span>
            <span className="lrating">
              <PixIcon name="star" size={9} className="icon-gold" /> {r.rating}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** How dangerous a rival looks next to your own rating. */
function threatOf(mine: number, theirs: number): "easy" | "even" | "hard" {
  if (theirs < mine - 40) return "easy";
  if (theirs > mine + 40) return "hard";
  return "even";
}

const THREAT_LABEL: Record<string, string> = { easy: "Weaker", even: "Even", hard: "Stronger" };

/** One stat, shown as a gauge rather than a number on a dotted line. */
function StatRow({ label, value }: { label: string; value: number }) {
  // 24 is comfortably past a maxed early-game stat, so the bar keeps meaning
  const pct = Math.max(4, Math.min(100, (value / 24) * 100));
  return (
    <li>
      <b>{label}</b>
      <span className="statbar"><i style={{ width: `${pct}%` }} /></span>
      <span className="num">{value}</span>
    </li>
  );
}

function Quest({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className={done ? "qdone" : ""}>
      <span className="qbox">{done && <PixIcon name="check" size={9} />}</span>
      {children}
    </li>
  );
}

/** Plain names for the disciplines, so a tag reads instead of decodes. */
const DISCIPLINE_NAME: Record<string, string> = {
  xiphos: "Blade",
  doru: "Spear",
  labrys: "Axe",
  cestus: "Fist",
  akontia: "Thrown",
  aspis: "Shield",
};

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

/* ================= home ================= */

function Home(props: {
  save: SaveV1;
  onArena: () => void;
  onHistory: () => void;
  onCodex: () => void;
  onLadder: () => void;
  onReorder: (from: number, to: number) => void;
  onRefill: () => void;
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
  const [armDelete, setArmDelete] = useState(false);
  useEffect(() => {
    if (!armDelete) return;
    const t = window.setTimeout(() => setArmDelete(false), 4000);
    return () => window.clearTimeout(t);
  }, [armDelete]);

  return (
    <div className="home">
      {save.totalFights < 3 && (
        <section className="card hint span-all">
          <p>
            <b>How it plays:</b> fight rivals → earn XP → level up → the Rift rolls your reward
            (stats, weapons, skills, pets or gear — always a surprise). You get <b>6 fights a day</b>{" "}
            (they bank up to 12). <span className="muted">Your name set your awakening — the Rift decides the rest.</span>
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
          <div className="xpbar short" title={`XP toward level ${c.level + 1}`}>
            <div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / need) * 100)}%` }} />
          </div>
          <div className="statline">
            XP {c.xp}/{need} · {save.wins}W – {save.losses}L · HP {hpNow} · Gear {ownedGear.length}/{gearPool().length}
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>Stats</h3>
          <ul className="stats">
            <StatRow label={STAT_LABEL.might} value={c.stats.might} />
            <StatRow label={STAT_LABEL.grace} value={c.stats.grace} />
            <StatRow label={STAT_LABEL.tempo} value={c.stats.tempo} />
            <StatRow label={STAT_LABEL.grit} value={c.stats.grit} />
          </ul>
        </div>
        <div className="card">
          <h3>Weapons <span className="muted small">(drawn in this order)</span></h3>
          <ul className="arsenal rack">
            {c.weapons.map((id, i) => (
              <li key={id}>
                <span className="rack-tile">
                  <WeaponIcon d={weapon(id).discipline} size={32} />
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
        </div>
      </section>

      <section className="card quests quests-strip span-all">
        <h3>Today's Tasks {save.quests?.claimed && <span className="owned-badge">DONE — gear dropped!</span>}</h3>
        <ul className="qlist">
          <Quest done={(save.quests?.fights ?? 0) >= 3}>
            Fight 3 times ({Math.min(3, save.quests?.fights ?? 0)}/3)
          </Quest>
          <Quest done={(save.quests?.wins ?? 0) >= 2}>
            Win 2 fights ({Math.min(2, save.quests?.wins ?? 0)}/2)
          </Quest>
          <Quest done={(save.quests?.crits ?? 0) >= 1}>
            Land a critical hit ({Math.min(1, save.quests?.crits ?? 0)}/1)
          </Quest>
        </ul>
        <p className="muted small note">Complete all three for a bonus gear drop. Resets daily.</p>
      </section>

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
                  <PetSprite beastId={b} size={34} />
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
            {ownedGear.length}/{gearPool().length} found — drops are random, wear what you own
          </span>
        </h3>
        {ownedGear.length === 0 ? (
          <p className="muted small">
            Nothing yet — every level up (and some victories) drops a random piece of gear.
          </p>
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

      <div className="actions">
        <button className="btn primary big" onClick={props.onArena}>
          <PixIcon name="swords" size={15} /> Fight in the Arena
        </button>
        <button className="btn ghost" onClick={props.onHistory}>
          Level-Up History ({c.tapestry.length})
        </button>
        <button className="btn ghost" onClick={props.onLadder}>
          Ladder
        </button>
        <button className="btn ghost" onClick={props.onCodex}>
          Codex
        </button>
      </div>

      <div className="devrow">
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
        <button className="btn ghost" onClick={props.onBack}><PixIcon name="arrowLeft" size={11} /> Hall</button>
        <h2>The Arena</h2>
        <button className="btn ghost" onClick={props.onRefresh}>New rivals</button>
      </div>
      {save.vigor <= 0 && (
        <p className="notice">
          You're out of fights for today — 6 more arrive at the daily reset (midnight UTC).
          For testing, use "Dev: +6 fights" in your Hall.
        </p>
      )}
      <StandingsStrip save={save} />

      <div className="rivals">
        {board.map((r, i) => {
          return (
            <div className="card rival" key={r.snapshot.name} style={{ animationDelay: `${i * 55}ms` }}>
              <div className="rival-top">
                <FighterBust look={rivalLook(r.snapshot.name).look} size={64} mirror />
                <div className="rival-id">
                  <span className="champ-name small">{r.snapshot.name}</span>
                  <span className="muted small">
                    Lv {r.snapshot.level} ·{" "}
                    <PixIcon name="star" size={9} className="icon-gold" /> {r.kleos}
                  </span>
                </div>
                <span className={`threat threat-${threatOf(save.kleos, r.kleos)}`}>
                  {THREAT_LABEL[threatOf(save.kleos, r.kleos)]}
                </span>
              </div>

              {/* what they carry, at a glance */}
              <div className="rival-kit">
                {r.snapshot.weapons.length > 0 ? (
                  r.snapshot.weapons.map((w) => (
                    <span className="kit-chip" key={w} title={weapon(w).flavour}>
                      <WeaponIcon d={weapon(w).discipline} size={15} /> {weapon(w).name}
                    </span>
                  ))
                ) : (
                  <span className="kit-chip">
                    <WeaponIcon d="fists" size={15} /> Bare-handed
                  </span>
                )}
                {r.snapshot.skills.map((s) => (
                  <span className="kit-chip skill" key={s} title={skill(s).text}>
                    <SkillIcon id={s} kind={skill(s).kind as SkillKind} size={17} /> {skill(s).name}
                  </span>
                ))}
                {r.snapshot.beasts.map((b, bi) => (
                  <span className="kit-chip pet" key={`${b}${bi}`}>
                    <PetSprite beastId={b} size={16} /> {beast(b).name}
                  </span>
                ))}
              </div>

              {/* the wager, so picking an opponent is a decision */}
              <div className="wager">
                <span className="wager-side win">
                  <b>+{kleosDelta(true, save.kleos, r.kleos)}</b>
                  <em>win</em>
                </span>
                <span className="wager-side lose">
                  <b>{kleosDelta(false, save.kleos, r.kleos)}</b>
                  <em>lose</em>
                </span>
              </div>

              <button className="btn primary" disabled={save.vigor <= 0} onClick={() => props.onFight(r)}>
                <span className="btn-label">Fight (1 <PixIcon name="bolt" size={11} />)</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= level-up reward (random — no choices) ================= */

function RewardModal(props: {
  level: number;
  offer: FateOffer;
  drop?: GearItem;
  onClaim: () => void;
}) {
  const { offer, drop } = props;
  useEffect(() => {
    sound.levelUp();
  }, []);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Level up">
      <div className="draft card">
        <h2>Level {props.level}!</h2>
        <p className="muted">The Rift decides what you find — no choices, no rerolls.</p>
        <div className="fate-row">
          <div className="fate-card rolled">
            <span className="fate-kind">
              {offer.kind.startsWith("stat") ? "Stats" : offer.kind === "weapon" ? "New weapon" : offer.kind === "skill" ? "New skill" : "New pet"}
            </span>
            <OfferArt offer={offer} />
            <b>{describeOffer(offer)}</b>
            <span className="fate-detail">{offerDetail(offer)}</span>
          </div>
          {drop && (
            <div className="fate-card rolled gear-card">
              <span className="fate-kind">
                <PixIcon name="loot" size={11} /> Gear drop — {drop.slot}
              </span>
              <b>{drop.name}</b>
              {/* what it is worth, not just what it is called */}
              {gearStatLine(drop) && <span className="fate-stats">{gearStatLine(drop)}</span>}
              <span className="fate-detail">{drop.flavour}</span>
            </div>
          )}
        </div>
        <button className="btn primary big" onClick={props.onClaim}>
          Claim
        </button>
      </div>
    </div>
  );
}

/** A level-up reward should be a thing you can see, not just a line of text. */
function OfferArt({ offer }: { offer: FateOffer }) {
  if (offer.kind === "skill")
    return <SkillIcon id={offer.skill} kind={skill(offer.skill).kind as SkillKind} size={62} />;
  if (offer.kind === "weapon")
    return (
      <span className="offer-art rack-tile">
        <WeaponIcon d={weapon(offer.weapon).discipline} size={48} />
      </span>
    );
  if (offer.kind === "beast")
    return (
      <span className="offer-art pet-tile">
        <PetSprite beastId={offer.beast} size={56} />
      </span>
    );
  return (
    <span className="offer-art stat-tile">
      <PixIcon name="star" size={34} />
    </span>
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
        <button className="btn ghost" onClick={onBack}><PixIcon name="arrowLeft" size={11} /> Hall</button>
        <h2>Level-Up History</h2>
        <span />
      </div>
      <p className="muted">
        Everything the Rift has rolled for {champion.displayName} — what landed is highlighted, what the fates passed over is struck through.
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
        <button className="btn ghost" onClick={onBack}><PixIcon name="arrowLeft" size={11} /> Hall</button>
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
            <span className="rack-tile">
              <WeaponIcon d={w.discipline} size={34} />
            </span>
            <div className="grow">
              <div className="wtop">
                <span className="cname">{w.name}</span>
                <span className="wtag">{DISCIPLINE_NAME[w.discipline] ?? w.discipline}</span>
              </div>
              <WeaponBars w={w} />
              <div className="cmeta">
                {w.ammo ? `${w.ammo} throws · ` : ""}
                {w.twoHanded ? "two-handed · " : ""}
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
              <SkillIcon id={s.id} kind={s.kind as SkillKind} size={38} />
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
            <span className="pet-tile">
              <PetSprite beastId={b.id} size={48} />
            </span>
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
