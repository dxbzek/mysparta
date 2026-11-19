/**
 * The Level path as a tree (content v3, batch 3, plan 13.11): a trunk down the middle with a knot
 * per level reached; at each knot the card taken branches off to the left on a lit limb and the card
 * left behind to the right on a dashed, dead one. The start perks sit at the root. A knot that also
 * gave a talent point wears a small hex tag.
 */
import { useMemo } from "react";
import type { ScrapperRecord } from "@rankzero/core";
import { useGame } from "../../app/context";
import { NAMES } from "../../text/names";
import { UI } from "../../text/ui";
import { PerkIcon } from "../../ui/PerkIcon";
import { Sticker } from "../../ui/Sticker";
import { RouteCardChip } from "../parts/RouteCard";
import css from "./RouteTree.module.css";

export function RouteTreeView({ rec }: { rec: ScrapperRecord }) {
  const { core } = useGame();
  const nodes = useMemo(() => core.route(rec), [core, rec]);
  const sheet = core.sheetOf(rec);
  return (
    <>
      <p className={css.intro}><Sticker size="small" tone="hazard" tilt={-1}>{UI.kit.routeTitle}</Sticker> {UI.kit.routeIntro}</p>
      <div className={css.legend} aria-hidden="true">
        <span className={css.legendTaken}>{UI.kit.routeTaken}</span>
        <span className={css.legendLeft}>{UI.kit.routeLeft}</span>
      </div>
      <ol className={css.tree} aria-label={UI.kit.tabs.route}>
        <li className={css.root}>
          <span className={css.rootKnot}>{UI.kit.start}</span>
          <div className={css.rootPerks}>
            {[...new Set([sheet.startPerk, sheet.startSkill])].map((id) => (
              <span key={id} className={css.startPerk}>
                <PerkIcon id={id} size={44} rarity />
                <span className={css.startName}>{NAMES[id]}</span>
              </span>
            ))}
          </div>
        </li>
        {nodes.map((n) => {
          const talent = core.talentPointsAt(n.level) > core.talentPointsAt(n.level - 1);
          return (
            <li key={n.level} className={css.row} data-level={n.level}>
              <div className={css.taken}><RouteCardChip card={n.taken === "L" ? n.left : n.right} taken /></div>
              <span className={css.knot}>
                <span className={css.knotLevel}>{UI.lv(n.level)}</span>
                {talent ? <span className={css.talentTag} title={UI.kit.routeTalent}>{UI.kit.routeTalentShort}</span> : null}
              </span>
              <div className={css.left}><RouteCardChip card={n.taken === "L" ? n.right : n.left} taken={false} /></div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
