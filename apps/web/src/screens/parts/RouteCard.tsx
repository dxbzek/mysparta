/**
 * A Route card (a level-up choice): the stat card, the split card or the perk card. The same
 * component draws the big level-up cards and the small rows of the Level path.
 */
import type { CoreApi, FighterSnapshot, PerkId, RouteCard, StatKey } from "@rankzero/core";
import { needsLine, perkText } from "../../text/perks";
import { STAT_GAIN_LINE, STAT_NAME } from "../../text/stats";
import { UI } from "../../text/ui";
import { rig } from "../../seams/rig";
import { PerkIcon } from "../../ui/PerkIcon";
import { SvgArtView } from "../../ui/SvgArt";
import common from "../common.module.css";
import css from "./parts.module.css";

export interface CardPreview { stats: { stat: StatKey; amount: number; from: number; to: number }[]; hpGain: number }

/** What a stat or split card changes for this scrapper, computed by the core (no rule copied):
 *  effective values before and after, and the max HP it really gives at the new level. */
export function previewCard(core: CoreApi, snap: FighterSnapshot, card: RouteCard): CardPreview {
  if (card.kind === "perk") return { stats: [], hpGain: 0 };
  const adds: Partial<Record<StatKey, number>> = card.kind === "stat" ? { [card.stat]: card.amount } : { [card.stats[0]]: 1, [card.stats[1]]: 1 };
  const at = { ...snap, level: snap.level + 1 };
  const before = core.snapshotSheet(at);
  const points = { ...snap.stats.points };
  for (const [k, v] of Object.entries(adds) as [StatKey, number][]) points[k] += v;
  const after = core.snapshotSheet({ ...at, stats: { points, mult: snap.stats.mult } });
  return {
    stats: (Object.entries(adds) as [StatKey, number][]).map(([stat, amount]) => ({ stat, amount, from: before.effective[stat], to: after.effective[stat] })),
    hpGain: after.maxHp - before.maxHp,
  };
}

export function cardTitle(card: RouteCard): string {
  if (card.kind === "stat") return UI.levelUp.statPlus(card.amount, STAT_NAME[card.stat]);
  if (card.kind === "split") return `${UI.levelUp.statPlus(1, STAT_NAME[card.stats[0]])}, ${UI.levelUp.statPlus(1, STAT_NAME[card.stats[1]])}`;
  const name = perkText(card.perk).name;
  return card.plus === undefined ? name : `${name}, ${UI.levelUp.statPlus(1, STAT_NAME[card.plus])}`;
}

function StatIcon({ stat, size }: { stat: StatKey; size: number }) {
  return <span className={`${css.statIcon} ${css[`stat-${stat}`]}`} style={{ width: size, height: size }}><SvgArtView art={rig.icon(`stat:${stat}`)} size={Math.round(size * 0.66)} /></span>;
}

/** The face of a big card (level-up). */
export function RouteCardFace({ card, preview, owned }: { card: RouteCard; preview: CardPreview; owned: readonly PerkId[] }) {
  if (card.kind === "perk") {
    const t = perkText(card.perk);
    const need = needsLine(card.perk, owned);
    return (
      <span className={css.face}>
        <span className={css.faceArt}><PerkIcon id={card.perk} size={64} rarity /></span>
        <span className={`${common.rarity} ${common[t.rarity]}`}>{t.rarityWord}</span>
        <span className={css.faceName}>{t.name}</span>
        <span className={css.faceKind}>{t.kind}</span>
        <span className={css.faceLine}>{t.effect}</span>
        {card.plus !== undefined ? <span className={css.faceName}>{UI.levelUp.statPlus(1, STAT_NAME[card.plus])}</span> : null}
        {t.costs.map((c) => <span key={c} className={`${css.faceLine} ${common.cost}`}>{c}</span>)}
        {need ? <span className={`${css.faceLine} ${common.note}`}>{need}</span> : null}
      </span>
    );
  }
  const first = preview.stats[0];
  return (
    <span className={css.face}>
      <span className={css.faceArt}>
        {preview.stats.map((s) => <StatIcon key={s.stat} stat={s.stat} size={preview.stats.length > 1 ? 44 : 60} />)}
      </span>
      <span className={css.faceKicker}>{card.kind === "split" ? UI.levelUp.split : STAT_NAME[card.stat]}</span>
      {preview.stats.map((s) => (
        <span key={s.stat} className={css.faceStat}>
          <span className={css.faceName}>{UI.levelUp.statPlus(s.amount, STAT_NAME[s.stat])}</span>
          <span className={css.faceFromTo}>{UI.levelUp.fromTo(s.from, s.to)}</span>
        </span>
      ))}
      {preview.stats.some((s) => s.stat === "health") ? <span className={css.faceHp}>{UI.levelUp.hpGain(preview.hpGain)}</span> : null}
      {first ? <span className={css.faceLine}>{STAT_GAIN_LINE[first.stat]}</span> : null}
    </span>
  );
}

/** A small card for a row of the Level path. */
export function RouteCardChip({ card, taken }: { card: RouteCard; taken: boolean }) {
  const label = taken ? UI.kit.taken : UI.kit.notTaken;
  if (card.kind === "perk") {
    const t = perkText(card.perk);
    return (
      <span className={`${css.chip} ${taken ? css.chipTaken : css.chipNot}`} aria-label={`${label}: ${cardTitle(card)}, ${t.rarityWord}`}>
        <PerkIcon id={card.perk} size={44} rarity />
        <span className={css.chipText}>
          <span className={css.chipName}>{t.name}</span>
          <span className={`${common.rarity} ${common[t.rarity]} ${css.raritySmall}`}>{t.rarityWord}</span>
          {card.plus !== undefined ? <span className={css.chipName}>{UI.levelUp.statPlus(1, STAT_NAME[card.plus])}</span> : null}
        </span>
      </span>
    );
  }
  const stats: StatKey[] = card.kind === "stat" ? [card.stat] : [card.stats[0], card.stats[1]];
  return (
    <span className={`${css.chip} ${taken ? css.chipTaken : css.chipNot}`} aria-label={`${label}: ${cardTitle(card)}`}>
      <span className={css.chipIcons}>{stats.map((s) => <StatIcon key={s} stat={s} size={stats.length > 1 ? 30 : 44} />)}</span>
      <span className={css.chipText}><span className={css.chipName}>{cardTitle(card)}</span></span>
    </span>
  );
}
