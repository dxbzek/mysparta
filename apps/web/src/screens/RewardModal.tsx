/** What the Rift rolled for this level, announced and claimed. */
import { useEffect, useRef } from "react";
import { beast, describeOffer, skill, weapon, type FateOffer } from "@agoge/core";
import { PetSprite } from "../pixelPets.js";
import { WeaponIcon } from "../weaponIcons.js";
import { SkillIcon, type SkillKind } from "../skillIcons.js";
import { PixIcon } from "../pixelIcons.js";
import { gearStatLine, type GearItem } from "../gear.js";
import { WeaponBars } from "../ui.js";
import { sound } from "../sound.js";


export function RewardModal(props: {
  level: number;
  offer: FateOffer;
  drop?: GearItem;
  /** Favour available to spend on a reroll (0 = button hidden). */
  favour: number;
  /** This offer is already a reroll — redraws are final. */
  rerolled: boolean;
  onReroll: () => void;
  onClaim: () => void;
}) {
  const { offer, drop } = props;
  const claimRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sound.levelUp();
    // A modal that announces itself as one should also take the focus, or a
    // keyboard player is left tabbing the Hall behind it looking for Claim.
    claimRef.current?.focus();
  }, []);
  // aria-modal promised the background was inert while Tab walked straight
  // into it — the worst combination for a screen-reader user. Trap the focus
  // and let Escape claim (claiming is mandatory and non-destructive).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onClaim();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = boxRef.current?.querySelectorAll<HTMLElement>("button, textarea, [tabindex]");
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  const canReroll = props.favour > 0 && !props.rerolled;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Level up" onKeyDown={onKeyDown}>
      <div className="draft card" ref={boxRef}>
        <h2>Level {props.level}!</h2>
        <p className="muted">
          {props.rerolled
            ? "The Rift has spoken twice — this one is final."
            : canReroll
              ? "The Rift decides what you find — but Favour can ask it to roll again."
              : "The Rift decides what you find — no choices, no rerolls."}
        </p>
        <div className="fate-row">
          <div className="fate-card rolled">
            <span className="fate-kind">
              {offer.kind.startsWith("stat") ? "Stats" : offer.kind === "weapon" ? "New weapon" : offer.kind === "skill" ? "New skill" : "New pet"}
            </span>
            <OfferArt offer={offer} />
            <b>{describeOffer(offer)}</b>
            {offer.kind === "weapon" && <WeaponBars w={weapon(offer.weapon)} />}
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
        <div className="draft-actions">
          {canReroll && (
            <button className="btn ghost" onClick={props.onReroll}>
              <PixIcon name="dice" size={12} /> Reroll — 1 Favour ({props.favour} left)
            </button>
          )}
          <button className="btn primary big" ref={claimRef} onClick={props.onClaim}>
            Claim
          </button>
        </div>
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

