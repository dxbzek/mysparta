/**
 * B. Home: the Locker (brief 3.11 B). It wraps the fight-screen lane's `LockerView` and feeds it
 * from the save. It never shows a result or new XP before the bout has been watched or skipped:
 * every number comes from `shownRecord`. A bout left unwatched (a reload mid-bout) opens the
 * "Your last bout finished" sheet with Watch and Skip.
 */
import { useEffect, useMemo, useState } from "react";
import type { HeldId, PerkId } from "@rankzero/core";
import { perkKind } from "@rankzero/core";
import { activeRecord } from "../../app/guards";
import { useDoc, useGame } from "../../app/context";
import { shownRecord, unwatchedOf } from "../../state/actions";
import { countdown, msToMidnight } from "../../state/day";
import { SLOT_LIMIT } from "../../state/schema";
import { resultLine } from "../../text/results";
import { LOCKER_WORDS, UI } from "../../text/ui";
import { Button } from "../../ui/Button";
import { LockerView } from "../../ui/LockerView";
import type { LockerPrimary, LockerTab } from "../../ui/LockerView";
import { Portrait } from "../../ui/Portrait";
import { Sheet } from "../../ui/Sheet";
import { PerkDetail } from "../parts/Perk";
import css from "./Locker.module.css";

export function tabRoute(tab: LockerTab) {
  return tab === "kit" ? ({ name: "kit", tab: "kit" } as const) : tab === "history" ? ({ name: "bouts" } as const) : ({ name: "locker" } as const);
}

function useMinuteTick(clock: { now(): number }): number {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(clock.now()), 30_000);
    return () => window.clearInterval(id);
  }, [clock]);
  return now;
}

export function LockerScreen() {
  const { core, clock, go, actions, toast } = useGame();
  const doc = useDoc();
  const now = useMinuteTick(clock);
  const [perk, setPerk] = useState<PerkId | null>(null);
  const rec = activeRecord(doc);
  const view = useMemo(() => {
    if (!rec) return null;
    const shown = shownRecord(doc, rec);
    const sheet = core.sheetOf(shown);
    const left = core.boutsLeft(shown, clock.today());
    const primary: LockerPrimary = sheet.levelUpWaiting ? { kind: "levelup" }
      : left > 0 ? { kind: "fight", boutsLeft: left } : { kind: "done", backIn: countdown(msToMidnight(now)) };
    const held = (sheet.perks.find((p) => perkKind(p) === "weapon") ?? null) as HeldId | null;
    const companions = sheet.perks.filter((p) => perkKind(p) === "companion") as ("raccoon" | "goose" | "boar")[];
    const bouts = doc.history.filter((b) => b.fighterId === rec.id && b.watched).slice(0, 3).map((b) => {
      const won = b.result.winner === "a";
      return { id: b.id, won, opponent: b.snapshotB.name, line: resultLine(b.lineId, won, b.snapshotA.name, b.snapshotB.name), xp: b.xp };
    });
    const { strength, agility, speed } = sheet.effective;
    return { sheet, primary, held, companions, bouts, stats: { strength, agility, speed }, statScale: Math.max(10, strength, agility, speed) };
  }, [doc, rec, core, clock, now]);
  if (!rec || !view) return null;
  const pending = unwatchedOf(doc);
  const skip = (): void => {
    if (pending) void actions.markWatched(pending.id).catch((e: Error) => toast(e.message));
  };
  const roster = doc.fighters.map((f) => ({ id: f.id, name: f.name, look: core.rollLook(f.seed, f.lookSalt, f.colourSalt) }));

  return (
    <>
      <LockerView
        roster={roster}
        activeId={rec.id}
        canAdd={doc.fighters.length < SLOT_LIMIT}
        name={rec.name}
        level={view.sheet.level}
        look={view.sheet.look}
        held={view.held}
        companions={view.companions}
        xp={view.sheet.xp}
        xpToNext={view.sheet.xpToNext}
        maxHp={view.sheet.maxHp}
        stats={view.stats}
        statScale={view.statScale}
        primary={view.primary}
        kit={view.sheet.perks}
        bouts={view.bouts}
        tab="home"
        text={LOCKER_WORDS}
        onSelect={(id) => void actions.select(id).catch((e: Error) => toast(e.message))}
        onAdd={() => go({ name: "create" })}
        onSettings={() => go({ name: "settings" })}
        onPrimary={() => go(view.primary.kind === "levelup" ? { name: "levelup" } : { name: "card" })}
        onKitItem={(id) => setPerk(id)}
        onSeeAllKit={() => go({ name: "kit", tab: "kit" })}
        onReplay={(id) => go({ name: "replay", id })}
        onAllBouts={() => go({ name: "bouts" })}
        onTab={(t) => go(tabRoute(t))}
      />
      <Sheet open={perk !== null} title={UI.locker.perkSheet} onClose={() => setPerk(null)}>
        {perk ? <PerkDetail id={perk} owned={view.sheet.perks} /> : null}
        <div className={css.sheetFoot}>
          <Button onClick={() => go({ name: "kit", tab: "kit" })}>{UI.locker.seeKit}</Button>
        </div>
      </Sheet>
      <Sheet open={pending !== undefined} title={UI.locker.lastBoutTitle} onClose={skip} closeLabel={UI.locker.skip}>
        {pending ? (
          <div className={css.pending}>
            <div className={css.pendingFaces}>
              <Portrait look={pending.snapshotA.look} size={64} label={pending.snapshotA.name} />
              <span className={css.vs}>{UI.card.vs}</span>
              <Portrait look={pending.snapshotB.look} size={64} label={pending.snapshotB.name} />
            </div>
            <p className={css.pendingLine}>{UI.locker.lastBoutLine(pending.snapshotA.name, pending.snapshotB.name)}</p>
            <Button variant="primary" onClick={() => go({ name: "bout", id: pending.id })}>{UI.locker.watch}</Button>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
