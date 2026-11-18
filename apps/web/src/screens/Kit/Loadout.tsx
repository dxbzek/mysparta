/**
 * The loadout and gear tabs of the Kit (content v3, batch 2, plan 13.12).
 *   Bag   which owned weapons go in the bag (up to 5, at least 1 when any is owned), which shield is
 *         carried (or none), which pets come along. The draw order in a bout stays random.
 *   Gear  one piece of body equipment per slot (head, body, hands, legs, feet), or nothing.
 * A live preview draws the fighter as it will walk out, gear and shield on, with its pets. Every
 * change is stored at once (`actions.setLoadout`), cleaned by the core against what is owned.
 */
import { useMemo } from "react";
import { GEAR_META, GEAR_SLOTS, MAX_LOADOUT_WEAPONS, isCompanionId, isGearId, isShieldId, isWeaponId } from "@rankzero/core";
import type { CompanionId, GearId, GearSlot, Loadout, PerkId, ScrapperRecord, ShieldId, WeaponId } from "@rankzero/core";
import { useGame } from "../../app/context";
import { NAMES } from "../../text/names";
import { perkText } from "../../text/perks";
import { UI } from "../../text/ui";
import { ActorStage } from "../../ui/ActorStage";
import { PerkIcon } from "../../ui/PerkIcon";
import css from "./Loadout.module.css";

function useLoadout(rec: ScrapperRecord): { owned: PerkId[]; l: Loadout; maxHp: number; set(next: Loadout): void } {
  const { core, actions, toast } = useGame();
  const sheet = useMemo(() => core.sheetOf(rec), [core, rec]);
  const set = (next: Loadout): void => {
    actions.setLoadout(rec.id, next).catch((e: Error) => toast(e.message));
  };
  return { owned: sheet.perks, l: sheet.loadout, maxHp: sheet.maxHp, set };
}

function Preview({ rec, l }: { rec: ScrapperRecord; l: Loadout }) {
  const { core } = useGame();
  const look = core.rollLook(rec.seed, rec.lookSalt, rec.colourSalt);
  return (
    <ActorStage className={css.preview} height={210} label={UI.loadout.preview(rec.name)} look={look} held={l.weapons[0] ?? null}
      shield={l.shield} gear={l.gear} companions={l.pets} window={{ w: 220, h: 150 }} floorAt={0.86} />
  );
}

function Tile({ id, on, onClick, note }: { id: PerkId; on: boolean; onClick(): void; note?: string }) {
  const t = perkText(id);
  return (
    <button type="button" className={`${css.tile} ${on ? css.on : ""}`} aria-pressed={on} aria-label={UI.loadout.toggle(NAMES[id], on)} onClick={onClick}>
      <PerkIcon id={id} size={44} rarity />
      <span className={css.tileText}>
        <span className={css.tileName}>{NAMES[id]}</span>
        <span className={css.tileLine}>{note ?? t.effect}</span>
        {t.costs.length > 0 ? <span className={css.tileCost}>{t.costs.join(". ")}</span> : null}
      </span>
      <span className={css.mark} aria-hidden="true">{on ? UI.loadout.inBag : UI.loadout.atHome}</span>
    </button>
  );
}

