/**
 * Route guards (brief 3.5 "the gate", 3.10, 3.11). Pure: the route the player asked for, the
 * save, and today, give the route to show. They run when the hash changes, so typing a URL
 * cannot get past them:
 *   - while a level-up waits, Tonight's Card and every bout URL go back to the Locker;
 *   - with no bouts left, or a bout not yet watched, the Card goes back to the Locker;
 *   - an empty save only shows Create (and settings);
 *   - the level-up screen only opens while one waits.
 * "Waiting" is read from the record AS SHOWN: while the bout that earned a level-up is unwatched,
 * the screens still show the old XP, so that bout can be watched first.
 */
import { api } from "@rankzero/core";
import type { CoreApi, DayKey } from "@rankzero/core";
import type { SaveDoc } from "../contracts";
import { shownRecord, unwatchedOf } from "../state/actions";
import { SLOT_LIMIT } from "../state/schema";
import type { Route } from "./router";

export function activeRecord(doc: SaveDoc) {
  return doc.fighters.find((f) => f.id === doc.activeId) ?? doc.fighters[0];
}

export function guard(route: Route, doc: SaveDoc, today: DayKey, core: CoreApi = api): Route {
  if (route.name === "sandbox") return route;
  const rec = activeRecord(doc);
  if (!rec) {
    if (route.name === "create" || route.name === "settings") return route;
    return { name: "create" };
  }
  const shown = shownRecord(doc, rec);
  const sheet = core.sheetOf(shown);
  const waiting = sheet.levelUpWaiting;
  const left = core.boutsLeft(shown, today);
  const locker: Route = { name: "locker" };
  switch (route.name) {
    case "home":
    case "unknown":
      return locker;
    case "create":
      return doc.fighters.length >= SLOT_LIMIT ? locker : route;
    case "card":
      if (waiting || left <= 0 || unwatchedOf(doc)) return locker;
      return route;
    case "bout": {
      if (waiting) return locker;
      const b = doc.history.find((h) => h.id === route.id);
      if (!b) return locker;
      if (b.watched) return { name: "replay", id: b.id };
      return route;
    }
    case "levelup":
      return waiting ? route : locker;
    case "replay":
      return doc.history.some((h) => h.id === route.id) ? route : { name: "bouts" };
    default:
      return route;
  }
}
