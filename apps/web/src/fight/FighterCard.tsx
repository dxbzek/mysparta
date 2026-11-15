/**
 * One fighter's ink-framed card under the stage (owner, plan 13.7: "a proper skill view, proper
 * information, and stats"). Portrait, name, level and HP; Strength, Agility and Speed as bars with
 * icons and numbers; the weapon in hand with its drawing and numbers; the owned skills as tiles
 * that light up and pulse when they fire; each pet with its own HP bar; the shield; the bag.
 *
 * What changes during a bout comes in as plain values read from `hud(t)`, `state(t)` and the
 * beats (`lit`): this view has no clock, no state and no animation of its own.
 */
import type { ActorId, ActorInit, ActorState, BagItem, CompanionId, FighterSnapshot, HeldId, Look, ShieldId, Side, SkillId, StatKey, WeaponId } from "@rankzero/core";
import { api, perkKind } from "@rankzero/core";
import type { HudFrame } from "@rankzero/stage";
import { rig } from "../seams/rig";
import { NAMES } from "../text/names";
import { PerkIcon } from "../ui/PerkIcon";
import { Portrait } from "../ui/Portrait";
import { SvgArtView } from "../ui/SvgArt";
import { SideBag } from "./BagStrip";
import css from "./fight.module.css";

/** The fixed facts of one side for the bout. */
export interface CardInfo {
  side: Side;
  name: string;
  level: number;
  look: Look;
  stats: Readonly<Record<StatKey, number>>;
  /** Skills shown as tiles, Moves and passives first, boosters last. */
  skills: readonly SkillId[];
  pets: readonly ActorInit[];
}

/** How many skill tiles a card shows before a "+N" tile. */
export const SKILL_TILES = 4;
/** Every stat bar fills against this, so two cards compare at a glance. */
export const STAT_SCALE = 16;

const STATS: readonly { key: StatKey; short: string }[] = [
  { key: "strength", short: "STR" }, { key: "agility", short: "AGI" }, { key: "speed", short: "SPD" },
];

/** The card facts from a snapshot and the bout's actors. Pure. */
export function cardInfo(side: Side, snap: FighterSnapshot, actors: readonly ActorInit[]): CardInfo {
  const sheet = api.snapshotSheet(snap);
  const skills = snap.perks.filter((p) => perkKind(p) === "skill") as SkillId[];
  const order = (id: SkillId): number => {
    const k = api.content.skills[id]?.kind;
    return k === "move" ? 0 : k === "booster" ? 2 : 1;
  };
  return {
    side, name: snap.name, level: snap.level, look: snap.look,
    stats: sheet.effective,
    skills: [...skills].sort((p, q) => order(p) - order(q)),
    pets: actors.filter((x) => x.id.startsWith(side) && x.kind !== "scrapper"),
  };
}

/** "DMG 10 · REACH 2" for a weapon in hand, from the tables. */
export function weaponLine(id: HeldId): string {
  if (id === "fists") return "Bare hands";
  const w = api.content.weapons[id as WeaponId];
  if (!w) return "";
  const n = w.tiers[0];
  return `DMG ${n.dmg} · ${n.reach === null ? "THROWN" : `REACH ${n.reach}`}`;
}

const pct = (v: number, max: number): string => `${(max > 0 ? Math.max(0, Math.min(1, v / max)) * 100 : 0).toFixed(1)}%`;

export interface FighterCardProps {
  info: CardInfo;
  frame: HudFrame;
  state: ActorState | undefined;
  pets: readonly (ActorState | undefined)[];
  bag: readonly BagItem[];
  /** Glow 0 to 1 of each lit tile, keyed `side:perk`. */
  lit: ReadonlyMap<string, number>;
  /** A pulse phase from the fight clock (0 to 1) for lit tiles; 0 under reduced motion. */
  pulse: number;
}

function SkillTile({ id, glow, pulse, side }: { id: SkillId; glow: number; pulse: number; side: Side }) {
  const on = glow > 0;
  const kind = api.content.skills[id]?.kind;
  const style = on ? { transform: `scale(${(1 + 0.06 * glow * pulse).toFixed(3)})` } : undefined;
  return (
    <li className={`${css.skill} ${on ? (side === "a" ? css.skillOnA : css.skillOnB) : ""}`} style={style} data-lit={on ? "1" : undefined}>
      <PerkIcon id={id} size={28} />
      <span className={css.skillText}>
        <span className={css.skillName}>{NAMES[id]}</span>
        <span className={css.skillKind}>{kind === "move" ? "Move" : kind === "booster" ? "Booster" : "Passive"}</span>
      </span>
    </li>
  );
}

