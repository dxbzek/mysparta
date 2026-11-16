/**
 * The Inventory tab (owner, 15 November 2026: "Should have an inventory, then we can view what is
 * unlocked or not", "And has effects"). Unlocked = `foundPerks` over active and retired records.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COMPANION_IDS, PERK_IDS, SHIELD_IDS, SKILL_IDS, WEAPON_IDS, api, perkKind } from "@rankzero/core";
import type { PerkId } from "@rankzero/core";
import { GameContext } from "../../src/app/context";
import type { Game } from "../../src/app/context";
import { LocalRivalSource } from "../../src/state/opponents";
import { FILTERS, InventoryDetail, InventoryScreen, inventoryItems, inventorySections, ownersOf, silhouetteArt, SKILL_FRAME_PARTS, sortedPerks } from "../../src/screens/Inventory/Inventory";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tabRoute } from "../../src/screens/Locker/Locker";
import { MAIN_TABS } from "../../src/ui/LockerView";
import { rig } from "../../src/seams/rig";
import { perkText, shortEffect } from "../../src/text/perks";
import { memGame, playUntilLevelUp } from "../state/helpers";
// test only: the rig's frame count, read from its source (its public entry does not export it)
import { FRAME_PARTS as RIG_FRAME_PARTS } from "../../../../packages/rig/src/content/icons";

const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, mythic: 4 } as const;

/** One active scrapper with a level-up taken, and one retired scrapper, so the save has perks
 *  found by a retired record too. */
async function setup() {
  const g = await memGame();
  const old = await g.actions.create("Dez", 3, 1);
  if (!old.ok) throw new Error(old.error);
  await playUntilLevelUp(g, old.value.id);
  await g.actions.takeLevelUp(old.value.id, "R");
  const r = await g.actions.retire(old.value.id, "Dez");
  if (!r.ok) throw new Error("retire refused");
  const c = await g.actions.create("Marla", 0, 0);
  if (!c.ok) throw new Error(c.error);
  await playUntilLevelUp(g, c.value.id);
  await g.actions.takeLevelUp(c.value.id, "L");
  const game: Game = { store: g.store, actions: g.actions, clock: g.clock, core: api, opponents: new LocalRivalSource(),
    go: () => undefined, toast: () => undefined };
  const html = (node: React.ReactNode): string => renderToStaticMarkup(<GameContext.Provider value={game}>{node}</GameContext.Provider>);
  const doc = g.store.doc;
  const found = new Set(api.foundPerks([...doc.fighters, ...doc.retired]));
  return { g, html, doc, found };
}

/** Each tile button of the rendered grid, with its state, perk id and inner markup. */
function tiles(out: string): { state: string; id: PerkId; inner: string }[] {
  const re = /<button type="button" class="[^"]*" style="[^"]*" data-state="(locked|unlocked)" data-perk="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g;
  return [...out.matchAll(re)].map((m) => ({ state: m[1]!, id: m[2] as PerkId, inner: m[3]! }));
}

