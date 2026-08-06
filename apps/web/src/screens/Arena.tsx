/** The board of rivals: who you can fight today, and what each is worth. */
import { useMemo } from "react";
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



export function Arena(props: {
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
                      <WeaponIcon d={w} size={15} /> {weapon(w).name}
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

