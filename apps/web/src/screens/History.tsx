/** The Tapestry: every level-up the Rift rolled, in order. */
import { describeOffer, type Champion } from "@agoge/core";
import { PixIcon } from "../pixelIcons.js";


export function History({ champion, onBack }: { champion: Champion; onBack: () => void }) {
  return (
    <div className="tapestry">
      <div className="arena-head">
        <button className="btn ghost" onClick={onBack}><PixIcon name="arrowLeft" size={11} /> Hall</button>
        <h2>Level-Up History</h2>
        <span />
      </div>
      <p className="muted">
        Everything the Rift has rolled for {champion.displayName} — what landed is highlighted, what the fates passed over is struck through.
      </p>
      {champion.tapestry.length === 0 && <p className="muted">Nothing yet — win fights to level up.</p>}
      <ol className="bands">
        {[...champion.tapestry].reverse().map((band, i) => (
          <li key={i} className="card band">
            <span className="pill">Lv {band.level}</span>
            {band.offers.map((o, j) => (
              <span key={j} className={`thread ${j === band.picked ? "kept" : ""}`}>
                {describeOffer(o)}
              </span>
            ))}
            {band.rerolled && <span className="muted small">(rerolled)</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

