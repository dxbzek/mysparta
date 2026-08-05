/**
 * Cloud save, client side.
 *
 * Inert until VITE_API_URL is set: with no server configured every call is a
 * no-op and the game runs exactly as it does today, on localStorage. That is
 * deliberate — the prototype must never depend on infrastructure that may not
 * exist, and a half-configured build should degrade to offline, not to broken.
 *
 * The rules that make a sync trustworthy live here as much as on the server:
 *   - the local save is always authoritative for play; the cloud is a copy,
 *   - a push carries the version it was built on, so a save made on another
 *     device is reported as a conflict rather than silently overwritten,
 *   - a failed sync is invisible to the player — they keep playing offline.
 */

import { SAVE_SCHEMA_VERSION, type Save } from "@agoge/protocol";
import type { SaveV1 } from "./save.js";

const API = import.meta.env?.VITE_API_URL as string | undefined;

/** Whether a server is configured at all. */
export const cloudEnabled = Boolean(API);

/** Where the local save's version token lives between sessions. */
const VERSION_KEY = "agoge.cloud.version";

function readVersion(): number {
  try {
    return Number(localStorage.getItem(VERSION_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeVersion(v: number): void {
  try {
    localStorage.setItem(VERSION_KEY, String(v));
  } catch {
    /* storage may be unavailable */
  }
}

/**
 * The client's save split into what the server owns and what it merely
 * carries. Presentation — look, portrait, gear, quests — is the player's
 * business, so it travels as an opaque blob the server never interprets.
 */
export function toWire(save: SaveV1): Save {
  const { champion, kleos, vigor, vigorDate, wins, losses, totalFights, ...rest } = save;
  return {
    schema: SAVE_SCHEMA_VERSION,
    champion: {
      name: champion.name,
      displayName: champion.displayName,
      seed: champion.seed,
      omen: champion.omen,
      epithet: champion.epithet,
      level: champion.level,
      xp: champion.xp,
      stats: champion.stats,
      weapons: champion.weapons,
      skills: champion.skills,
      beasts: champion.beasts,
      favour: champion.favour,
    },
    kleos,
    vigor,
    vigorDate,
    wins,
    losses,
    totalFights,
    presentation: rest as Record<string, unknown>,
  };
}

/** Rebuild a local save from the wire shape (presentation rides along). */
export function fromWire(wire: Save, fallback: SaveV1): SaveV1 {
  const presentation = wire.presentation as Partial<SaveV1>;
  return {
    ...fallback,
    ...presentation,
    v: 1,
    champion: { ...fallback.champion, ...wire.champion },
    kleos: wire.kleos,
    vigor: wire.vigor,
    vigorDate: wire.vigorDate,
    wins: wire.wins,
    losses: wire.losses,
    totalFights: wire.totalFights,
  };
}

export type SyncResult =
  | { status: "off" }
  | { status: "synced"; version: number }
  | { status: "conflict" }
  | { status: "offline" };

async function call(path: string, body: unknown): Promise<Response | null> {
  if (!API) return null;
  try {
    return await fetch(`${API}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    // A dead network is not an error the player should ever see.
    return null;
  }
}

/**
 * Push the local save up. Returns "conflict" when another device moved first —
 * the caller decides what to show; this layer never picks a winner.
 */
export async function push(save: SaveV1): Promise<SyncResult> {
  if (!API) return { status: "off" };
  const res = await call("save.push", {
    save: toWire(save),
    baseVersion: readVersion(),
    idempotencyKey: crypto.randomUUID(),
  });
  if (!res) return { status: "offline" };
  if (res.status === 409) return { status: "conflict" };
  if (!res.ok) return { status: "offline" };
  const body = (await res.json()) as { version: number };
  writeVersion(body.version);
  return { status: "synced", version: body.version };
}

/** Pull the cloud save down, or null when there is nothing stored yet. */
export async function pull(): Promise<{ wire: Save; version: number } | null> {
  if (!API) return null;
  const res = await call("save.pull", {});
  if (!res?.ok) return null;
  const body = (await res.json()) as { save: Save | null; version: number };
  if (!body.save) return null;
  writeVersion(body.version);
  return { wire: body.save, version: body.version };
}
