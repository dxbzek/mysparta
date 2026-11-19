/**
 * The Inventory (owner, 15 November 2026: "Should have an inventory, then we can view what is
 * unlocked or not", then "And has effects"). A bottom tab of its own.
 *
 *   Header   "Unlocked N of 92", a bar, and a count per kind.
 *   Filters  All, Weapons, Skills, Pets, Shields, and a "Show locked" toggle.
 *   Grid     one tile per perk, sorted by rarity then name: the rig's drawn icon, the name, the
 *            short effect line (text/perks.ts, numbers from the tables), the rarity word on a frame
 *            in the rarity colour. Unlocked tiles are in full colour, with an "Owned" badge when
 *            the active scrapper owns it now, and a glow on Epic and Mythic. Locked tiles are
 *            dark: the same icon as a flat silhouette (no colour art at all), a lock, the name and
 *            the rarity word, so the player knows what to chase.
 *   Sheet    tap a tile: the item drawn still (a weapon in a scrapper's hand, a shield on the back
 *            arm, a pet standing beside it, a skill as a big icon), the full effect with its
 *            numbers in plus (teal) and minus (red) lines, and who owns it or how to get it.
 *
 * "Unlocked" is `foundPerks` over every scrapper of the save, active and retired. No new data.
 * Motion: the one shine across the unlocked tiles runs only under html[data-motion="full"].
 */
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { PERK_IDS, perkKind } from "@rankzero/core";
import type { CompanionId, Look, PerkId, PerkKind, Rarity, ScrapperRecord, ShieldId, WeaponId } from "@rankzero/core";
import type { SvgArt } from "@rankzero/rig";
import { activeRecord } from "../../app/guards";
import { useDoc, useGame } from "../../app/context";
import { shownRecord } from "../../state/actions";
import { perkNumbers, perkText, shortEffect, weaponHandling } from "../../text/perks";
import { LOCKER_WORDS, UI } from "../../text/ui";
import { rig, useRigVersion } from "../../seams/rig";
import { ActorStage } from "../../ui/ActorStage";
import { Button } from "../../ui/Button";
import { MAIN_TABS } from "../../ui/LockerView";
import { PerkIcon } from "../../ui/PerkIcon";
import { Portrait } from "../../ui/Portrait";
import { Sheet } from "../../ui/Sheet";
import { SvgArtView } from "../../ui/SvgArt";
import { TabBar } from "../../ui/TabBar";
import { tabRoute } from "../Locker/Locker";
import { BackGlyph } from "../parts/Glyphs";
import common from "../common.module.css";
import css from "./Inventory.module.css";

export type InventoryFilter = "all" | PerkKind;
export const FILTERS: readonly InventoryFilter[] = ["all", "weapon", "skill", "companion", "shield", "gear"];
const KINDS: readonly PerkKind[] = ["weapon", "skill", "companion", "shield", "gear"];
const RARITY_RANK: Readonly<Record<Rarity, number>> = { common: 0, uncommon: 1, rare: 2, epic: 3, mythic: 4 };

/** Every perk, sorted by rarity (Common first) then name. */
export function sortedPerks(): PerkId[] {
  return [...PERK_IDS].sort((p, q) => {
    const a = perkText(p);
    const b = perkText(q);
    return RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] || a.name.localeCompare(b.name);
  });
}

/** The tiles a filter and the "Show locked" toggle leave on screen, in display order: what the
 *  scrapper owns now first, then the rest it has unlocked, then the locked ones, each group by
 *  rarity then name (finding 63: the owned items no longer hide among 90 locked tiles). Pure. */
export function inventoryItems(unlocked: ReadonlySet<PerkId>, filter: InventoryFilter, showLocked: boolean,
  ownedNow: ReadonlySet<PerkId> = new Set()): PerkId[] {
  const group = (id: PerkId): number => (ownedNow.has(id) ? 0 : unlocked.has(id) ? 1 : 2);
  return sortedPerks()
    .filter((id) => (filter === "all" || perkKind(id) === filter) && (showLocked || unlocked.has(id)))
    .map((id, i) => ({ id, i, g: group(id) }))
    .sort((p, q) => p.g - q.g || p.i - q.i)
    .map((x) => x.id);
}

/** The grid's sections: under "All", one per kind with a heading (review r2: 92 tiles in one
 *  run with no way to tell where the weapons end), each in the order `items` gives; a kind
 *  filter is one section with no heading. Pure. */
export function inventorySections(items: readonly PerkId[], filter: InventoryFilter): { kind: PerkKind | null; ids: PerkId[] }[] {
  if (filter !== "all") return [{ kind: null, ids: [...items] }];
  return KINDS.map((kind) => ({ kind, ids: items.filter((id) => perkKind(id) === kind) })).filter((x) => x.ids.length > 0);
}

