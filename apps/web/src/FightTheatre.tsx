import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FISTS, WEAPONS, type FightResult } from "@agoge/core";
import { ImpactBurst, Javelin, Laurel, SlashArc } from "./art.js";
import { PetSprite } from "./pixelPets.js";
import { FighterFig, WeatherFx, type FighterAnim } from "./fighters.js";
import { arenaScene } from "./arenaArt.js";
import { PixIcon } from "./pixelIcons.js";
import type { Arena } from "./arenas.js";
import { CHAR, weaponArtFor, type Look } from "./paperdoll.js";
import { narrate, type Line } from "./narrate.js";
import { sound, type StrikeKind } from "./sound.js";

export interface StageFigure {
  /** The fighter's full appearance (paperdoll.ts). */
  look: Look;
  /** Aura colour (fighters.tsx AURAS). */
  aura: number;
  /** Equipped trinket particle effect, if any. */
  particles?: string;
  /** Weapon in hand at the start of the fight. */
  weaponId?: string;
  beasts: string[];
}

const weaponNameById = new Map<string, string>([
  [FISTS.id, FISTS.name],
  ...WEAPONS.map((w) => [w.id, w.name] as const),
]);

interface Props {
  result: FightResult;
  names: [string, string];
  figures: [StageFigure, StageFigure];
  /** Where this fight takes place (arenas.ts). */
  arena: Arena;
  /** Post-fight summary shown under the verdict. */
  rewards: { xp: number; kleos: number; drops?: string[] };
  onDone: () => void;
}

const disciplineById = new Map<string, string>([
  [FISTS.id, FISTS.discipline],
  ...WEAPONS.map((w) => [w.id, w.discipline] as const),
]);

/**
 * The material of a blow. Bare-handed fighters alternate punch and kick in
 * step with the two attack animations, so the sound matches the picture.
 */
function strikeKind(weaponId: string | undefined, beat: number): StrikeKind {
  switch (weaponId ? disciplineById.get(weaponId) : "cestus") {
    case "xiphos":
      return "sword";
    case "doru":
      return "spear";
    case "labrys":
      return "axe";
    case "akontia":
      return "pierce";
    default:
      return beat % 2 === 0 ? "fist" : "kick";
  }
}

/** Scene height in native pixels — 3x this is the stage height on desktop. */
const NATIVE_H = 148;

/**
 * The arena stage: champions run in, dash across to strike, swing, dodge,
 * block and fall — all directed by the deterministic event log.
 */
