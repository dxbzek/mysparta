/**
 * The roster: up to three hunters, one card each.
 *
 * A single champion only ever meets a fraction of the Rift — roughly 9 of 24
 * weapons and 7 of 30 skills by level 50 — so the Codex stays three-quarters
 * grey for them forever. A second hunter is how the rest of the game gets
 * seen, and it is the reason to open the app on the day your first is capped.
 */
import { useState } from "react";
import { PixIcon } from "../pixelIcons.js";
import { FighterBust } from "../fighters.js";
import { lookWithGear } from "../gear.js";
import { league } from "../ui.js";
import { ROSTER_MAX, type SlotSummary } from "../save.js";

export function Roster(props: {
  slots: Array<SlotSummary | null>;
  active: number;
  onPlay: (slot: number) => void;
  onNew: (slot: number) => void;
  onRetire: (slot: number) => void;
  onBack: () => void;
}) {
  const { slots, active } = props;
  // Retiring is two taps, like deleting a hunter — window.confirm is silently
  // blocked in sandboxed embeds, and this ends a fifty-day climb.
  const [armed, setArmed] = useState<number | null>(null);
  const filled = slots.filter(Boolean).length;

  return (
    <div className="arena">
      <div className="arena-head">
        <button className="btn ghost" onClick={props.onBack}>
          <PixIcon name="arrowLeft" size={11} /> Hall
        </button>
        <h2>Your Hunters</h2>
        <span className="pill">{filled}/{ROSTER_MAX}</span>
      </div>

      <p className="muted small note">
        Each hunter awakens from their own name and finds their own way through the Rift — no two
        see the same weapons. Every one keeps their own fights for the day.
      </p>

      <div className="rivals">
        {slots.map((s, i) =>
          s ? (
            <div className={`card rival${i === active ? " on" : ""}`} key={i}>
              <div className="rival-top">
                <FighterBust look={lookWithGear(s.look!, s.equipped)} size={64} />
                <div className="rival-id">
                  <span className="champ-name small">{s.name}</span>
                  <span className="muted small">
                    Level {s.level} ·{" "}
                    <span style={{ color: league(s.kleos).color }}>{league(s.kleos).name}</span>
                  </span>
                </div>
                {i === active && <span className="threat threat-easy">Playing</span>}
              </div>

              <div className="rival-kit">
                <span className="kit-chip">
                  <PixIcon name="star" size={11} className="icon-gold" /> {s.kleos}
                </span>
                <span className="kit-chip">
                  <PixIcon name="bolt" size={11} className="icon-gold" /> {s.vigor} fights
                </span>
              </div>

              <div className="rival-action">
                <button
                  className={`btn tiny${armed === i ? " danger" : " ghost"}`}
                  onClick={() => {
                    if (armed === i) {
                      props.onRetire(i);
                      setArmed(null);
                    } else setArmed(i);
                  }}
                >
                  {armed === i ? "Retire — tap again" : "Retire"}
                </button>
                <button
                  className="btn primary"
                  disabled={i === active}
                  onClick={() => props.onPlay(i)}
                >
                  {i === active ? "Playing" : "Play"}
                </button>
              </div>
            </div>
          ) : (
            <div className="card rival empty-slot" key={i}>
              <div className="rival-top">
                <span className="slot-frame" />
                <div className="rival-id">
                  <span className="champ-name small muted">Empty</span>
                  <span className="muted small">A name is all it takes</span>
                </div>
              </div>
              <div className="rival-action">
                <button className="btn primary" onClick={() => props.onNew(i)}>
                  <PixIcon name="swords" size={12} /> Awaken a hunter
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
