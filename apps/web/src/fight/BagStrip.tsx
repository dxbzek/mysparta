/**
 * The bag strip (28 px): each side's unused weapons and Moves as 20 px icons, at most 8 a side,
 * then a "+N" chip that counts down (brief 3.11 D). Reads only `HudFrame.bag`.
 */
import { memo } from "react";
import type { BagItem, Side } from "@rankzero/core";
import { NAMES } from "../text/names";
import { PerkIcon } from "../ui/PerkIcon";
import css from "./fight.module.css";

export const BAG_SHOWN = 8;

/** What one side shows: the first 8 items and how many more. Pure, for the test. */
export function bagView(bag: readonly BagItem[]): { shown: BagItem[]; more: number } {
  const shown = bag.slice(0, BAG_SHOWN);
  return { shown, more: bag.length - shown.length };
}

function SideBag({ side, bag, owner }: { side: Side; bag: readonly BagItem[]; owner: string }) {
  const { shown, more } = bagView(bag);
  const words = bag.map((b) => NAMES[b.id]).join(", ");
  return (
    <div className={`${css.bagSide} ${side === "b" ? css.bagSideB : ""}`} aria-label={`${owner}'s bag: ${words || "empty"}`} data-side={side} data-count={bag.length}>
      {shown.map((b, i) => (
        <PerkIcon key={`${b.id}-${i}`} id={b.id} size={20} />
      ))}
      {more > 0 ? <span className={css.chip} data-more={more}>+{more}</span> : null}
    </div>
  );
}

function BagStripView({ bag, names }: { bag: Readonly<Record<Side, readonly BagItem[]>>; names: Readonly<Record<Side, string>> }) {
  return (
    <div className={css.bag}>
      <SideBag side="a" bag={bag.a} owner={names.a} />
      <SideBag side="b" bag={bag.b} owner={names.b} />
    </div>
  );
}

const bagKey = (bag: readonly BagItem[]): string => bag.map((b) => (b.k === "move" ? `${b.id}:${b.uses}` : b.id)).join(",");
/** The player hands a new bag array every frame; re-render only when what it holds changes. */
export const BagStrip = memo(BagStripView, (p, q) =>
  p.names.a === q.names.a && p.names.b === q.names.b && bagKey(p.bag.a) === bagKey(q.bag.a) && bagKey(p.bag.b) === bagKey(q.bag.b));
