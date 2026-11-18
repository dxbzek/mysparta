/**
 * B. Home: the Locker (brief 3.11 B). It wraps the fight-screen lane's `LockerView` and feeds it
 * from the save. It never shows a result or new XP before the bout has been watched or skipped:
 * every number comes from `shownRecord`. A bout left unwatched (a reload mid-bout) opens the
 * "Your last bout finished" sheet with Watch and Skip.
 */
import { useMemo, useState } from "react";
import type { HeldId, PerkId } from "@rankzero/core";
import { ENERGY_MAX, perkKind } from "@rankzero/core";
import { activeRecord } from "../../app/guards";
import { useDoc, useGame } from "../../app/context";
import { shownRecord, unwatchedOf } from "../../state/actions";
import { SLOT_LIMIT } from "../../state/schema";
import { resultLine } from "../../text/results";
import { LOCKER_WORDS, UI } from "../../text/ui";
import { Button } from "../../ui/Button";
import { LockerView, clockOf } from "../../ui/LockerView";
import { useTick } from "../parts/EnergyMeter";
import type { LockerPrimary, LockerTab } from "../../ui/LockerView";
import { Portrait } from "../../ui/Portrait";
import { Sheet } from "../../ui/Sheet";
import { PerkDetail } from "../parts/Perk";
import css from "./Locker.module.css";

export function tabRoute(tab: LockerTab) {
  switch (tab) {
    case "kit": return { name: "kit", tab: "kit" } as const;
    case "inventory": return { name: "inventory" } as const;
    case "history": return { name: "bouts" } as const;
    default: return { name: "locker" } as const;
  }
}

export function LockerScreen() {
  const { core, clock, go, actions, toast } = useGame();
  const doc = useDoc();
  const [perk, setPerk] = useState<PerkId | null>(null);
  const rec = activeRecord(doc);
  const shownRec = rec ? shownRecord(doc, rec) : null;
  // Energy: a one-second tick while a point is on its way, none while the bar is full.
  const now = useTick(clock, shownRec !== null && core.energyNextMs(shownRec, clock.now()) !== null);
  const energy = shownRec ? { value: core.energyNow(shownRec, now), max: ENERGY_MAX, nextMs: core.energyNextMs(shownRec, now) } : null;
  const view = useMemo(() => {
    if (!rec) return null;
    const shown = shownRecord(doc, rec);
    const sheet = core.sheetOf(shown);
    // (what it takes into a bout: the loadout's first weapon, its pets, shield and gear)
    const held = (sheet.loadout.weapons[0] ?? null) as HeldId | null;
    const companions = sheet.loadout.pets;
    const bouts = doc.history.filter((b) => b.fighterId === rec.id && b.watched).slice(0, 3).map((b) => {
      const won = b.result.winner === "a";
      return { id: b.id, won, opponent: b.snapshotB.name, line: resultLine(b.lineId, won, b.snapshotA.name, b.snapshotB.name), xp: b.xp };
    });
    const stats = sheet.effective;
    return { sheet, held, companions, bouts, stats, statScale: Math.max(10, ...Object.values(stats)) };
  }, [doc, rec, core]);
  if (!rec || !view || !energy) return null;
  const primary: LockerPrimary = view.sheet.levelUpWaiting ? { kind: "levelup" }
    : energy.value > 0 ? { kind: "fight", energy: energy.value } : { kind: "done", backIn: clockOf(energy.nextMs ?? 0) };
  const pending = unwatchedOf(doc);
  const skip = (): void => {
    if (pending) void actions.markWatched(pending.id).catch((e: Error) => toast(e.message));
  };
  const roster = doc.fighters.map((f) => ({ id: f.id, name: f.name, look: core.rollLook(f.seed, f.lookSalt, f.colourSalt) }));

  return (
    <>
      {/* display: contents; it only carries the energy styles (XP fill flash, the Level up! ring)
          onto the fight-screen lane's view through stable ARIA hooks, without editing the view. */}
      <div className={css.home} data-primary={primary.kind}>
      <LockerView
        roster={roster}
        activeId={rec.id}
        canAdd={doc.fighters.length < SLOT_LIMIT}
        name={rec.name}
        level={view.sheet.level}
        look={view.sheet.look}
        held={view.held}
        companions={view.companions}
        shield={view.sheet.loadout.shield}
        gear={view.sheet.loadout.gear}
        xp={view.sheet.xp}
        xpToNext={view.sheet.xpToNext}
        maxHp={view.sheet.maxHp}
        stats={view.stats}
        statScale={view.statScale}
        primary={primary}
        energy={energy}
        kit={view.sheet.perks}
        bouts={view.bouts}
        tab="home"
        text={LOCKER_WORDS}
        onSelect={(id) => void actions.select(id).catch((e: Error) => toast(e.message))}
        onAdd={() => go({ name: "create" })}
        onSettings={() => go({ name: "settings" })}
        onPrimary={() => go(primary.kind === "levelup" ? { name: "levelup" } : { name: "card" })}
        onKitItem={(id) => setPerk(id)}
        onSeeAllKit={() => go({ name: "kit", tab: "kit" })}
        onReplay={(id) => go({ name: "replay", id })}
        onAllBouts={() => go({ name: "bouts" })}
        onTab={(t) => go(tabRoute(t))}
      />
      </div>
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
