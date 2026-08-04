/**
 * The small shared pieces: chrome that more than one screen draws, plus the
 * two lookup tables that name a rating and a weapon family in player words.
 */
import { useMemo } from "react";
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

