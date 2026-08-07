import { useEffect, useRef, useState } from "react";
import {
  applyDraft,
  combineSeed,
  costToNext,
  fightXp,
  generateDraft,
  kleosDelta,
  makeRng,
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
import { PixIcon } from "./pixelIcons.js";
import { lookFor, rivalLook } from "./fighters.js";
import { arenaForFight, type Arena as ArenaDef } from "./arenas.js";
import { gearStats, lookWithGear, resolveExtras, rollGearDrop, type GearItem, type GearSlot } from "./gear.js";
import {
  applyDailyReset,
  activeSlot,
  firstFreeSlot,
  freshQuests,
  questsComplete,
  rosterSummary,
  setActiveSlot,
  load,
  newSave,
  persist,
  todayKey,
  wipe,
  type SaveV1,
  VIGOR_CAP,
  VIGOR_DAILY,
} from "./save.js";
import { sound } from "./sound.js";
import { queueCloudPush } from "./cloud.js";
import { Shell } from "./Shell.js";
import { league } from "./ui.js";
import { Forge } from "./screens/Forge.js";
import { Home } from "./screens/Home.js";
import { Arena } from "./screens/Arena.js";
import { Ladder } from "./screens/Ladder.js";
import { History } from "./screens/History.js";
import { Codex } from "./screens/Codex.js";
import { Roster } from "./screens/Roster.js";
import { RewardModal } from "./screens/RewardModal.js";

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
  | { s: "codex" }
  | { s: "roster" };

/** Screens that live at their own URL, so back/forward and refresh work. */
const ROUTES: Record<string, string> = {
  home: "hall",
  arena: "arena",
  history: "history",
  ladder: "ladder",
  codex: "codex",
  roster: "hunters",
  forge: "new",
  // The fight gets a URL of its own so it is a real history entry. Without
  // one, starting a fight from #/arena left the address bar on #/arena — so
  // navigating "back to the arena" changed nothing, fired no hashchange, and
  // the player sat on the stage with no way out but finishing it.
  fight: "fight",
};
const BREADCRUMB: Record<string, string> = {
  home: "Hall",
  arena: "Hall / Arena",
  history: "Hall / Level-Up History",
  ladder: "Hall / Ladder",
  codex: "Hall / Codex",
  roster: "Your Hunters",
  forge: "New Hunter",
  fight: "Hall / Arena / Fight",
};

function routeOf(hash: string): Screen["s"] | null {
  const want = hash.replace(/^#\/?/, "");
  const hit = Object.entries(ROUTES).find(([, path]) => path === want);
  return (hit?.[0] as Screen["s"]) ?? null;
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

/** Dev tools live behind ?dev=1 — playtesting levers, never player-facing. */
const DEV = new URLSearchParams(location.search).has("dev");

function DevPanel({ save, update }: { save: SaveV1; update: (s: SaveV1) => void }) {
  const c = save.champion;
  const give = (xp: number) => {
    const champion = structuredClone(c);
    champion.xp += xp;
    update({ ...save, champion });
  };
  return (
    <div className="devpanel" role="group" aria-label="Dev tools">
      <span className="devpanel-cap">DEV</span>
      <button className="btn tiny" onClick={() => give(costToNext(c.level) - c.xp)}>Level up</button>
      <button className="btn tiny" onClick={() => give(1)}>+1 XP</button>
      <button className="btn tiny" onClick={() => update({ ...save, vigor: VIGOR_CAP })}>Refill fights</button>
      <button
        className="btn tiny"
        onClick={() => {
          const drop = rollGearDrop(save.gear ?? [], combineSeed(c.seed, "dev", (save.gear ?? []).length));
          if (!drop) return;
          const equipped = { ...(save.equipped ?? {}) };
          if (!equipped[drop.slot]) equipped[drop.slot] = drop.id;
          update({ ...save, gear: [...(save.gear ?? []), drop.id], equipped });
        }}
      >
        Drop gear
      </button>
      <button
        className="btn tiny"
        onClick={() => update({ ...save, vigorDate: "2020-01-01", quests: undefined })}
      >
        Rewind day
      </button>
    </div>
  );
}

export function App() {
  const [save, setSave] = useState<SaveV1 | null>(() => load());
  const [screen, setScreen] = useState<Screen>(() => {
    const wanted = routeOf(location.hash);
    if (!save) return { s: "forge" };
    return wanted && wanted !== "fight" ? ({ s: wanted } as Screen) : { s: "home" };
  });
  const [draft, setDraft] = useState<{ offers: FateOffer[]; pick: number; drop?: GearItem; nonce: number } | null>(null);

  // The address bar follows the screen, so refresh and the back button land
  // where the player expects instead of dumping them at the Hall.
  const routed = useRef(false);
  useEffect(() => {
    const path = ROUTES[screen.s];
    if (!path || location.hash === `#/${path}`) return;
    // The first sync only names the entry the player already stands on.
    // Pushing there left a bare-URL entry behind it, so the first Back press
    // appeared to do nothing and the second one left the game.
    if (routed.current) history.pushState(null, "", `#/${path}`);
    else history.replaceState(null, "", `#/${path}`);
    routed.current = true;
  }, [screen.s]);

  useEffect(() => {
    const onNav = () => {
      const s = routeOf(location.hash);
      // A fight cannot be entered from a URL — its result lives in memory, not
      // the address bar — so a forward button onto #/fight lands in the Arena.
      if (s === "fight") {
        setScreen({ s: "arena" });
        return;
      }
      if (s) setScreen({ s } as Screen);
    };
    window.addEventListener("popstate", onNav);
    window.addEventListener("hashchange", onNav);
    return () => {
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("hashchange", onNav);
    };
  }, []);

  // A due level-up must survive a refresh. Only fights and claims used to
  // roll the modal, so reloading (or restoring a rescue code) with unclaimed
  // XP left the hunter stuck at a full bar until their next fight ended.
  useEffect(() => {
    // Only when no draft is open: this watchdog exists for refresh/restore
    // with unclaimed XP, and without the guard it re-rolled an OPEN draft
    // back to nonce 0 — instantly undoing a Favour reroll it had just paid for.
    if (save && screen.s !== "fight" && !draft) openDraftIfDue(save);
    // Keyed on the screen too: walking out of a fight with the back button
    // skips onDone, and without this a level earned in that fight would sit
    // unclaimed behind a full XP bar until the next one ended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, screen.s]);

  const [muted, setMuted] = useState(() => sound.isMuted());

  // Another tab writing the same slot must not be clobbered by this one's
  // stale copy: rebase on the stored save whenever it changes elsewhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && (e.key.startsWith("agoge.save") || e.key.startsWith("agoge.roster"))) {
        setSave(load());
        setDraft(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // One crisp tick for every button in the game.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      // The mute button manages its own confirmation sound — a capture-phase
      // tick here fired BEFORE the flag flipped, so muting beeped and
      // unmuting was silent: inverted feedback on the one audio button.
      if (t?.closest("[data-nosfx]")) return;
      if (t?.closest("button")) sound.click();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const update = (next: SaveV1) => {
    persist(next);
    setSave(next);
    // Fire-and-forget: the local save is already written and authoritative,
    // so a sync that fails, conflicts or is switched off changes nothing the
    // player can see. Debounced because a fight writes several times in a row.
    queueCloudPush(next);
  };

  /**
   * Level-ups are RANDOM (MyBrute style): the Rift rolls one of the weighted
   * offers and one themed gear drop — the player only claims, never chooses.
   * Seeded from the champion, so the same hunter always rolls the same fate.
   */
  /*
   * The core guarantees a WEAPON is offered at level 5 and a SKILL at 10 —
   * but the pick was a flat roll across all three offers, so the guarantee
   * only landed a third of the time. A full day of play reached level 6
   * with no weapon, no skill and no pet: five level-ups of pure stats, in
   * a game whose whole pitch is what the Rift hands you.
   *
   * The roll stays random everywhere else. On a milestone, if the hunter
   * still owns nothing of the promised kind, the promise is kept — and a
   * Favour reroll re-rolls under the same promise.
   */
  const rollDraft = (c: Champion, next: number, nonce: number) => {
    const offers = generateDraft(c, next, nonce);
    let pick = makeRng(combineSeed(c.seed, "roll", next, nonce)).int(offers.length);
    const forced =
      next === 5 && c.weapons.length === 0
        ? offers.findIndex((o) => o.kind === "weapon")
        : next === 10 && c.skills.length === 0
          ? offers.findIndex((o) => o.kind === "skill")
          : -1;
    if (forced >= 0) pick = forced;
    return { offers, pick };
  };

  const openDraftIfDue = (s: SaveV1) => {
    const c = s.champion;
    if (c.level < 50 && c.xp >= costToNext(c.level)) {
      const next = c.level + 1;
      const drop = rollGearDrop(s.gear ?? [], combineSeed(c.seed, "gear", next));
      setDraft({ ...rollDraft(c, next, 0), drop, nonce: 0 });
    } else {
      setDraft(null);
    }
  };

  /*
   * The Favour reroll — the currency's first and only sink. Favour has been
   * accruing (+1 per milestone, cap 6) since the sim was written, synced and
   * rescue-coded, and the client never showed or spent it: a fully dead
   * currency. Spending is final (draft.ts: redraw is final) and paid up
   * front; the gear drop is not rerolled, only the Rift's offer.
   */
  const rerollDraft = () => {
    if (!draft || !save || save.champion.favour <= 0) return;
    const champion = structuredClone(save.champion);
    champion.favour -= 1;
    const next = champion.level + 1;
    update({ ...save, champion });
    sound.power();
    setDraft({ ...rollDraft(champion, next, draft.nonce + 1), drop: draft.drop, nonce: draft.nonce + 1 });
  };

  if (!save || screen.s === "forge") {
    return (
      <Shell>
        <Forge
          onForge={(champion, look, aura) => {
            // A new hunter takes the first free slot and becomes the one being
            // played; without this the Forge would write over whoever is
            // already in the active slot.
            const target = firstFreeSlot() ?? activeSlot();
            setActiveSlot(target);
            const s = newSave(champion, { stance: "measured", gambit: "close_the_gap" }, look, aura);
            update(s);
            setScreen({ s: "home" });
          }}
          onRestore={(restored) => {
            // A restored code lands in a FREE slot when one exists. It used to
            // write into the active slot — so pasting a rescue code with a
            // hunter already loaded silently destroyed that hunter, making the
            // backup mechanism the game's one data-loss path.
            const target = firstFreeSlot() ?? activeSlot();
            setActiveSlot(target);
            // Persist, then re-read through load() so the code gets the same
            // migrations an old localStorage save would.
            persist(restored, target);
            setSave(load());
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
    // Once the wardrobe is complete (46 pieces, done by the mid-20s levels)
    // rollGearDrop returns undefined — and the daily board and win loot used
    // to silently pay nothing for the rest of a fifty-level career. The
    // fallback bounty keeps the promise that finishing the tasks pays.
    const addDrop = (item?: GearItem) => {
      if (!item) {
        champion.xp += 2;
        drops.push("Rift bounty — +2 XP");
        return;
      }
      gear = [...gear, item.id];
      if (!equipped[item.slot]) equipped[item.slot] = item.id;
      drops.push(item.name);
    };

    const q = fresh.quests?.day === todayKey() ? { ...fresh.quests } : freshQuests();
    // Older saves predate the blocks/streak tallies the rotating tasks read.
    q.blocks ??= 0;
    q.streak ??= 0;
    q.run ??= 0;
    q.fights += 1;
    if (won) q.wins += 1;
    if (result.events.some((e) => e.type === "hit" && e.side === 0 && e.crit)) q.crits += 1;
    q.blocks += result.events.filter(
      (e) => (e.type === "block" || e.type === "evade") && e.side === 0,
    ).length;
    // `streak` is the best run of the day, so a loss does not erase what the
    // player already earned — it just stops the current run growing.
    q.run = won ? q.run + 1 : 0;
    q.streak = Math.max(q.streak, q.run);
    if (!q.claimed && questsComplete(q)) {
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
    applyDraft(champion, draft.offers, draft.pick, draft.nonce > 0);
    const gear = [...(save.gear ?? []), ...(draft.drop ? [draft.drop.id] : [])];
    const equipped = { ...(save.equipped ?? {}) };
    if (draft.drop && !equipped[draft.drop.slot]) equipped[draft.drop.slot] = draft.drop.id;
    if (draft.drop) sound.drop();
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
            <span
              className="pill vigor-pips"
              title={`Fights refill daily (+${VIGOR_DAILY}, banked up to ${VIGOR_CAP})`}
            >
              <PixIcon name="bolt" size={13} className="icon-gold" />
              {/* Six pips drain as the day is spent — a glance, not a number.
                  Banked fights past the daily six stay a count, because twelve
                  pips stops being glanceable and becomes a bar chart. */}
              {save.vigor <= VIGOR_DAILY ? (
                <span className="pips" aria-label={`${save.vigor} of ${VIGOR_DAILY} fights left today`}>
                  {Array.from({ length: VIGOR_DAILY }, (_, i) => (
                    <i key={i} className={`pip${i < save.vigor ? " on" : ""}`} />
                  ))}
                </span>
              ) : (
                <>{save.vigor} fights</>
              )}
            </span>
            {save.champion.favour > 0 && (
              <span className="pill" title="Favour — spend it to reroll a level-up reward">
                <PixIcon name="dice" size={13} className="icon-gold" /> {save.champion.favour}
              </span>
            )}
            <button
              className="pill sound-toggle"
              data-nosfx
              onClick={() => {
                // Local state only. This used to call update({...save}) — a
                // full persist + cloud push + app re-render to flip a flag
                // that does not even live in the save.
                sound.setMuted(!sound.isMuted());
                if (!sound.isMuted()) sound.click();
                setMuted(sound.isMuted());
              }}
              title={muted ? "Sound is off" : "Sound is on"}
            >
              <PixIcon name={muted ? "speakerOff" : "speaker"} size={13} />
            </button>
          </div>
        </header>
      }
    >
      {DEV && screen.s === "home" && <DevPanel save={save} update={update} />}
      {screen.s === "home" && (
        <Home
          save={save}
          onArena={() => setScreen({ s: "arena" })}
          onHistory={() => setScreen({ s: "history" })}
          onCodex={() => setScreen({ s: "codex" })}
          onLadder={() => setScreen({ s: "ladder" })}
          onRoster={() => setScreen({ s: "roster" })}
          onReorder={(from, to) => {
            const champion = structuredClone(c);
            const [moved] = champion.weapons.splice(from, 1);
            champion.weapons.splice(to, 0, moved!);
            update({ ...save, champion });
          }}
          onPortrait={(portrait) => update({ ...save, portrait })}
          onEquip={(slot, id) => update({ ...save, equipped: { ...save.equipped, [slot]: id } })}
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

      {screen.s === "roster" && (
        <Roster
          slots={rosterSummary()}
          active={activeSlot()}
          onBack={() => setScreen({ s: "home" })}
          onPlay={(slot) => {
            setActiveSlot(slot);
            setSave(load());
            setDraft(null);
            setScreen({ s: "home" });
          }}
          onNew={(slot) => {
            setActiveSlot(slot);
            setSave(null);
            setDraft(null);
            setScreen({ s: "forge" });
          }}
          onRetire={(slot) => {
            wipe(slot);
            // Retiring the hunter you are playing drops you onto whoever is
            // left, or to the Forge if that was the last one.
            if (slot === activeSlot()) {
              const next = rosterSummary().find((r) => r !== null);
              if (next) {
                setActiveSlot(next.slot);
                setSave(load());
                setScreen({ s: "home" });
              } else {
                setSave(null);
                setScreen({ s: "forge" });
              }
            } else {
              setSave((v) => (v ? { ...v } : v));
            }
            setDraft(null);
          }}
        />
      )}

      {screen.s === "history" && <History champion={c} onBack={() => setScreen({ s: "home" })} />}
      {screen.s === "codex" && <Codex champion={c} onBack={() => setScreen({ s: "home" })} />}

      {draft && (
        <RewardModal
          level={c.level + 1}
          offer={draft.offers[draft.pick]!}
          drop={draft.drop}
          favour={c.favour}
          rerolled={draft.nonce > 0}
          onReroll={rerollDraft}
          onClaim={claimReward}
        />
      )}
    </Shell>
  );
}