export function LoadoutTabView({ rec }: { rec: ScrapperRecord }) {
  const { toast } = useGame();
  const { owned, l, maxHp, set } = useLoadout(rec);
  const weapons = owned.filter((p): p is WeaponId => isWeaponId(p));
  const shields = owned.filter((p): p is ShieldId => isShieldId(p));
  const pets = owned.map((p, i) => ({ p, i })).filter((x): x is { p: CompanionId; i: number } => isCompanionId(x.p));
  const toggleWeapon = (w: WeaponId): void => {
    if (l.weapons.includes(w)) {
      if (l.weapons.length <= 1) { toast(UI.loadout.bagLast); return; }
      set({ ...l, weapons: l.weapons.filter((x) => x !== w) });
    } else {
      if (l.weapons.length >= MAX_LOADOUT_WEAPONS) { toast(UI.loadout.bagFull(MAX_LOADOUT_WEAPONS)); return; }
      set({ ...l, weapons: weapons.filter((x) => x === w || l.weapons.includes(x)) });
    }
  };
  // a pet tile per owned pet (two Raccoons are two tiles): the k-th of its kind is in while the
  // loadout names that kind more than k times
  const petOn = (p: CompanionId, i: number): boolean => owned.slice(0, i).filter((x) => x === p).length < l.pets.filter((x) => x === p).length;
  const togglePet = (p: CompanionId, i: number): void => {
    const on = petOn(p, i);
    const at = l.pets.lastIndexOf(p);
    set({ ...l, pets: on ? l.pets.filter((_, k) => k !== at) : [...l.pets, p] });
  };
  return (
    <div className={css.wrap}>
      <section className={css.stage}>
        <Preview rec={rec} l={l} />
        <span className={css.hp}>{UI.loadout.maxHp(maxHp)}</span>
      </section>
      <section aria-label={UI.loadout.bagTitle}>
        <h2 className={css.title}>{UI.loadout.bagTitle} <span className={css.count}>{l.weapons.length}/{Math.min(MAX_LOADOUT_WEAPONS, Math.max(1, weapons.length))}</span></h2>
        <p className={css.sub}>{UI.loadout.bagSub(l.weapons.length, MAX_LOADOUT_WEAPONS)}</p>
        {weapons.length === 0 ? <p className={css.empty}>{UI.loadout.noWeapons}</p> : (
          <div className={css.list}>{weapons.map((w) => <Tile key={w} id={w} on={l.weapons.includes(w)} onClick={() => toggleWeapon(w)} />)}</div>
        )}
      </section>
      <section aria-label={UI.loadout.shieldTitle}>
        <h2 className={css.title}>{UI.loadout.shieldTitle}</h2>
        {shields.length === 0 ? <p className={css.empty}>{UI.loadout.noShieldOwned}</p> : (
          <div className={css.list}>
            {shields.map((s) => <Tile key={s} id={s} on={l.shield === s} onClick={() => set({ ...l, shield: l.shield === s ? null : s })} />)}
          </div>
        )}
      </section>
      <section aria-label={UI.loadout.petsTitle}>
        <h2 className={css.title}>{UI.loadout.petsTitle} <span className={css.count}>{l.pets.length}/{pets.length}</span></h2>
        <p className={css.sub}>{UI.loadout.petsSub}</p>
        {pets.length === 0 ? <p className={css.empty}>{UI.loadout.noPets}</p> : (
          <div className={css.list}>{pets.map(({ p, i }) => <Tile key={`${p}${i}`} id={p} on={petOn(p, i)} onClick={() => togglePet(p, i)} />)}</div>
        )}
      </section>
    </div>
  );
}

export function GearTabView({ rec }: { rec: ScrapperRecord }) {
  const { owned, l, set } = useLoadout(rec);
  const gear = owned.filter((p): p is GearId => isGearId(p));
  const wear = (slot: GearSlot, g: GearId | null): void => {
    const next = { ...l.gear };
    if (g === null) delete next[slot];
    else next[slot] = g;
    set({ ...l, gear: next });
  };
  return (
    <div className={css.wrap}>
      <section className={css.stage}>
        <Preview rec={rec} l={l} />
      </section>
      <p className={css.sub}>{UI.loadout.gearSub}</p>
      {GEAR_SLOTS.map((slot) => {
        const mine = gear.filter((g) => GEAR_META[g].slot === slot);
        const worn = l.gear[slot] ?? null;
        return (
          <section key={slot} className={css.slot} aria-label={UI.loadout.slot[slot]}>
            <h2 className={css.slotTitle}>
              {UI.loadout.slot[slot]}
              <span className={css.slotWorn}>{worn === null ? UI.loadout.nothingWorn : NAMES[worn]}</span>
            </h2>
            {mine.length === 0 ? <p className={css.empty}>{UI.loadout.noGearSlot}</p> : (
              <div className={css.list}>
                {mine.map((g) => (
                  <button key={g} type="button" className={`${css.tile} ${worn === g ? css.on : ""}`} aria-pressed={worn === g}
                    aria-label={UI.loadout.toggle(NAMES[g], worn === g)} onClick={() => wear(slot, worn === g ? null : g)}>
                    <PerkIcon id={g} size={44} rarity />
                    <span className={css.tileText}>
                      <span className={css.tileName}>{NAMES[g]}</span>
                      <span className={css.tileLine}>{perkText(g).effect}</span>
                      {perkText(g).costs.length > 0 ? <span className={css.tileCost}>{perkText(g).costs.join(". ")}</span> : null}
                    </span>
                    <span className={css.mark} aria-hidden="true">{worn === g ? UI.loadout.worn : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
