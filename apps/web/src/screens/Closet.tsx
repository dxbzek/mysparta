/**
 * The closet: everything you own, worn on your own hunter before you commit.
 *
 * This was a card in the Hall, which meant 46 items across five slots had to
 * fit beside the champion, the stats, the rack and the standings. It never
 * could — so the gear was a strip of 62px chips you scrubbed sideways. Here it
 * has the page: a slot rail, big previews, and the stat change against what
 * you are wearing right now, which is the one number that decides it.
 */
import { useState } from "react";
import { GearIcon } from "../gearArt.js";
import { PixIcon } from "../pixelIcons.js";
import { FighterBust, lookFor } from "../fighters.js";
import {
  gearDetail,
  gearItem,
  gearPool,
  gearStatLine,
  lookWithGear,
  type GearItem,
  type GearSlot,
} from "../gear.js";
import type { SaveV1 } from "../save.js";
import { TabPanel, TabRail } from "../ui.js";

const SLOTS: Array<{ id: GearSlot; label: string }> = [
  { id: "body", label: "Armor" },
  { id: "helm", label: "Helm" },
  { id: "cloak", label: "Cloak" },
  { id: "trinket", label: "Trinket" },
  { id: "title", label: "Title" },
];

export function Closet(props: {
  save: SaveV1;
  onBack: () => void;
  onEquip: (slot: GearSlot, id: string | undefined) => void;
}) {
  const { save } = props;
  const baseLook = save.look ?? lookFor(save.champion.displayName);
  const owned = (save.gear ?? []).map((id) => gearItem(id)).filter((g): g is GearItem => !!g);
  const [slot, setSlot] = useState<GearSlot>(SLOTS[0]!.id);
  const items = owned.filter((g) => g.slot === slot);
  const wornId = save.equipped?.[slot];

  return (
    <div className="closet">
      <div className="arena-head">
        <button className="btn ghost" onClick={props.onBack}>
          <PixIcon name="arrowLeft" size={11} /> Hall
        </button>
        <h2>The Closet</h2>
        <span className="muted small">
          {owned.length}/{gearPool().length} found
        </span>
      </div>

      {owned.length === 0 ? (
        <p className="notice">
          Nothing yet. Gear drops from the Rift alongside your level-ups — every piece you find
          stays yours, and you can wear any of it, any time.
        </p>
      ) : (
        <>
          {/* which shelf you are looking at */}
          <TabRail
            id="closet"
            label="Gear slot"
            value={slot}
            onPick={setSlot}
            tabs={SLOTS.map((s) => ({
              id: s.id,
              label: (
                <>
                  {s.label}{" "}
                  <span className="muted small">{owned.filter((g) => g.slot === s.id).length}</span>
                </>
              ),
            }))}
          />

          <TabPanel id="closet" label={SLOTS.find((s) => s.id === slot)!.label}>
          <div className="closet-grid">
            {items.length === 0 && (
              <p className="muted small note">Nothing found for this slot yet.</p>
            )}
            {items.map((g) => {
              const worn = wornId === g.id;
              return (
                <button
                  key={g.id}
                  className={`card closet-card${worn ? " worn" : ""}`}
                  onClick={() => props.onEquip(slot, worn ? undefined : g.id)}
                  aria-pressed={worn}
                >
                  <span className="closet-art">
                    <GearIcon id={g.id} slot={slot} size={48} />
                  </span>
                  <span className="closet-body">
                    <b>{g.name}</b>
                    <span className="gear-stat">{gearStatLine(g) || gearDetail(g)}</span>
                    <em className="muted small">{g.flavour}</em>
                  </span>
                  <span className={`closet-state${worn ? " on" : ""}`}>{worn ? "Worn" : "Wear"}</span>
                </button>
              );
            })}
          </div>
          </TabPanel>
        </>
      )}
    </div>
  );
}