/** One path of a silhouette: the body, its outline, or an ink detail line. No colour is kept. */
export interface SilhouettePart { d: string; transform?: string; strokeWidth?: number; role: "body" | "outlined" | "ink" }

const luma = (fill: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(fill.trim());
  if (!m) return 1;
  const v = parseInt(m[1]!, 16);
  return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
};

/** How much of the view box an untransformed path's points span, as the smaller of its width and
 *  height shares (0 for a transformed path: it is part of the drawing, never a backdrop). */
function coverOf(d: string, transform: string | undefined, viewBox: string): number {
  if (transform) return 0;
  const [, , vw = 0, vh = 0] = viewBox.split(/\s+/).map(Number);
  const n = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (n.length < 4 || !(vw > 0) || !(vh > 0)) return 0;
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return Math.min((Math.max(...xs) - Math.min(...xs)) / vw, (Math.max(...ys) - Math.min(...ys)) / vh);
}

/** The same icon as a dark silhouette: every shape is one flat dark, its ink outlines and the
 *  ink detail lines turn into a faint rim, so the shape reads but no colour art is left (the two
 *  tones come from tokens via CSS classes, never from the art).
 *  Review r2: what is not the item is left out. A pet's icon is a portrait on a backdrop square
 *  (Stray Dog showed as an opaque black square), and every skill icon sits on the same badge (a
 *  rough square and its shadow, the first two shapes), so Whistle, Taunt, Tarp and Air Horn were
 *  one identical square. A backdrop (an untransformed shape spanning 90% of the box) is dropped,
 *  and for a skill the badge and its shadow, so the silhouette is the item's own shape. */
/** How many leading parts of a skill icon are its frame (the badge and its inner disc). Mirrors the
 *  rig's `FRAME_PARTS` (packages/rig/src/content/icons.ts), which the rig's public entry does not
 *  export; importing `@rankzero/rig/content` here would pull the whole content pack into this
 *  chunk. A test fails if the two ever differ. */
export const SKILL_FRAME_PARTS = 2;

export function silhouetteArt(art: SvgArt, kind?: PerkKind): { viewBox: string; parts: SilhouettePart[] } {
  const drop = new Set<number>();
  if (kind !== "skill") art.parts.forEach((p, i) => { if (coverOf(p.d, p.transform, art.viewBox) >= 0.9) drop.add(i); });
  // every skill icon is drawn on a badge (a round one for a passive, a rough square for a Move):
  // its first two shapes, the badge and its shadow
  if (kind === "skill" && art.parts.length > SKILL_FRAME_PARTS) for (let i = 0; i < SKILL_FRAME_PARTS; i++) drop.add(i);
  const kept = drop.size < art.parts.length ? art.parts.filter((_, i) => !drop.has(i)) : art.parts;
  return {
    viewBox: art.viewBox,
    parts: kept.map((p) => {
      const stroked = !!p.stroke && p.stroke !== "none";
      const filled = !!p.fill && p.fill !== "none";
      const role: SilhouettePart["role"] = stroked ? "outlined" : filled && luma(p.fill!) < 0.12 ? "ink" : "body";
      return { d: p.d, transform: p.transform, strokeWidth: stroked ? p.strokeWidth : undefined, role: stroked && !filled ? "ink" : role };
    }),
  };
}

function Silhouette({ art, size, kind }: { art: SvgArt; size: number; kind?: PerkKind }) {
  const s = silhouetteArt(art, kind);
  return (
    <svg className={css.silhouette} viewBox={s.viewBox} width={size} height={size} aria-hidden="true" focusable="false">
      {s.parts.map((p, i) => (
        <path key={i} d={p.d} transform={p.transform} strokeWidth={p.strokeWidth} strokeLinejoin="round" strokeLinecap="round"
          className={p.role === "outlined" ? css.silOutlined : p.role === "ink" ? (p.strokeWidth ? css.silInkLine : css.silInk) : css.silBody} />
      ))}
    </svg>
  );
}

function LockGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="2.5" y="7" width="11" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function InventoryScreen() {
  const { core, go } = useGame();
  const doc = useDoc();
  useRigVersion();
  const rec = activeRecord(doc);
  const shown = rec ? shownRecord(doc, rec) : null;
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [showLocked, setShowLocked] = useState(true);
  const [open, setOpen] = useState<PerkId | null>(null);
  const unlocked = useMemo(() => new Set(core.foundPerks([...doc.fighters, ...doc.retired])), [core, doc.fighters, doc.retired]);
  const ownedNow = useMemo(() => new Set(shown ? core.sheetOf(shown).perks : []), [core, shown]);
  if (!rec || !shown) return null;
  const items = inventoryItems(unlocked, filter, showLocked, ownedNow);
  const total = PERK_IDS.length;
  const level = core.sheetOf(shown).level;
  return (
    <div className={`${common.screen} ${common.wide}`}>
      <header className={common.top}>
        <Button square onClick={() => go({ name: "locker" })} aria-label={UI.back}><BackGlyph /></Button>
        <div className={common.titles}>
          <span className={common.kicker}>{rec.name} · {UI.level(level)}</span>
          <h1 className={common.h1}>{UI.inventory.title}</h1>
        </div>
        <Portrait look={core.sheetOf(shown).look} size={44} label={rec.name} />
      </header>
      <main className={common.body}>
        <section className={css.progress} aria-label={UI.inventory.unlocked(unlocked.size, total)}>
          <p className={css.progressCount}>{UI.inventory.unlocked(unlocked.size, total)}</p>
          <span className={css.progressBar} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={unlocked.size} aria-label={UI.inventory.title}>
            <span style={{ width: `${((unlocked.size / total) * 100).toFixed(1)}%` }} />
          </span>
          <ul className={css.kindCounts}>
            {KINDS.map((k) => {
              const all = PERK_IDS.filter((p) => perkKind(p) === k);
              return <li key={k}><span>{UI.inventory.filters[k]}</span> <b>{all.filter((p) => unlocked.has(p)).length}/{all.length}</b></li>;
            })}
          </ul>
          <p className={css.progressSub}>{UI.inventory.unlockedSub}</p>
        </section>

        <div className={css.controls}>
          <div className={css.chips} role="group" aria-label={UI.inventory.filterLabel}>
            {FILTERS.map((f) => (
              <Button key={f} variant={f === filter ? "dark" : "secondary"} pressed={f === filter} className={css.chip} onClick={() => setFilter(f)}>
                {UI.inventory.filters[f]}
              </Button>
            ))}
          </div>
          <Button variant={showLocked ? "dark" : "secondary"} pressed={showLocked} className={css.toggle} onClick={() => setShowLocked((v) => !v)}>
            <span className={css.toggleBox} aria-hidden="true">{showLocked ? "✓" : ""}</span>{UI.inventory.showLocked}
          </Button>
        </div>

        {items.length === 0 ? <p className={css.empty}>{UI.inventory.noneShown}</p> : inventorySections(items, filter).map((sec) => (
          <section key={sec.kind ?? "list"} className={css.section} aria-label={sec.kind ? UI.inventory.filters[sec.kind] : undefined}>
            {sec.kind ? (
              <h2 className={css.sectionHead}>
                {UI.inventory.filters[sec.kind]} <b>{sec.ids.filter((id) => unlocked.has(id)).length}/{sec.ids.length}</b>
              </h2>
            ) : null}
            <ul className={css.grid} aria-label={UI.inventory.count(sec.ids.length)}>
              {sec.ids.map((id, i) => (
                <li key={id} className={css.cell}>
                  <Tile id={id} unlocked={unlocked.has(id)} owned={ownedNow.has(id)} index={i} owner={rec.name} onOpen={setOpen} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <div className={common.tabs}>
        <TabBar tabs={MAIN_TABS.map((k) => ({ key: k, label: LOCKER_WORDS.tabs[k] }))} active="inventory" onSelect={(k) => go(tabRoute(k))} />
      </div>
      <Sheet open={open !== null} title={open ? perkText(open).name : UI.inventory.sheetTitle} onClose={() => setOpen(null)}>
        {open ? <InventoryDetail id={open} unlocked={unlocked.has(open)} look={core.sheetOf(shown).look} owners={ownersOf(open, doc.fighters, doc.retired, core.sheetOf)} /> : null}
      </Sheet>
    </div>
  );
}

/** The names of the scrappers that own a perk now, active ones first, retired ones marked. */
export function ownersOf(id: PerkId, fighters: readonly ScrapperRecord[], retired: readonly ScrapperRecord[], sheetOf: (r: ScrapperRecord) => { perks: PerkId[] }): string[] {
  return [
    ...fighters.filter((r) => sheetOf(r).perks.includes(id)).map((r) => r.name),
    ...retired.filter((r) => sheetOf(r).perks.includes(id)).map((r) => UI.inventory.retired(r.name)),
  ];
}

function Tile({ id, unlocked, owned, index, owner, onOpen }: { id: PerkId; unlocked: boolean; owned: boolean; index: number; owner: string; onOpen(id: PerkId): void }) {
  const t = perkText(id);
  const line = shortEffect(id);
  const state = unlocked ? (owned ? UI.inventory.ownedNowLabel(owner) : "") : UI.inventory.locked;
  const glow = unlocked && (t.rarity === "epic" || t.rarity === "mythic") ? css[`glow-${t.rarity}`] : "";
  const cls = [css.tile, css[`r-${t.rarity}`], unlocked ? css.unlocked : css.locked, glow].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} style={{ "--i": Math.min(index, 24) } as CSSProperties} data-state={unlocked ? "unlocked" : "locked"} data-perk={id}
      onClick={() => onOpen(id)} aria-label={UI.inventory.tileLabel(t.name, t.rarityWord, t.kind, line, state)}>
      <span className={css.art} aria-hidden="true">
        {unlocked ? <PerkIcon id={id} size={64} /> : (
          <Silhouette art={rig.icon(id)} kind={perkKind(id)} size={52} />
        )}
        {unlocked ? null : <span className={css.lock}><LockGlyph /></span>}
        {owned && unlocked ? <span className={css.badge}>{UI.inventory.ownedNow}</span> : null}
      </span>
      <span className={css.name}>{t.name}</span>
      <span className={css.line}>{line}</span>
      <span className={`${css.rarityWord} ${unlocked ? common[t.rarity] : css.rarityLocked}`}>{t.rarityWord}</span>
    </button>
  );
}

/** The body of an item's sheet. Exported for the screen tests. */
export function InventoryDetail({ id, unlocked, look, owners }: { id: PerkId; unlocked: boolean; look: Look; owners: readonly string[] }) {
  const t = perkText(id);
  const k = perkKind(id);
  const nums = [...perkNumbers(id), ...(k === "weapon" ? weaponHandling(id as WeaponId) : [])];
  return (
    <div className={css.detail} data-perk={id}>
      <Picture id={id} unlocked={unlocked} look={look} />
      <p className={css.detailKind}>
        <span className={`${common.rarity} ${common[t.rarity]}`}>{t.rarityWord}</span> <span>{t.kind}</span>
        {unlocked ? null : <span className={css.detailLocked}><LockGlyph size={14} /> {UI.inventory.locked}</span>}
      </p>
      <section className={css.effects} aria-label={UI.inventory.effect}>
        <h3 className={css.effectsTitle}>{UI.inventory.effect}</h3>
        <p className={css.plus}><span aria-hidden="true" className={css.sign}>+</span>{t.effect}</p>
        {t.costs.map((c) => <p key={c} className={css.minus}><span aria-hidden="true" className={css.sign}>−</span>{c}</p>)}
        {nums.length ? (
          <>
            <h3 className={css.effectsTitle}>{UI.inventory.numbers}</h3>
            <dl className={css.numbers}>
              {nums.map((n) => (
                <div key={n.label} className={css.number}>
                  <dt>{n.label}</dt>
                  <dd className={n.value.startsWith("-") ? css.valueMinus : n.value.startsWith("+") ? css.valuePlus : undefined}>{n.value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </section>
      {unlocked && owners.length > 0 ? (
        <p className={css.owners}><b>{UI.inventory.ownedBy}:</b> {owners.join(", ")}</p>
      ) : !unlocked ? (
        <p className={css.owners}><b>{UI.inventory.howToGet}:</b> {UI.inventory.howToGetLine}</p>
      ) : null}
    </div>
  );
}

/** The item drawn still: in a hand, on the back arm, standing beside a scrapper, or as a big
 *  icon. A locked item is only ever its silhouette. */
function Picture({ id, unlocked, look }: { id: PerkId; unlocked: boolean; look: Look }) {
  const v = useRigVersion();
  const t = perkText(id);
  const k = perkKind(id);
  if (!unlocked) {
    return (
      <div className={`${css.picture} ${css.pictureLocked}`} data-state="locked">
        <Silhouette art={rig.icon(id)} kind={k} size={120} />
      </div>
    );
  }
  if (k === "skill") {
    return (
      <div className={`${css.picture} ${css[`frame-${t.rarity}`]}`}>
        <span className={css.bigIcon}><SvgArtView art={rig.icon(id)} size={112} label={t.name} /></span>
      </div>
    );
  }
  const scene = k === "weapon" ? { held: id as WeaponId } : k === "shield" ? { shield: id as ShieldId } : { companions: [id as CompanionId] };
  return (
    <div className={`${css.picture} ${css.pictureStage} ${css[`frame-${t.rarity}`]}`}>
      <ActorStage key={v} t={0} height={220} look={look} {...scene} window={{ w: 270, h: 150 }} floorAt={0.9} label={UI.inventory.preview(t.name)} />
      <span className={css.pictureIcon}><PerkIcon id={id} size={44} /></span>
    </div>
  );
}
