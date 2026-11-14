/**
 * How a perk is shown on the app screens: a card row (Kit, the found list), a detail sheet body
 * (exact numbers), and a level-up card. All words from text/perks.ts, all art from the rig.
 */
import type { PerkId } from "@rankzero/core";
import { needsLine, perkNumbers, perkText } from "../../text/perks";
import { UI } from "../../text/ui";
import { PerkIcon } from "../../ui/PerkIcon";
import common from "../common.module.css";
import css from "./parts.module.css";

export function RarityWord({ id, small }: { id: PerkId; small?: boolean }) {
  const t = perkText(id);
  return <span className={`${common.rarity} ${common[t.rarity]} ${small ? css.raritySmall : ""}`}>{t.rarityWord}</span>;
}

/** One perk as a full-width card: icon, name, rarity word, kind, effect, costs, and a need. */
export function PerkRow({ id, owned, onOpen }: { id: PerkId; owned?: readonly PerkId[]; onOpen?(id: PerkId): void }) {
  const t = perkText(id);
  const need = owned ? needsLine(id, owned) : null;
  const inner = (
    <>
      <span className={`${css.rowIcon} ${css[`edge-${t.rarity}`]}`}><PerkIcon id={id} size={64} rarity /></span>
      <span className={css.rowText}>
        <span className={css.rowHead}>
          <span className={css.rowName}>{t.name}</span>
          <span className={`${common.rarity} ${common[t.rarity]}`}>{t.rarityWord}</span>
        </span>
        <span className={css.rowKind}>{t.kind}</span>
        <span className={css.rowEffect}>{t.effect}</span>
        {t.costs.map((c) => <span key={c} className={`${css.rowCost} ${common.cost}`}>{c}</span>)}
        {need ? <span className={`${css.rowCost} ${common.note}`}>{need}</span> : null}
      </span>
    </>
  );
  if (!onOpen) return <div className={css.row}>{inner}</div>;
  return (
    <button type="button" className={`${css.row} ${css.rowButton}`} onClick={() => onOpen(id)} aria-label={`${t.name}, ${t.rarityWord} ${t.kind}. ${t.effect}`}>
      {inner}
    </button>
  );
}

/** The body of a perk's detail sheet. */
export function PerkDetail({ id, owned }: { id: PerkId; owned?: readonly PerkId[] }) {
  const t = perkText(id);
  const nums = perkNumbers(id);
  const need = owned ? needsLine(id, owned) : null;
  return (
    <div className={css.detail}>
      <div className={css.detailHead}>
        <PerkIcon id={id} size={64} rarity />
        <div>
          <p className={css.detailName}>{t.name}</p>
          <p className={css.detailKind}><span className={`${common.rarity} ${common[t.rarity]}`}>{t.rarityWord}</span> {t.kind}</p>
        </div>
      </div>
      <p className={css.detailEffect}>{t.effect}</p>
      {t.costs.map((c) => <p key={c} className={`${css.detailCost} ${common.cost}`}>{c}</p>)}
      {need ? <p className={`${css.detailCost} ${common.note}`}>{need}</p> : null}
      {nums.length ? (
        <>
          <h3 className={css.detailSub}>{UI.kit.numbers}</h3>
          <dl className={css.numbers}>
            {nums.map((n) => (
              <div key={n.label} className={css.number}>
                <dt>{n.label}</dt>
                <dd className={n.value.startsWith("-") ? common.cost : undefined}>{n.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </div>
  );
}
