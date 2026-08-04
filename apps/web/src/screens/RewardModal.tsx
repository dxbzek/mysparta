/** What the Rift rolled for this level, announced and claimed. */
import { useEffect, useRef } from "react";
import { beast, describeOffer, skill, weapon, type FateOffer } from "@agoge/core";
import { PetSprite } from "../pixelPets.js";
import { WeaponIcon } from "../weaponIcons.js";
import { SkillIcon, type SkillKind } from "../skillIcons.js";
import { PixIcon } from "../pixelIcons.js";
import { gearStatLine, type GearItem } from "../gear.js";
import { sound } from "../sound.js";


export function RewardModal(props: {
  level: number;
  offer: FateOffer;
  drop?: GearItem;
  onClaim: () => void;
}) {
  const { offer, drop } = props;
  const claimRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    sound.levelUp();
    // A modal that announces itself as one should also take the focus, or a
    // keyboard player is left tabbing the Hall behind it looking for Claim.
    claimRef.current?.focus();
  }, []);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Level up">
      <div className="draft card">
        <h2>Level {props.level}!</h2>
        <p className="muted">The Rift decides what you find — no choices, no rerolls.</p>
        <div className="fate-row">
          <div className="fate-card rolled">
            <span className="fate-kind">
              {offer.kind.startsWith("stat") ? "Stats" : offer.kind === "weapon" ? "New weapon" : offer.kind === "skill" ? "New skill" : "New pet"}
            </span>
            <OfferArt offer={offer} />
            <b>{describeOffer(offer)}</b>
            <span className="fate-detail">{offerDetail(offer)}</span>
          </div>
          {drop && (
            <div className="fate-card rolled gear-card">
              <span className="fate-kind">
                <PixIcon name="loot" size={11} /> Gear drop — {drop.slot}
              </span>
              <b>{drop.name}</b>
              {/* what it is worth, not just what it is called */}
              {gearStatLine(drop) && <span className="fate-stats">{gearStatLine(drop)}</span>}
              <span className="fate-detail">{drop.flavour}</span>
            </div>
          )}
        </div>
        <button className="btn primary big" ref={claimRef} onClick={props.onClaim}>
          Claim
        </button>
      </div>
    </div>
  );
}

/** A level-up reward should be a thing you can see, not just a line of text. */
function OfferArt({ offer }: { offer: FateOffer }) {
  if (offer.kind === "skill")
    return <SkillIcon id={offer.skill} kind={skill(offer.skill).kind as SkillKind} size={62} />;
  if (offer.kind === "weapon")
    return (
      <span className="offer-art rack-tile">
        <WeaponIcon d={offer.weapon} size={48} />
      </span>
    );
  if (offer.kind === "beast")
    return (
      <span className="offer-art pet-tile">
        <PetSprite beastId={offer.beast} size={56} />
      </span>
    );
  return (
    <span className="offer-art stat-tile">
      <PixIcon name="star" size={34} />
    </span>
  );
}

function offerDetail(o: FateOffer): string {
  if (o.kind === "weapon") return weapon(o.weapon).flavour;
  if (o.kind === "skill") return skill(o.skill).text;
  if (o.kind === "beast") return `${beast(o.beast).flavour} Costs ${beast(o.beast).gritTax} Endurance while it fights for you.`;
  return "Reliable. Permanent. Yours.";
}