export function FighterCard({ info, frame, state, pets, bag, lit, pulse }: FighterCardProps) {
  const { side } = info;
  const hp = frame.hp[`${side}0` as ActorId];
  const now = hp ? Math.max(0, Math.round(hp.now)) : 0;
  const held: HeldId = state?.held ?? "fists";
  const shield: ShieldId | null = state?.shield ?? null;
  const down = state?.status === "ko" || now === 0;
  const shown = info.skills.slice(0, info.skills.length > SKILL_TILES ? SKILL_TILES - 1 : SKILL_TILES);
  const more = info.skills.length - shown.length;
  return (
    <section className={`${css.card} ${side === "a" ? css.cardA : css.cardB}`} aria-label={`${info.name}, level ${info.level}`} data-side={side}>
      <div className={css.cardHead}>
        <span className={css.cardName}>{info.name}</span>
        <span className={css.cardLvl}>LV {info.level}</span>
        <span className={css.cardHp} data-card-hp={now}>{now}<small>HP</small></span>
      </div>
      <div className={css.cardBody}>
        <span className={css.portraitWrap}>
          <Portrait look={info.look} size={56} label={`${info.name}`} />
          {shield !== null ? (
            <span className={`${css.shield} ${(lit.get(`${side}:${shield}`) ?? 0) > 0 ? (side === "a" ? css.shieldOnA : css.shieldOnB) : ""}`} role="img" aria-label={`Shield: ${NAMES[shield]}`} title={NAMES[shield]}>
              <PerkIcon id={shield} size={20} />
            </span>
          ) : null}
          {down ? <span className={css.koStampSmall} aria-label="Knocked out">K.O.</span> : null}
        </span>
        <div className={css.stats}>
          {STATS.map((s) => (
            <div key={s.key} className={css.stat} role="group" aria-label={`${s.key} ${info.stats[s.key]}`}>
              <SvgArtView art={rig.icon(`stat:${s.key}`)} size={14} className={css.statIcon} />
              <span className={css.statKey}>{s.short}</span>
              <span className={css.statTrack} aria-hidden="true"><span className={css.statFill} style={{ width: pct(info.stats[s.key], STAT_SCALE) }} /></span>
              <span className={css.statNum}>{info.stats[s.key]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={css.weapon}>
        <PerkIcon id={held} size={28} />
        <span className={css.weaponText}>
          <span className={css.weaponName}>{held === "fists" ? "Fists" : NAMES[held]}</span>
          <span className={css.weaponLine}>{weaponLine(held)}</span>
        </span>
      </div>
      {info.skills.length > 0 ? (
        <ul className={css.skills} aria-label={`${info.name}'s skills`}>
          {shown.map((id) => <SkillTile key={id} id={id} side={side} glow={lit.get(`${side}:${id}`) ?? 0} pulse={pulse} />)}
          {more > 0 ? <li className={`${css.skill} ${css.skillMore}`}>+{more} more</li> : null}
        </ul>
      ) : <p className={css.empty}>No skills yet</p>}
      {info.pets.length > 0 ? info.pets.map((p, i) => {
        const h = frame.hp[p.id];
        const left = Math.max(0, Math.round(h?.now ?? 0));
        const gone = pets[i]?.status === "ko" || pets[i]?.status === "fled";
        return (
          <div key={p.id} className={`${css.pet} ${gone ? css.petGone : ""}`}>
            <Portrait companion={p.kind as CompanionId} size={30} label={NAMES[p.kind as CompanionId]} />
            <span className={css.petName}>{NAMES[p.kind as CompanionId]}</span>
            <span className={css.petBar} role="meter" aria-label={`${NAMES[p.kind as CompanionId]} HP`} aria-valuemin={0} aria-valuemax={h?.max ?? 0} aria-valuenow={left}>
              <span className={css.petTrail} style={{ width: pct(h?.trail ?? 0, h?.max ?? 1) }} />
              <span className={css.petFill} style={{ width: pct(h?.now ?? 0, h?.max ?? 1) }} />
            </span>
            <span className={css.petNum}>{pets[i]?.status === "fled" ? "Ran" : `${left}/${h?.max ?? 0}`}</span>
          </div>
        );
      }) : <p className={css.empty}>No pet</p>}
      <div className={css.bagRow}>
        <span className={css.bagLabel}>Bag</span>
        {bag.length > 0 ? <SideBag side={side} bag={bag} owner={info.name} compact /> : <span className={css.bagEmpty}>Empty</span>}
      </div>
    </section>
  );
}
