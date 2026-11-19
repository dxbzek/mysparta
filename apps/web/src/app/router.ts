/**
 * Hash routes (they work on GitHub Pages and on a LAN preview). `#/debug/...` belongs to the
 * fight-screen lane's debug pages and is mounted by main.tsx before the app sees it.
 */
export type KitTab = "kit" | "loadout" | "gear" | "talents" | "route" | "stats";

export type Route =
  | { name: "home" }                    // #/            Create when the save is empty, else the Locker
  | { name: "create" }                  // #/create      the "+" slot
  | { name: "locker" }                  // #/locker
  | { name: "settings" }                // #/settings    the settings sheet over the Locker
  | { name: "card" }                    // #/card        Tonight's Card
  | { name: "bout"; id: string }        // #/bout/<id>   the fight screen, live
  | { name: "levelup" }                 // #/levelup
  | { name: "kit"; tab: KitTab }        // #/kit, #/kit/talents, #/kit/route, #/kit/stats
  | { name: "bouts" }                   // #/bouts       History
  | { name: "inventory" }               // #/inventory   every perk, unlocked or not
  | { name: "look" }                    // #/look        the look editor (content v3 batch 4)
  | { name: "replay"; id: string }      // #/replay/<id>
  | { name: "sandbox" }                 // #/sandbox     debug: a hand-built bout, never saved
  | { name: "unknown"; hash: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "").split("?")[0] ?? "";
  const parts = path.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
  const [a, b] = parts;
  if (parts.length === 0) return { name: "home" };
  switch (a) {
    case "create": return { name: "create" };
    case "locker": return { name: "locker" };
    case "settings": return { name: "settings" };
    case "card": return { name: "card" };
    case "levelup": return { name: "levelup" };
    case "bouts": return { name: "bouts" };
    case "inventory": return { name: "inventory" };
    case "look": return { name: "look" };
    case "sandbox": return { name: "sandbox" };
    case "kit": return { name: "kit", tab: b === "route" || b === "stats" || b === "loadout" || b === "gear" || b === "talents" ? b : "kit" };
    case "bout": return b ? { name: "bout", id: b } : { name: "unknown", hash };
    case "replay": return b ? { name: "replay", id: b } : { name: "unknown", hash };
    default: return { name: "unknown", hash };
  }
}

export function hrefOf(r: Route): string {
  switch (r.name) {
    case "home": return "#/";
    case "kit": return r.tab === "kit" ? "#/kit" : `#/kit/${r.tab}`;
    case "bout": return `#/bout/${encodeURIComponent(r.id)}`;
    case "replay": return `#/replay/${encodeURIComponent(r.id)}`;
    case "unknown": return "#/";
    default: return `#/${r.name}`;
  }
}

export const sameRoute = (x: Route, y: Route): boolean => hrefOf(x) === hrefOf(y);
