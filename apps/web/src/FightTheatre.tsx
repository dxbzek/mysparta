import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BEASTS, FISTS, WEAPONS, type FightResult } from "@agoge/core";
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

const weaponIdByName = new Map<string, string>([
  [FISTS.name, FISTS.id],
  ...WEAPONS.map((w) => [w.name, w.id] as const),
]);

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

const beastIdByName = new Map(BEASTS.map((b) => [b.name, b.id]));

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
  const [speed, setSpeed] = useState<1 | 2>(1);
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
      const scale = w < 560 ? 2 : 3;
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

  // Beasts that have fallen so far (by display name → id).
  const downed: [Set<string>, Set<string>] = useMemo(() => {
    const sets: [Set<string>, Set<string>] = [new Set(), new Set()];
    for (const l of visible) {
      if (l.beastDown) {
        const id = beastIdByName.get(l.beastDown.beast);
        if (id) sets[l.beastDown.side].add(id);
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
      if (l.drew) held[l.drew.side] = weaponIdByName.get(l.drew.weapon) ?? held[l.drew.side];
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

  const idxRef = useRef(0);
  idxRef.current = idx;

  // SFX per beat, timed to land at contact.
  useEffect(() => {
    if (skipped) return;
    const l = lines[shown - 1];
    if (!l) return;
    if (l.kind === "end") {
      sound.fanfare(l.text.includes(names[0]));
      return;
    }
    if (l.anim?.beastName) sound.beast();
    // Impacts land a beat after the swing; if the beat is cut short (skip,
    // unmount) the pending blow is cancelled rather than firing into silence.
    const pending: number[] = [];
    const land = (fn: () => void, ms: number) => pending.push(window.setTimeout(fn, ms));
    // What you hear is what is actually swinging: the striker's weapon this
    // beat, and the defender's real answer to it.
    const striker = l.anim?.striker;
    const kind = strikeKind(striker === undefined ? undefined : heldWeapon[striker], idxRef.current);
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
          land(() => sound.strike(kind, crit), kind === "axe" ? 150 : 95);
        }
        break;
      }
      case "defend":
        if (l.fx?.heal) sound.heal();
        else if (l.anim?.reaction?.kind === "block") {
          sound.swing(kind);
          const guard = l.anim.reaction.side;
          land(() => sound.block(hasShield[guard]), 95);
        } else if (l.anim?.reaction?.kind === "dodge") {
          sound.swing(kind);
          land(() => sound.dodge(), 90);
        } else if (l.anim?.thrown) sound.throwSpear();
        else sound.swing(kind);
        break;
      case "trump":
        sound.power();
        break;
    }
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, [shown, skipped, lines, names, heldWeapon, hasShield]);

  const slotClass = (side: 0 | 1): string => {
    const cls = ["fig-slot"];
    if (idx <= 1) cls.push(side === 0 ? "enter-l" : "enter-r");
    // A chain hit keeps the swing but skips the run-in: they are already close.
    if (anim?.striker === side && !anim.beastName && !anim.chain) {
      cls.push(anim.thrown ? (side === 0 ? "throw-r" : "throw-l") : side === 0 ? "strike-r" : "strike-l");
    }
    if (anim?.reaction?.side === side) {
      cls.push(`${anim.reaction.kind}-${side === 0 ? "l" : "r"}`);
    }
    return cls.join(" ");
  };

  const innerClass = (side: 0 | 1): string => {
    const cls = ["fig-inner"];
    if (finished && side === loser && result.reason === "ko") cls.push("felled");
    else if (finished && side === result.winner) cls.push("win");
    else cls.push("idle");
    if (anim?.reaction?.side === side && anim.reaction.kind === "hurt") cls.push("flash");
    return cls.join(" ");
  };

  /** Which sheet animation each fighter plays this beat. */
  const animOf = (side: 0 | 1): FighterAnim => {
    if (finished && side === loser && result.reason === "ko") return "death";
    if (finished) return "stance";
    if (anim?.reaction?.side === side && anim.reaction.kind === "hurt") return "hit";
    if (anim?.striker === side && !anim.beastName) return idx % 2 === 0 ? "attack1" : "attack2";
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
    const actingId = anim?.beastName ? beastIdByName.get(anim.beastName) : undefined;
    const actingSide = anim?.striker;
    return (
      <div className={`fig-beasts ${side === 0 ? "beasts-l" : "beasts-r"}`}>
        {list.map((id, i) => {
          const striking = actingSide === side && actingId === id;
          return (
            <span
              key={`${id}${i}${striking ? idx : ""}`}
              className={striking ? (side === 0 ? "beast-dash-r" : "beast-dash-l") : "beast-idle"}
            >
              <PetSprite beastId={id} size={54} mirror={side === 1} down={downed[side].has(id)} />
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="theatre">
      <div
        className={`stage ${fx?.crit && !finished ? "quake" : ""}`}
        ref={stageRef}
        style={{ "--dash": `${dash}px` } as React.CSSProperties}
      >
        <div
          className="stage-bg"
          style={{ backgroundImage: `url(${arenaScene(arena, px.w, px.h)})` }}
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
            <Laurel size={150} color={result.winner === 0 ? "#a78bfa" : "#5b6178"} />
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
              {names[result.winner]} · {result.ticks} ticks · sim v{result.simVersion}
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
            <button className="btn ghost" onClick={() => setSpeed(speed === 1 ? 2 : 1)}>
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