describe("inventory", () => {
  it("the grid shows all 92 perks and its unlocked tiles are exactly foundPerks over active and retired", async () => {
    const { html, doc, found } = await setup();
    expect(doc.retired.length).toBe(1);
    const retiredOnly = api.foundPerks(doc.retired).filter((p) => !api.foundPerks(doc.fighters).includes(p));
    expect(found.size).toBeGreaterThan(1);
    const out = html(<InventoryScreen />);
    const t = tiles(out);
    expect(t).toHaveLength(PERK_IDS.length);
    const shownUnlocked = new Set(t.filter((x) => x.state === "unlocked").map((x) => x.id));
    expect(shownUnlocked).toEqual(found);
    for (const p of retiredOnly) expect(shownUnlocked.has(p)).toBe(true);
    expect(out).toContain(`Unlocked ${found.size} of ${PERK_IDS.length}`);
    expect(out).toContain(`aria-valuenow="${found.size}"`);
  });

  it("review r2: 'All' is split under a heading per kind, in the same order; a kind filter is one plain list", () => {
    const all = inventoryItems(new Set(PERK_IDS.slice(0, 10)), "all", true);
    const secs = inventorySections(all, "all");
    expect(secs.map((x) => x.kind)).toEqual(["weapon", "skill", "companion", "shield"]);
    expect(secs.flatMap((x) => x.ids).sort()).toEqual([...all].sort());
    for (const x of secs) expect(x.ids).toEqual(all.filter((id) => perkKind(id) === x.kind));
    const w = inventoryItems(new Set(), "weapon", true);
    expect(inventorySections(w, "weapon")).toEqual([{ kind: null, ids: w }]);
  });

  it("review r2: the filter row stays on screen while the grid scrolls, and a phone gets three tiles a row", async () => {
    const cssText = readFileSync(fileURLToPath(new URL("../../src/screens/Inventory/Inventory.module.css", import.meta.url)), "utf8");
    expect(cssText).toMatch(/\.controls \{[^}]*position: sticky;[^}]*top: 0;/);
    expect(cssText).toMatch(/\.grid \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    const { html } = await setup();
    const out = html(<InventoryScreen />);
    for (const k of ["Weapons", "Skills", "Pets", "Shields"]) expect(out).toMatch(new RegExp(`<h2 class="[^"]*"[^>]*>${k}`));
  });

  it("review r2: a locked silhouette drops the pet portrait's backdrop and the skill badge, so the item's own shape shows", async () => {
    const { loadFullRig } = await import("../../src/seams/rig");
    await loadFullRig();
    const vb = (id: PerkId) => rig.icon(id).viewBox.split(" ").map(Number);
    // the backdrop square of a pet (Stray Dog drew as an opaque black square) is gone
    for (const id of COMPANION_IDS) {
      const [x, y, w, h] = vb(id);
      const full = `M${+x!.toFixed(2)} ${+y!.toFixed(2)}L`;
      expect(silhouetteArt(rig.icon(id), "companion").parts.some((p) => p.d.startsWith(full) && !p.transform), id).toBe(false);
      void w; void h;
    }
    // skills: every icon sits on the same badge (a rough square and its shadow); the silhouette keeps only the item
    // The dropped parts must really be the frame, checked from the drawn geometry and not from the
    // drop rule itself: the first is one outline that spans nearly the whole 24-unit box, centred;
    // the second is one outline inside it, also centred (the inner disc or square).
    const box = (d: string) => {
      const n = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
      const xs = n.filter((_, i) => i % 2 === 0);
      const ys = n.filter((_, i) => i % 2 === 1);
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    };
    const centred = (b: ReturnType<typeof box>) => Math.abs((b.x0 + b.x1) / 2 - 12) < 1.5 && Math.abs((b.y0 + b.y1) / 2 - 12) < 1.5;
    expect(SKILL_FRAME_PARTS).toBe(RIG_FRAME_PARTS);
    for (const id of SKILL_IDS) {
      const art = rig.icon(id);
      expect(art.viewBox, id).toBe("0 0 24 24");
      const [outer, inner] = art.parts.slice(0, SKILL_FRAME_PARTS).map((p) => {
        expect(p.transform, id).toBeFalsy();
        expect(p.d.match(/M/g), id).toHaveLength(1);
        return box(p.d);
      });
      expect(outer!.x1 - outer!.x0, id).toBeGreaterThan(19);
      expect(outer!.y1 - outer!.y0, id).toBeGreaterThan(19);
      expect(centred(outer!) && centred(inner!), id).toBe(true);
      expect(inner!.x0 > outer!.x0 && inner!.x1 < outer!.x1 && inner!.y0 > outer!.y0 && inner!.y1 < outer!.y1, id).toBe(true);
      const sil = silhouetteArt(art, "skill");
      expect(sil.parts.map((p) => p.d), id).toEqual(art.parts.slice(SKILL_FRAME_PARTS).map((p) => p.d));
    }
    // two badge-only silhouettes that used to look the same now differ
    const sig = (id: PerkId) => silhouetteArt(rig.icon(id), "skill").parts.map((p) => p.d).join("|");
    expect(new Set(["whistle", "taunt", "tarp", "air-horn"].map((id) => sig(id as PerkId))).size).toBe(4);
  });

  it("tiles are sorted by rarity, then name", () => {
    const ids = sortedPerks();
    expect(ids).toHaveLength(PERK_IDS.length);
    for (let i = 1; i < ids.length; i++) {
      const a = perkText(ids[i - 1]!);
      const b = perkText(ids[i]!);
      expect(RANK[a.rarity] < RANK[b.rarity] || (a.rarity === b.rarity && a.name.localeCompare(b.name) <= 0)).toBe(true);
    }
  });

  it("filters: each kind shows exactly its ids; Show locked off leaves only the unlocked ones", async () => {
    const { found } = await setup();
    const kinds = { weapon: WEAPON_IDS, skill: SKILL_IDS, companion: COMPANION_IDS, shield: SHIELD_IDS } as const;
    expect(FILTERS).toEqual(["all", "weapon", "skill", "companion", "shield"]);
    expect(inventoryItems(found, "all", true)).toHaveLength(92);
    expect(inventoryItems(found, "all", false).sort()).toEqual([...found].sort());
    for (const [k, ids] of Object.entries(kinds) as [keyof typeof kinds, readonly PerkId[]][]) {
      const shown = inventoryItems(found, k, true);
      expect(new Set(shown)).toEqual(new Set(ids));
      const unlockedOnly = inventoryItems(found, k, false);
      expect(unlockedOnly.every((p) => found.has(p) && perkKind(p) === k)).toBe(true);
      expect(unlockedOnly).toHaveLength(ids.filter((p) => found.has(p)).length);
    }
  });

  it("puts what the scrapper owns now first, then the other unlocked items, then the locked ones (finding 63)", () => {
    const all = sortedPerks();
    const owned = new Set([all[all.length - 1]!]);
    const found = new Set([all[all.length - 1]!, all[all.length - 2]!, all[40]!]);
    const items = inventoryItems(found, "all", true, owned);
    expect(items).toHaveLength(all.length);
    expect(items[0]).toBe(all[all.length - 1]);
    expect(new Set(items.slice(1, 3))).toEqual(new Set([all[all.length - 2], all[40]]));
    expect(items.slice(3).every((id) => !found.has(id))).toBe(true);
  });

  it("locked tiles never carry colour art: only a two-tone token silhouette, a lock, the name and the rarity word", async () => {
    const { html, found } = await setup();
    const t = tiles(html(<InventoryScreen />));
    const locked = t.filter((x) => x.state === "locked");
    expect(locked.length).toBe(PERK_IDS.length - found.size);
    const colour = /(fill|stroke)="(?!currentColor|none)[^"]+"/;
    for (const x of locked) {
      const svgs = x.inner.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
      expect(svgs.length, x.id).toBe(2);                 // the silhouette and the lock
      for (const s of svgs) expect(s, `${x.id} shows colour art`).not.toMatch(colour);
      expect(x.inner).toContain(perkText(x.id).name.replace(/'/g, "&#x27;"));
      expect(x.inner).toContain(perkText(x.id).rarityWord);
    }
    // planted: the unlocked tiles DO draw colour, so the check above can fail
    const unlocked = t.filter((x) => x.state === "unlocked");
    expect(unlocked.some((x) => colour.test(x.inner))).toBe(true);
    // and the silhouette helper strips every colour of every icon
    for (const id of PERK_IDS) {
      for (const p of silhouetteArt(rig.icon(id)).parts) {
        expect(Object.keys(p).filter((k) => k === "fill" || k === "stroke")).toEqual([]);
        expect(["body", "outlined", "ink"]).toContain(p.role);
      }
    }
  });

  it("every tile shows its short effect line, with the Owned badge on what the active scrapper owns now", async () => {
    const { html, doc } = await setup();
    const out = html(<InventoryScreen />);
    const now = new Set(api.sheetOf(doc.fighters[0]!).perks);
    for (const x of tiles(out)) {
      expect(x.inner).toContain(shortEffect(x.id).replace(/'/g, "&#x27;"));
      expect(x.inner.includes(">Owned<"), x.id).toBe(now.has(x.id));
    }
  });

  it("short effect lines fit two lines on a phone tile and are built from numbers", () => {
    for (const id of PERK_IDS) {
      const l = shortEffect(id);
      expect(l.length, `${id}: "${l}"`).toBeLessThanOrEqual(46);
      expect(l, id).not.toMatch(/undefined|NaN|Unknown/);
    }
    expect(shortEffect("haymaker")).toMatch(/^Next swing hits/);
  });

  it("the sheet: an unlocked weapon shows its effect, costs, key numbers and who owns it", async () => {
    const { html, doc } = await setup();
    const weapon = api.sheetOf(doc.fighters[0]!).perks.find((p) => perkKind(p) === "weapon")
      ?? (WEAPON_IDS.find((w) => perkText(w).costs.length > 0) as PerkId);
    const owners = ownersOf(weapon, doc.fighters, doc.retired, api.sheetOf);
    const out = html(<InventoryDetail id={weapon} unlocked look={api.rollLook(1, 0, 0)} owners={owners.length ? owners : ["Marla"]} />);
    const t = perkText(weapon);
    expect(out).toContain(t.effect.replace(/'/g, "&#x27;"));
    for (const c of t.costs) expect(out).toContain(c);
    for (const label of ["Damage", "Reach", "Turn time", "Hands", "Thrown"]) expect(out).toContain(`<dt>${label}</dt>`);
    expect(out).toContain("Owned by:");
    expect(out).toContain(t.rarityWord);
    expect(out).toContain("<canvas");                      // the weapon drawn in a hand
  });

  it("the sheet: a locked item says how to get it and shows only its silhouette", async () => {
    const { html, found } = await setup();
    const locked = PERK_IDS.find((p) => !found.has(p) && perkKind(p) === "companion")!;
    const out = html(<InventoryDetail id={locked} unlocked={false} look={api.rollLook(1, 0, 0)} owners={[]} />);
    expect(out).toContain("How to get:");
    expect(out).toContain("Level-up cards.");
    expect(out).toContain(perkText(locked).effect);
    expect(out).not.toContain("<canvas");
    expect(out).not.toMatch(/(fill|stroke)="(?!currentColor|none)[^"]+"/);
  });

  it("ownersOf names the active owners and marks retired ones", async () => {
    const { doc } = await setup();
    const retiredPerks = api.sheetOf(doc.retired[0]!).perks;
    const p = retiredPerks[0]!;
    expect(ownersOf(p, doc.fighters, doc.retired, api.sheetOf)).toContain("Dez (retired)");
  });

  it("the tab bar has Home, Kit, Inventory, History and the Inventory tab routes to #/inventory", () => {
    expect(MAIN_TABS).toEqual(["home", "kit", "inventory", "history"]);
    expect(tabRoute("inventory")).toEqual({ name: "inventory" });
    expect(tabRoute("history")).toEqual({ name: "bouts" });
  });
});
