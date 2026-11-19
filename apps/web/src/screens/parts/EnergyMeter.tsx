/**
 * The energy bar fed from a record and the injected clock (content v3). It ticks once a second
 * while a point is on its way and not at all when the bar is full, so the countdown moves without
 * re-rendering the screen around it.
 */
import { useEffect, useState } from "react";
import type { ScrapperRecord } from "@rankzero/core";
import { ENERGY_MAX } from "@rankzero/core";
import { useGame } from "../../app/context";
import { UI } from "../../text/ui";
import { EnergyBar } from "../../ui/EnergyBar";

/** The clock's time, re-read every `everyMs` while `on`. */
export function useTick(clock: { now(): number }, on: boolean, everyMs = 1000): number {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    setNow(clock.now());
    if (!on) return;
    const id = window.setInterval(() => setNow(clock.now()), everyMs);
    return () => window.clearInterval(id);
  }, [clock, on, everyMs]);
  return now;
}

export function energyOf(core: ReturnType<typeof useGame>["core"], rec: ScrapperRecord, now: number): { value: number; max: number; nextMs: number | null } {
  return { value: core.energyNow(rec, now), max: ENERGY_MAX, nextMs: core.energyNextMs(rec, now) };
}

export function EnergyMeter({ rec, compact = false, tone }: { rec: ScrapperRecord; compact?: boolean; tone?: "paper" | "dark" }) {
  const { core, clock } = useGame();
  const full = core.energyNextMs(rec, clock.now()) === null;
  const now = useTick(clock, !full);
  const e = energyOf(core, rec, now);
  return <EnergyBar value={e.value} max={e.max} nextMs={e.nextMs} compact={compact} tone={tone} label={UI.energy.label}
    text={{ full: UI.energy.full, next: UI.energy.next }} />;
}
