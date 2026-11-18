/**
 * E. Level-up (brief 3.5, 3.11 E). Two cards side by side, order as the Route gives them. Tap a
 * card to lift it, "Take it" confirms (two taps, so a slip of the thumb cannot spend a level).
 * After confirming, the taken card is stamped "Taken" and the other dims under "Not taken".
 * The screen cannot be left without choosing: there is no back button while a choice waits.
 */
import { useMemo, useState } from "react";
import type { HeldId, Pick as Side2, RouteCard, ScrapperRecord } from "@rankzero/core";
import { RARITY_OF, perkKind } from "@rankzero/core";
import { activeRecord } from "../../app/guards";
import { useDoc, useGame } from "../../app/context";
import { STAT_NAME } from "../../text/stats";
import { UI } from "../../text/ui";
import { ActorStage } from "../../ui/ActorStage";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { Sticker } from "../../ui/Sticker";
import { StatIconDot } from "../parts/MiniStats";
import { RouteCardFace, cardTitle, previewCard } from "../parts/RouteCard";
import { useShortScreen } from "../parts/motion";
import { chipRow, previewSheet } from "./chips";
import common from "../common.module.css";
import css from "./LevelUp.module.css";

interface Offer { rec: ScrapperRecord; left: RouteCard; right: RouteCard }

export function LevelUpScreen() {
  const { core, actions, go, toast } = useGame();
  const doc = useDoc();
  const live = activeRecord(doc);
  // The offer is frozen when the screen opens, so the cards stay put after the pick is saved.
  const [offer, setOffer] = useState<Offer | null>(() => (live ? { rec: live, ...core.routeNode(live.seed, live.picks, live.base) } : null));
  const [sel, setSel] = useState<Side2 | null>(null);
  const [taken, setTaken] = useState<Side2 | null>(null);
  const [busy, setBusy] = useState(false);
  const short = useShortScreen();
  const before = useMemo(() => (offer ? core.sheetOf(offer.rec) : null), [offer, core]);
  const snap = useMemo(() => (offer ? core.snapshotOf(offer.rec) : null), [offer, core]);
  if (!offer || !before || !snap || !live) return null;
  const level = before.level + 1;
  const held = (before.perks.find((p) => perkKind(p) === "weapon") ?? null) as HeldId | null;
  const liveSheet = core.sheetOf(live);
  const moreWaiting = taken !== null && liveSheet.levelUpWaiting;
  // Taken: the live record. Lifted stat card: a preview. Otherwise the row as it stands.
  const selCard = sel === "L" ? offer.left : sel === "R" ? offer.right : null;
  const after = taken !== null ? liveSheet : previewSheet(core, snap, selCard);
  const chips = chipRow(before, after);
  const chipState = taken !== null ? css.chipTaken : css.chipPreview;

  const take = async (): Promise<void> => {
    if (!sel || busy || taken) return;
    setBusy(true);
    try {
      const r = await actions.takeLevelUp(offer.rec.id, sel);
      if (r.ok) setTaken(sel);
      else {
        toast(UI.levelUp.nothing);
        go({ name: "locker" });
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const next = (): void => {
    setOffer({ rec: live, ...core.routeNode(live.seed, live.picks, live.base) });
    setSel(null);
    setTaken(null);
  };

  const card = (side: Side2, c: RouteCard) => {
    const preview = previewCard(core, snap, c);
    const isSel = sel === side;
    const state = taken === null ? (isSel ? css.lifted : "") : taken === side ? css.taken : css.dimmed;
    const glow = c.kind === "perk" ? css[`glow-${RARITY_OF[c.perk]}`] ?? "" : css.glowStat;
    return (
      <button
        key={`${offer.rec.picks.length}${side}`}
        type="button"
        className={`${css.card} ${side === "R" ? css.cardR : ""} ${glow} ${state}`}
        aria-pressed={isSel}
        data-sfx="card-flip"
        disabled={taken !== null}
        onClick={() => setSel(side)}
        aria-label={UI.levelUp.cardLabel(cardTitle(c))}
      >
        <RouteCardFace card={c} preview={preview} owned={before.perks} />
        {taken !== null ? <span className={`${css.stamp} ${taken === side ? css.stampTaken : ""}`}>{taken === side ? UI.levelUp.taken : UI.levelUp.notTaken}</span> : null}
      </button>
    );
  };

  return (
    <div className={`${common.screen} ${css.screen}`}>
      <main className={css.main}>
        <Panel tone="dark" flush className={css.hero}>
          <ActorStage look={before.look} held={held} clip="power-up" restMs={700} height={short ? 124 : 170} floorAt={0.92} window={{ w: 300, h: 140 }} label={offer.rec.name} />
          <span className={css.rays} aria-hidden="true" />
          <div className={css.heroText}>
            <span className={css.slam}><Sticker tone="hazard" size="big" tilt={-2}>{UI.levelUp.heading(level)}</Sticker></span>
            <Sticker size="small" tilt={1.5}>{offer.rec.name}</Sticker>
          </div>
        </Panel>
        <div className={css.statsRow} aria-label={UI.kit.statsTitle}>
          {chips.map((c) => {
            const value = c.changed ? <b>{c.from}<span className={css.chipArrow} aria-hidden="true">{"→"}</span>{c.to}</b> : <b>{c.to}</b>;
            const moved = c.changed ? chipState : "";
            if (c.key === "maxHp") {
              return <span key={c.key} className={`${css.statChip} ${css.hpChip} ${moved}`} aria-label={`${UI.maxHp} ${c.changed ? UI.levelUp.fromTo(c.from, c.to) : c.to}`}>{value}<span className={css.chipName} aria-hidden="true">{UI.maxHp}</span></span>;
            }
            return (
              <span key={c.key} className={`${css.statChip} ${moved}`} aria-label={`${STAT_NAME[c.key]} ${c.changed ? UI.levelUp.fromTo(c.from, c.to) : c.to}`}>
                <span className={css.chipTop}><StatIconDot stat={c.key} size={20} />{value}</span>
                <span className={css.chipName} aria-hidden="true">{STAT_NAME[c.key]}</span>
              </span>
            );
          })}
        </div>
        <h1 className={css.pick}>{taken ? (taken === "L" ? cardTitle(offer.left) : cardTitle(offer.right)) : UI.levelUp.pick}</h1>
        <div className={css.cards}>
          {card("L", offer.left)}
          {card("R", offer.right)}
        </div>
        <div className={css.actions}>
          {taken === null ? (
            <Button variant="primary" disabled={!sel || busy} onClick={() => void take()}>{UI.levelUp.takeIt}</Button>
          ) : moreWaiting ? (
            <Button variant="primary" onClick={next}>{UI.levelUp.nextLevelUp}</Button>
          ) : (
            <Button variant="primary" onClick={() => go({ name: "locker" })}>{UI.levelUp.toLocker}</Button>
          )}
        </div>
      </main>
    </div>
  );
}
