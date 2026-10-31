/**
 * The small shared pieces: chrome that more than one screen draws, plus the
 * two lookup tables that name a rating and a weapon family in player words.
 */
import { useMemo } from "react";
import { weapon } from "@agoge/core";
import { PixIcon } from "./pixelIcons.js";
import { ladder, standing } from "./ladder.js";
import type { SaveV1 } from "./save.js";

/** League tiers give the rating number meaning (03-gdd-systems.md §1.4). */
export function league(kleos: number): { name: string; color: string } {
  // Tiers sit in the parchment palette — imported neon reads as a different app.
  if (kleos >= 1950) return { name: "S-Rank", color: "#e39a2e" };
  if (kleos >= 1850) return { name: "A-Rank", color: "#d95f43" };
  if (kleos >= 1750) return { name: "B-Rank", color: "#8a6bb5" };
  if (kleos >= 1650) return { name: "C-Rank", color: "#3f83c6" };
  if (kleos >= 1550) return { name: "D-Rank", color: "#6f9a3e" };
  return { name: "E-Rank", color: "#9a8c74" };
}

/**
 * The tab rail, once.
 *
 * Three screens had grown their own — Forge, Codex, Closet — each with
 * `role="tab"` and `aria-selected` and none of the rest of the contract.
 * `role="tab"` promises a keyboard a great deal: arrow keys between the tabs,
 * Home/End to the ends, exactly one tab in the page's tab order, and a panel
 * that says which tab owns it. A rail that promises that and does none of it
 * is worse for a screen reader than a row of plain buttons.
 */
export function TabRail<T extends string>({
  id,
  label,
  tabs,
  value,
  onPick,
}: {
  /** Prefix for the generated tab/panel ids — must be unique per screen. */
  id: string;
  label: string;
  tabs: Array<{ id: T; label: React.ReactNode }>;
  value: T;
  onPick: (id: T) => void;
}) {
  const at = Math.max(0, tabs.findIndex((t) => t.id === value));
  const move = (to: number) => {
    const next = tabs[(to + tabs.length) % tabs.length]!;
    onPick(next.id);
    // Follow the selection with focus, the way a tablist is expected to.
    document.getElementById(`${id}-tab-${next.id}`)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          id={`${id}-tab-${t.id}`}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          aria-controls={`${id}-panel`}
          // roving tabindex: one stop for the whole rail, arrows do the rest
          tabIndex={value === t.id ? 0 : -1}
          className={`tab${value === t.id ? " on" : ""}`}
          onClick={() => onPick(t.id)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") move(i + 1);
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(i - 1);
            else if (e.key === "Home") move(0);
            else if (e.key === "End") move(tabs.length - 1);
            else return;
            e.preventDefault();
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** The panel a TabRail points at. */
export function TabPanel({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div id={`${id}-panel`} role="tabpanel" aria-label={label} tabIndex={-1}>
      {children}
    </div>
  );
}

export const DISCIPLINE_NAME: Record<string, string> = {
  xiphos: "Blade",
  doru: "Spear",
  labrys: "Axe",
  cestus: "Fist",
  akontia: "Thrown",
  aspis: "Shield",
};

/** The five names above your own, so the Hall shows the climb in progress. */
export function StandingsStrip({ save }: { save: SaveV1 }) {
  const rows = useMemo(
    () => ladder(save.champion.displayName, save.champion.level, save.kleos),
    [save.champion.displayName, save.champion.level, save.kleos],
  );
  const me = standing(rows);
  const near = rows.slice(Math.max(0, me.rank - 3), me.rank + 2);
  return (
    <section className="card standings">
      <h3>
        Standings <span className="muted small">you are #{me.rank} of {me.of}</span>
      </h3>
      <ol className="ladder tight">
        {near.map((r) => (
          <li key={r.name} className={`ladder-row ${r.you ? "you" : ""}`}>
            <span className="lrank">{r.rank}</span>
            <span className="lname">{r.name}</span>
            <span className="lrating">
              <PixIcon name="star" size={9} className="icon-gold" /> {r.rating}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}


/**
 * A weapon's character at a glance: how hard it hits, how often, how far it
 * reaches. Bars beat "dmg 10 · steady" because two weapons can be compared
 * without doing arithmetic. Lives here because both the Hall rack and the
 * level-up reward card draw it.
 */
export function WeaponBars({ w }: { w: ReturnType<typeof weapon> }) {
  if (w.discipline === "aspis") {
    return <div className="muted small">Raised to turn blows aside — never swung.</div>;
  }
  // 900ms is about the slowest swing in the game; invert so faster reads fuller
  const speed = Math.max(6, Math.min(100, ((450 - w.interval) / 270) * 100));
  const rows: Array<[string, number]> = [
    ["Damage", Math.min(100, (w.dmg / 22) * 100)],
    ["Speed", speed],
    ["Reach", Math.min(100, ((w.reach + 1) / 4) * 100)],
  ];
  return (
    <div className="wbars">
      {rows.map(([label, pct]) => (
        <div className="wbar-row" key={label}>
          <span>{label}</span>
          <span className="statbar"><i style={{ width: `${pct}%` }} /></span>
        </div>
      ))}
    </div>
  );
}
