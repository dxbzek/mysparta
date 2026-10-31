/** The board of rivals: who you can fight today, and what each is worth. */
import { useEffect, useMemo, useState } from "react";
import { arenaBoard, beast, kleosDelta, skill, weapon, type Rival } from "@agoge/core";
import { WeaponIcon } from "../weaponIcons.js";
import { PixIcon } from "../pixelIcons.js";
import { FighterBust, rivalLook } from "../fighters.js";
import { PetSprite } from "../pixelPets.js";
import { SkillIcon, type SkillKind } from "../skillIcons.js";
import { todayKey, untilReset, VIGOR_CAP, VIGOR_DAILY, type SaveV1 } from "../save.js";
import { StandingsStrip } from "../ui.js";
/** How dangerous a rival looks next to your own rating. */

function threatOf(mine: number, theirs: number): "easy" | "even" | "hard" {
  if (theirs < mine - 40) return "easy";
  if (theirs > mine + 40) return "hard";
  return "even";
}
const THREAT_LABEL: Record<string, string> = { easy: "Weaker", even: "Even", hard: "Stronger" };

/**
 * A level-18 rival carries eleven things, and eleven named chips was five rows
 * of shopping list above the button you came to press. The board is a glance:
 * icons only, at 2x so the 16px pixel grid lands on whole pixels, with the name
 * on the tooltip. Six plus the count fit one row on a phone; more than that
 * wrapped and put a second row on every card in the board.
 */
const KIT_SHOWN = 6;
/** Icons are drawn on a 16px grid, so only integer multiples stay crisp. */
const KIT_ICON = 32;

/** Phone-sized bust. Sized here, not in CSS: the tile clips what overflows it,
    so shrinking the box without shrinking the fighter beheads them. */
const RIVAL_BUST = { wide: 64, narrow: 48 };

function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof matchMedia === "function" && matchMedia("(max-width: 560px)").matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const q = matchMedia("(max-width: 560px)");
    const on = () => setNarrow(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return narrow;
}

function rivalKit(r: Rival) {
  const chips = [
    ...(r.snapshot.weapons.length > 0
      ? r.snapshot.weapons.map((w) => ({
          key: `w${w}`,
          cls: "kit-chip",
          title: `${weapon(w).name} — ${weapon(w).flavour}`,
          icon: <WeaponIcon d={w} size={KIT_ICON} />,
          name: weapon(w).name,
        }))
      : [
          {
            key: "bare",
            cls: "kit-chip",
            title: "Bare-handed — no weapon at all.",
            icon: <WeaponIcon d="fists" size={KIT_ICON} />,
            name: "Bare-handed",
          },
        ]),
    ...r.snapshot.skills.map((s) => ({
      key: `s${s}`,
      cls: "kit-chip skill",
      title: `${skill(s).name} — ${skill(s).text}`,
      icon: <SkillIcon id={s} kind={skill(s).kind as SkillKind} size={KIT_ICON} />,
      name: skill(s).name,
    })),
    ...r.snapshot.beasts.map((b, bi) => ({
      key: `b${b}${bi}`,
      cls: "kit-chip pet",
      title: `${beast(b).name} fights alongside them.`,
      icon: <PetSprite beastId={b} size={KIT_ICON} />,
      name: beast(b).name,
    })),
  ];
  return { shown: chips.slice(0, KIT_SHOWN), rest: chips.slice(KIT_SHOWN) };
}



export function Arena(props: {
  save: SaveV1;
  onBack: () => void;
  onRefresh: () => void;
  onFight: (r: Rival) => void;
}) {
  const { save } = props;
  const bustSize = useNarrow() ? RIVAL_BUST.narrow : RIVAL_BUST.wide;
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
          You're out of fights for today — <b>{VIGOR_DAILY} more in {untilReset().text}</b>, and
          they bank up to {VIGOR_CAP}. Your Hall is still yours to tinker with: reorder your
          draw, change what you wear, study the Codex.
        </p>
      )}
      <div className="rivals">
        {board.map((r, i) => {
          return (
            <div className="card rival" key={r.snapshot.name} style={{ animationDelay: `${i * 55}ms` }}>
              <div className="rival-top">
                <FighterBust look={rivalLook(r.snapshot.name).look} size={bustSize} mirror />
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
              {(() => {
                const kit = rivalKit(r);
                return (
                  <div className="rival-kit">
                    {kit.shown.map((c) => (
                      <span className={`${c.cls} kit-icon`} key={c.key} title={c.title}>
                        {c.icon}
                        <em>{c.name}</em>
                      </span>
                    ))}
                    {kit.rest.length > 0 && (
                      <span
                        className="kit-chip kit-more"
                        title={kit.rest.map((c) => c.name).join(" · ")}
                      >
                        +{kit.rest.length}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* the wager, so picking an opponent is a decision; on a phone
                  it shares one row with the verb it informs */}
              <div className="rival-action">
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
            </div>
          );
        })}
      </div>

      {/* Who to fight is the decision; where you stand is the epilogue. */}
      <StandingsStrip save={save} />
    </div>
  );
}

