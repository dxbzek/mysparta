import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BEASTS, FISTS, WEAPONS, type Appearance, type Discipline, type FightResult } from "@agoge/core";
import {
  BeastFigure,
  CrowdStrip,
  HopliteFigure,
  ImpactBurst,
  Javelin,
  Laurel,
  SlashArc,
  paletteFromAppearance,
} from "./art.js";
import { narrate, type Line } from "./narrate.js";
import { sound } from "./sound.js";

export interface StageFigure {
  appearance: Appearance;
  discipline: Discipline | "fists";
  /** Weapon in hand at the start of the fight. */
  weaponId?: string;
  /** Shield carried, if any. */
  shieldId?: string;
  beasts: string[];
}

const weaponIdByName = new Map<string, string>([
  [FISTS.name, FISTS.id],
  ...WEAPONS.map((w) => [w.name, w.id] as const),
]);

interface Props {
  result: FightResult;
  names: [string, string];
  figures: [StageFigure, StageFigure];
  /** Post-fight summary shown under the verdict. */
  rewards: { xp: number; kleos: number };
  onDone: () => void;
}

const beastIdByName = new Map(BEASTS.map((b) => [b.name, b.id]));

/**
 * The arena stage: champions run in, dash across to strike, swing, dodge,
 * block and fall — all directed by the deterministic event log.
 */
export function FightTheatre({ result, names, figures, rewards, onDone }: Props) {
  const lines = useMemo(() => narrate(result, names), [result, names]);
  const [shown, setShown] = useState(1);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [skipped, setSkipped] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [dash, setDash] = useState(220);
  const [figH, setFigH] = useState(168);
  const speedRef = useRef<1 | 2>(1);
  speedRef.current = speed;

  useLayoutEffect(() => {
    const measure = () => {
      const w = stageRef.current?.clientWidth ?? 800;
      const h = w < 520 ? 138 : 168;
      setFigH(h);
      const figW = (h * 200) / 230;
      setDash(Math.max(40, Math.round(w * 0.84 - 2 * figW + 26)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

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
    switch (l.kind) {
      case "info":
        if (l.text.includes("enter the arena")) sound.drum();
        break;
      case "hit":
        sound.hit(false);
        break;
      case "crit":
        sound.hit(true);
        break;
      case "defend":
        if (l.fx?.heal) sound.heal();
        else if (l.anim?.reaction?.kind === "block" || l.fx) sound.block();
        else if (l.anim?.thrown) sound.throwSpear();
        else sound.whoosh();
        break;
      case "trump":
        sound.power();
        break;
    }
  }, [shown, skipped, lines, names]);

  useEffect(() => {
    if (skipped) sound.fanfare(result.winner === 0);
  }, [skipped, result.winner]);

  const visible: Line[] = skipped ? lines : lines.slice(0, shown);
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
  }, [visible, figures]);

  const slotClass = (side: 0 | 1): string => {
    const cls = ["fig-slot"];
    if (idx <= 1) cls.push(side === 0 ? "enter-l" : "enter-r");
    if (anim?.striker === side && !anim.beastName) {
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
              <BeastFigure beastId={id} size={54} mirror={side === 1} down={downed[side].has(id)} />
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
        <div className="stage-floor" />
        <div className={`crowd ${fx?.crit ? "hype" : ""}`}>
          <CrowdStrip />
        </div>
        <div className="stage-hp">
          <HpBar name={names[0]} hp={hp[0]!} max={result.hpMax[0]} mirror={false} />
          <HpBar name={names[1]} hp={hp[1]!} max={result.hpMax[1]} mirror={true} />
        </div>
        <div className="vs-badge">VS</div>

        <div className="stage-figs">
          <div className="corner">
            <div key={`a${idx}`} className={slotClass(0)}>
              <div className={innerClass(0)}>
                <HopliteFigure
                  height={figH}
                  palette={paletteFromAppearance(figures[0].appearance)}
                  discipline={figures[0].discipline}
                  weaponId={heldWeapon[0]}
                  shieldId={figures[0].shieldId}
                  helm={figures[0].appearance.helm}
                  sigil={figures[0].appearance.sigil}
                />
                {renderEffects(0)}
              </div>
            </div>
            {renderBeasts(0)}
          </div>

          <div className="corner">
            <div key={`b${idx}`} className={slotClass(1)}>
              <div className={innerClass(1)}>
                <HopliteFigure
                  height={figH}
                  palette={paletteFromAppearance(figures[1].appearance)}
                  discipline={figures[1].discipline}
                  weaponId={heldWeapon[1]}
                  shieldId={figures[1].shieldId}
                  helm={figures[1].appearance.helm}
                  sigil={figures[1].appearance.sigil}
                  mirror
                />
                {renderEffects(1)}
              </div>
            </div>
            {renderBeasts(1)}
          </div>
        </div>

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