export function FightTheatre({ result, names, figures, arena, rewards, onDone }: Props) {
  // Depend on the two names, not the array: callers build `names` and
  // `figures` inline, so a fresh array arrives on every parent render and
  // re-narrating the whole fight each time would be pure waste.
  const lines = useMemo(() => narrate(result, names), [result, names[0], names[1]]);
  const [shown, setShown] = useState(1);
  // Remembered like mute: with six banked fights a day, re-tapping 2x every
  // single bout was the most-repeated dead interaction in the game.
  const [speed, setSpeed] = useState<1 | 2>(() => {
    try {
      return localStorage.getItem("agoge.speed") === "2" ? 2 : 1;
    } catch {
      return 1;
    }
  });
  const [skipped, setSkipped] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [dash, setDash] = useState(220);
  // The stage runs on one pixel grid: the scene is painted at native
  // resolution and everything (backdrop and fighters alike) is blown up by
  // the same integer factor, so no pixel is ever resampled.
  const [px, setPx] = useState({ scale: 3, w: 280, h: NATIVE_H });
  const figH = CHAR.h * px.scale;
  const speedRef = useRef<1 | 2>(1);
  speedRef.current = speed;

  useLayoutEffect(() => {
    const measure = () => {
      const w = stageRef.current?.clientWidth ?? 800;
      // Scale has to answer to the viewport's HEIGHT as well as its width. On
      // a landscape phone (667×375) width alone chose 3×, making a 444px stage
      // for a 375px screen — the fight didn't fit on the fight screen. Take
      // whichever integer scale fits both, never below 1.
      const byWidth = w < 560 ? 2 : 3;
      const byHeight = Math.floor((window.innerHeight * 0.72) / NATIVE_H);
      const scale = Math.max(1, Math.min(byWidth, byHeight));
      const nativeW = Math.ceil(w / scale);
      setPx({ scale, w: nativeW, h: NATIVE_H });
      const charW = (CHAR.w / CHAR.h) * (CHAR.h * scale);
      setDash(Math.max(40, Math.round(w * 0.82 - charW * 2)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [figures]);

  const finished = skipped || shown >= lines.length;

  useEffect(() => {
    if (finished) return;
    const line = lines[shown - 1];
    const hold = (line?.hold ?? 600) / speedRef.current;
    const id = window.setTimeout(() => setShown((s) => s + 1), hold);
    return () => window.clearTimeout(id);
  }, [shown, finished, lines, speed]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [shown, skipped]);


  useEffect(() => {
    if (skipped) sound.fanfare(result.winner === 0);
  }, [skipped, result.winner]);

  // The crowd is present for the whole bout and drains away with the screen.
  useEffect(() => {
    sound.arenaIn();
    return () => sound.arenaOut();
  }, []);

  // Stable per beat. It used to be a fresh slice every render, which made the
  // memos below recompute and — worse — re-ran the sound effect, so toggling
  // 2× speed replayed the current blow.
  const visible: Line[] = useMemo(
    () => (skipped ? lines : lines.slice(0, shown)),
    [lines, shown, skipped],
  );
  const idx = visible.length;
  const current = visible[visible.length - 1];
  const hp = current?.hp ?? [result.hpMax[0], result.hpMax[1]];
  const loser: 0 | 1 = result.winner === 0 ? 1 : 0;

  const anim = skipped ? undefined : current?.anim;
  const fx = skipped ? undefined : current?.fx;

  // Beast ids that have fallen so far.
  const downed: [Set<string>, Set<string>] = useMemo(() => {
    const sets: [Set<string>, Set<string>] = [new Set(), new Set()];
    for (const l of visible) {
      if (l.beastDown) {
        sets[l.beastDown.side].add(l.beastDown.beast);
      }
    }
    return sets;
  }, [visible]);

  // Weapon currently in each champion's hand (draw events switch it live).
  const heldWeapon: [string | undefined, string | undefined] = useMemo(() => {
    const held: [string | undefined, string | undefined] = [
      figures[0].weaponId,
      figures[1].weaponId,
    ];
    for (const l of visible) {
      if (l.drew) held[l.drew.side] = l.drew.weapon;
    }
    return held;
  }, [visible, figures[0].weaponId, figures[1].weaponId]);

  // shields change how a parry sounds — wood thunk versus steel ring
  const hasShield: [boolean, boolean] = useMemo(
    () => [
      heldWeapon[0] ? disciplineById.get(heldWeapon[0]) === "aspis" : false,
      heldWeapon[1] ? disciplineById.get(heldWeapon[1]) === "aspis" : false,
    ],
    [heldWeapon],
  );

  // How many swings each side has thrown so far — the alternation key. Derived
  // from the beats on screen so a rewind or a skip stays consistent.
  const swingCount: [number, number] = useMemo(() => {
    const n: [number, number] = [0, 0];
    for (const l of visible) {
      if (l.anim?.striker !== undefined && !l.anim.beastId) n[l.anim.striker]++;
    }
    return n;
  }, [visible]);

  // The same idea for evasions: one dodge shape repeated is as flat as one
  // swing shape repeated, and defensive beats are half a fight.
  const dodgeCount: [number, number] = useMemo(() => {
    const n: [number, number] = [0, 0];
    for (const l of visible) {
      if (l.anim?.reaction?.kind === "dodge") n[l.anim.reaction.side]++;
    }
    return n;
  }, [visible]);

  const idxRef = useRef(0);
  idxRef.current = idx;

  // SFX per beat, timed to land at contact.
  useEffect(() => {
    if (skipped) return;
    const l = lines[shown - 1];
    if (!l) return;
    if (l.kind === "end") {
      // By the result, not by name-substring: "Ajax" losing to "Ajax the Red"
      // used to hear the victory fanfare.
      sound.fanfare(result.winner === 0);
      return;
    }
    if (l.anim?.beastId) sound.beast();
    // Impacts land a beat after the swing; if the beat is cut short (skip,
    // unmount) the pending blow is cancelled rather than firing into silence.
    const pending: number[] = [];
    const land = (fn: () => void, ms: number) => pending.push(window.setTimeout(fn, ms));
    // What you hear is what is actually swinging: the striker's weapon this
    // beat, and the defender's real answer to it.
    const striker = l.anim?.striker;
    const kind = strikeKind(striker === undefined ? undefined : heldWeapon[striker], idxRef.current);
    // The strike keyframe reaches the foe ~42% into its run (~320ms at 1x),
    // but impacts used to land at 95ms — the thwack played while the striker
    // was still mid-sprint, audio leading video by ~200ms on every hit.
    const contact = Math.round(290 / speedRef.current);
    switch (l.kind) {
      case "info":
        if (l.text.includes("enter the arena")) {
          sound.drum();
          sound.dash();
        }
        break;
      case "hit":
      case "crit": {
        const crit = l.kind === "crit";
        // swing first, impact landing a beat later — the gap sells the blow
        if (l.anim?.thrown) sound.strike("pierce", crit);
        else {
          sound.swing(kind);
          land(() => sound.strike(kind, crit), kind === "axe" ? Math.round(360 / speedRef.current) : contact);
        }
        break;
      }
      case "defend":
        if (l.fx?.heal) sound.heal();
        else if (l.anim?.reaction?.kind === "block") {
          sound.swing(kind);
          const guard = l.anim.reaction.side;
          land(() => sound.block(hasShield[guard]), contact);
        } else if (l.anim?.reaction?.kind === "dodge") {
          sound.swing(kind);
          land(() => sound.dodge(), contact);
        } else if (l.anim?.thrown) sound.throwSpear();
        else sound.swing(kind);
        break;
      case "trump":
        sound.power();
        break;
    }
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, [shown, skipped, lines, names, heldWeapon, hasShield, result.winner]);

  const slotClass = (side: 0 | 1): string => {
    const cls = ["fig-slot"];
    const R = side === 0 ? "r" : "l"; // the direction this side attacks toward
    const S = side === 0 ? "l" : "r"; // the side of the stage they stand on
    if (idx <= 1) cls.push(side === 0 ? "enter-l" : "enter-r");

    if (anim?.striker === side && !anim.beastId) {
      if (anim.cast) {
        // A skill is not a swing: they plant, draw themselves up, and the
        // power leaves them. Casting used to be a bare caption over an idle.
        cls.push(`cast-${S}`);
      } else if (anim.riposte) {
        // Counters and ripostes are answers, not charges — the foe already
        // closed the distance. A short pivot on the spot, no sprint.
        cls.push(`riposte-${R}`);
      } else if (anim.chain) {
        // Follow-ups escalate: each one tighter and faster than the last,
        // rather than replaying the opening swing in place.
        cls.push(`chain-${R}`, `cx${Math.min(3, anim.chain)}`);
      } else {
        cls.push(anim.thrown ? `throw-${R}` : `strike-${R}`);
        // Three lunge shapes, cycled per-side: every hit used to be the same
        // full-stage sprint, so a 30-beat fight read as one GIF looping.
        if (!anim.thrown) cls.push(`sv${swingCount[side] % 3}`);
        // A critical is the same lunge, further and harder — it should not
        // look like every other swing when the feed is shouting CRITICAL.
        if (fx?.crit) cls.push("strike-crit");
      }
    }

    // A weapon coming up into guard, on the beat it is drawn.
    if (anim?.ready === side) cls.push(`ready-${S}`);

    if (anim?.reaction?.side === side) {
      cls.push(`${anim.reaction.kind}-${S}`);
      // Three ways to not be hit: step aside, hop back, duck under. One
      // shape for every evasion made half the fight look identical.
      if (anim.reaction.kind === "dodge") cls.push(`dv${dodgeCount[side] % 3}`);
      // Taking a critical staggers you back rather than rocking you.
      if (fx?.crit && anim.reaction.kind === "hurt") cls.push("hurt-hard");
    }
    return cls.join(" ");
  };

  const innerClass = (side: 0 | 1): string => {
    const cls = ["fig-inner"];
    if (finished && side === loser && result.reason === "ko") cls.push("felled");
    else if (finished && side === result.winner) cls.push("win");
    else cls.push("idle");
    if (anim?.reaction?.side === side && anim.reaction.kind === "hurt") cls.push("flash");
    // The skill lights its caster up, so the ring reads as coming FROM them.
    if (anim?.cast && anim.striker === side) cls.push("channel");
    return cls.join(" ");
  };

  /**
   * Which sheet animation each fighter plays this beat.
   *
   * Every beat used to resolve to one of three poses — attack, hit, stance —
   * with the swing alternating on the GLOBAL beat index, so both fighters
   * always threw the same one at the same time and every defensive beat was
   * the idle guard. The reads now differ: a dodge steps, a block braces, and
   * the two fighters are on their own swing counts so a long exchange stops
   * looking like a metronome.
   */
  const animOf = (side: 0 | 1): FighterAnim => {
    if (finished && side === loser && result.reason === "ko") return "death";
    if (finished) return "stance";
    const react = anim?.reaction?.side === side ? anim.reaction.kind : undefined;
    if (react === "hurt") return "hit";
    // A cast holds the guard while the body channels; the CSS does the lift.
    if (anim?.cast && anim.striker === side) return "stance";
    // Drawing steel reads as the wind-up frames, not an idle sway.
    if (anim?.ready === side) return "attack1";
    // A dodge is a body moving out of the way; the run frames read as the
    // quick step the CSS is already sliding them through.
    if (react === "dodge") return "run";
    // A block is taken on the guard — the braced stance, not the loose idle.
    if (react === "block") return "stance";
    if (anim?.striker === side && !anim.beastId) {
      // Per-side swing count, so the two fighters are never in lockstep — and
      // inside a chain the follow-ups alternate against the chain index, so a
      // three-hit combo is three pictures rather than one repeated.
      const beat = anim.chain ? swingCount[side] + anim.chain : swingCount[side];
      return beat % 2 === 0 ? "attack1" : "attack2";
    }
    return "stance";
  };

  const renderEffects = (side: 0 | 1) => {
    const showBurst = fx && !fx.heal && fx.target === side;
    const showSlash = showBurst && anim?.striker !== undefined && !anim.thrown;
    const label = anim?.label?.side === side ? anim.label.text : undefined;
    const edge = side === 0 ? "on-right" : "on-left";
    return (
      <>
        {showSlash && (
          <span className={`slash ${edge}`}>
            <SlashArc size={90} mirror={side === 0} />
          </span>
        )}
        {showBurst && (
          <span className={`burst ${edge}`}>
            <ImpactBurst size={fx.crit ? 88 : 62} crit={!!fx.crit} />
          </span>
        )}
        {fx && fx.target === side && (
          <span className={`floater ${fx.crit ? "crit" : ""} ${fx.heal ? "heal" : ""}`}>
            {fx.heal ? `+${fx.amount}` : `−${fx.amount}`}
          </span>
        )}
        {label && <span className="floater word">{label}</span>}
      </>
    );
  };

  const renderBeasts = (side: 0 | 1) => {
    const list = figures[side].beasts;
    if (list.length === 0) return null;
    const actingId = anim?.beastId;
    const actingSide = anim?.striker;
    return (
      <div className={`fig-beasts ${side === 0 ? "beasts-l" : "beasts-r"}`}>
        {list.map((id, i) => {
          const striking = actingSide === side && actingId === id;
          const summoning = anim?.summon === id && actingSide === side;
          const falling = current?.beastDown?.side === side && current.beastDown.beast === id;
          return (
            <span
              key={`${id}${i}${striking || falling ? idx : ""}`}
              className={[
                striking ? (side === 0 ? "beast-dash-r" : "beast-dash-l") : "beast-idle",
                // Loosed for the first time: it drops in behind its master
                // instead of having always been standing there.
                summoning ? "beast-summon" : "",
                falling ? "beast-fall" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <PetSprite beastId={id} size={54} mirror={side === 1} down={downed[side].has(id)} />
              {falling && (
                <span className="beast-poof">
                  <ImpactBurst size={46} crit={false} />
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    // --spd compresses the choreography with the clock. At 2x the beats were
    // halved but the CSS kept its 1x durations, so strikes were killed
    // mid-sprint and damage numbers lived ~110ms — 2x looked broken rather
    // than fast, in the mode repeat players live in.
    <div className="theatre" style={{ "--spd": speed === 2 ? 0.5 : 1 } as React.CSSProperties}>
      <div
        className={`stage ${fx?.crit && !finished ? "quake" : ""}`}
        ref={stageRef}
        style={
          {
            "--dash": `${dash}px`,
            // The height comes from the scale we actually measured, not from a
            // media query guessing at it. CSS switched on the VIEWPORT while
            // this switches on the STAGE's width, so between about 561 and
            // 587px the backdrop was stretched 3x tall while the fighters were
            // drawn at 2x — the ground line and the champions came apart.
            height: px.h * px.scale,
          } as React.CSSProperties
        }
      >
        <div
          className="stage-bg"
          style={{
            backgroundImage: `url(${arenaScene(arena, px.w, px.h)})`,
            // Exactly nativeW × scale, not "100% of the stage": ceil(w/scale)
            // painted back into w stretched the art by a fraction of a pixel
            // (1.994x at some widths) and smeared the pixel grid. The couple
            // of surplus pixels vanish under the stage's overflow: hidden.
            width: px.w * px.scale,
            height: px.h * px.scale,
          }}
        />
        {arena.overlay && <div className="stage-wash" style={{ background: arena.overlay }} />}
        {arena.weather && <WeatherFx kind={arena.weather} count={14} />}
        <div className="arena-chip">{arena.name}</div>
        <div className="stage-hp">
          <HpBar name={names[0]} hp={hp[0]!} max={result.hpMax[0]} mirror={false} />
          <HpBar name={names[1]} hp={hp[1]!} max={result.hpMax[1]} mirror={true} />
        </div>
        <div className="vs-badge">VS</div>

        <div
          className="stage-figs"
          style={{ bottom: Math.round(px.h * (1 - arena.horizon) * px.scale) - px.scale }}
        >
          <div className="corner">
            <div key={`a${idx}`} className={slotClass(0)}>
              <div className={innerClass(0)}>
                <span className="fig-shadow" style={{ width: figH * 0.42 }} />
                <FighterFig
                  look={figures[0].look}
                  height={figH}
                  anim={animOf(0)}
                  aura={figures[0].aura}
                  weapon={weaponArtFor(disciplineById.get(heldWeapon[0] ?? "") ?? "")}
                  particles={figures[0].particles}
                />
                {renderEffects(0)}
              </div>
            </div>
            {heldWeapon[0] && (
              <div className="held-chip">{weaponNameById.get(heldWeapon[0]) ?? "Fists"}</div>
            )}
            {renderBeasts(0)}
          </div>

          <div className="corner">
            <div key={`b${idx}`} className={slotClass(1)}>
              <div className={innerClass(1)}>
                <span className="fig-shadow" style={{ width: figH * 0.42 }} />
                <FighterFig
                  look={figures[1].look}
                  height={figH}
                  anim={animOf(1)}
                  aura={figures[1].aura}
                  weapon={weaponArtFor(disciplineById.get(heldWeapon[1] ?? "") ?? "")}
                  particles={figures[1].particles}
                  mirror
                />
                {renderEffects(1)}
              </div>
            </div>
            {heldWeapon[1] && (
              <div className="held-chip on-right">{weaponNameById.get(heldWeapon[1]) ?? "Fists"}</div>
            )}
            {renderBeasts(1)}
          </div>
        </div>

        {anim?.invoke && (
          <div key={`inv${idx}`} className={`invoke invoke-${anim.invoke.side === 0 ? "l" : "r"}`}>
            <span className="invoke-ring" />
            <span className="invoke-name">{anim.invoke.name}</span>
          </div>
        )}

        {anim?.thrown && anim.striker !== undefined && (
          <span key={`m${idx}`} className={anim.striker === 0 ? "missile missile-r" : "missile missile-l"}>
            <Javelin size={72} mirror={anim.striker === 1} />
          </span>
        )}

        {finished && (
          <div className="verdict-wrap">
            {result.winner === 0 &&
              Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={i}
                  className="petal"
                  style={{
                    left: `${5 + i * 6.5}%`,
                    background: ["#a78bfa", "#34d399", "#f47c8e"][i % 3],
                    animationDelay: `${i * 90}ms`,
                  }}
                />
              ))}
            {/* Sized to the stage: at 150px on the 2× stage the wreath reached
                up over the HP bars and read as a purple creature, not a crown. */}
            <Laurel size={px.scale === 2 ? 92 : 150} color={result.winner === 0 ? "#a78bfa" : "#5b6178"} />
            <div className={`verdict ${result.winner === 0 ? "won" : "lost"}`}>
              {result.winner === 0 ? "VICTORY" : "DEFEAT"}
            </div>
            <div className="reward-chips">
              <span className="pill">+{rewards.xp} XP</span>
              <span className={`pill ${rewards.kleos >= 0 ? "gain" : "loss"}`}>
                {rewards.kleos >= 0 ? "+" : ""}{rewards.kleos} Rating
              </span>
              {rewards.drops?.map((d) => (
                <span key={d} className="pill drop"><PixIcon name="loot" size={10} /> {d}</span>
              ))}
            </div>
            <div className="verdict-sub">
              {names[result.winner]} takes it in {result.ticks} exchanges
            </div>
          </div>
        )}
      </div>

      <div className="feed" ref={feedRef} role="log" aria-live="polite">
        {visible.map((l, i) => (
          <p key={i} className={`line line-${l.kind} ${l.side === 0 ? "mine" : l.side === 1 ? "theirs" : "mid"}`}>
            {l.text}
          </p>
        ))}
      </div>

      <div className="theatre-controls">
        {!finished ? (
          <>
            <button
              className="btn ghost"
              onClick={() => {
                const next = speed === 1 ? 2 : 1;
                try {
                  localStorage.setItem("agoge.speed", String(next));
                } catch {
                  /* storage denied — the choice still holds for this fight */
                }
                setSpeed(next as 1 | 2);
              }}
            >
              {speed === 1 ? "2× speed" : "1× speed"}
            </button>
            <button className="btn ghost" onClick={() => setSkipped(true)}>
              Skip to result
            </button>
          </>
        ) : (
          <button className="btn primary big" onClick={onDone}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function HpBar({ name, hp, max, mirror }: { name: string; hp: number; max: number; mirror: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round((hp / max) * 100)));
  return (
    <div className={`hpbar ${mirror ? "mirror" : ""}`}>
      <div className="hpbar-name">{name}</div>
      <div className="hpbar-track">
        <div
          className={`hpbar-fill ${pct <= 20 ? "danger" : pct <= 50 ? "warn" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="hpbar-num">
        {Math.max(0, hp)} / {max}
      </div>
    </div>
  );
}
