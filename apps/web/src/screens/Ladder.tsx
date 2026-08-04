import { useMemo } from "react";
import { PixIcon } from "../pixelIcons.js";
import { ladder, standing } from "../ladder.js";
import type { SaveV1 } from "../save.js";


/**
 * Standings for the realm. Every other name is generated from the realm seed,
 * so the table is stable — passing someone means you climbed, not that the
 * board reshuffled.
 */
export function Ladder({ save, onBack }: { save: SaveV1; onBack: () => void }) {
  const rows = useMemo(
    () => ladder(save.champion.displayName, save.champion.level, save.kleos),
    [save.champion.displayName, save.champion.level, save.kleos],
  );
  const me = standing(rows);
  return (
    <div className="arena">
      <div className="arena-head">
        <button className="btn ghost" onClick={onBack}>
          <PixIcon name="arrowLeft" size={11} /> Hall
        </button>
        <h2>The Ladder</h2>
        <span className="pill">
          #{me.rank} of {me.of}
        </span>
      </div>
      {me.ahead && (
        <p className="notice">
          <b>{me.ahead.name}</b> is {me.ahead.rating - save.kleos} rating ahead of you at #{me.rank - 1}.
          Beat someone stronger to take the place.
        </p>
      )}
      <ol className="ladder">
        {rows.map((r) => (
          <li key={r.name} className={`ladder-row ${r.you ? "you" : ""}`}>
            <span className="lrank">{r.rank}</span>
            <span className="lname">{r.name}</span>
            <span className="llevel muted small">Lv {r.level}</span>
            <span className="lrating">
              <PixIcon name="star" size={9} className="icon-gold" /> {r.rating}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
