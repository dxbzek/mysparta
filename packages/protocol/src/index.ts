/**
 * The wire contract between apps/web and apps/api.
 *
 * Per 04-technical-architecture.md §3 this package is zod-only: no runtime
 * dependency on the sim, no database driver, nothing that would stop the
 * browser importing it. Every tRPC input and output is defined here once, so
 * the client cannot ask for a shape the server does not serve.
 *
 * Scope note: this is the cloud-save slice — profiles and champion saves. The
 * fight, ledger, phalanx and shop routers specified in the architecture doc
 * land on the same pattern when they are built.
 */

import { z } from "zod";

/** Bumped whenever the persisted save shape changes (schema doc §1 rule 4). */
export const SAVE_SCHEMA_VERSION = 1;

export const statsSchema = z.object({
  might: z.number().int().min(1).max(99),
  grace: z.number().int().min(1).max(99),
  tempo: z.number().int().min(1).max(99),
  grit: z.number().int().min(1).max(99),
});

/**
 * The champion as the server stores it. Deliberately not the client's SaveV1:
 * the client owns presentation (look, portrait, aura), the server owns the
 * facts a leaderboard or a rival board reads. Both travel, only these are
 * constrained.
 */
export const championSchema = z.object({
  name: z.string().min(2).max(24),
  displayName: z.string().min(2).max(24),
  seed: z.number().int().nonnegative(),
  omen: z.string().max(32),
  epithet: z.string().max(48),
  level: z.number().int().min(1).max(50),
  xp: z.number().int().min(0),
  stats: statsSchema,
  weapons: z.array(z.string().max(64)).max(12),
  skills: z.array(z.string().max(64)).max(20),
  beasts: z.array(z.string().max(64)).max(6),
  favour: z.number().int().min(0).max(6),
});

export const saveSchema = z.object({
  schema: z.literal(SAVE_SCHEMA_VERSION),
  champion: championSchema,
  kleos: z.number().int().min(1000).max(4000),
  vigor: z.number().int().min(0).max(12),
  vigorDate: z.string().length(10),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  totalFights: z.number().int().min(0),
  /** Opaque to the server: look, portrait, gear, quests — the client's own. */
  presentation: z.record(z.unknown()),
});

export type Save = z.infer<typeof saveSchema>;
export type ChampionRecord = z.infer<typeof championSchema>;

/* ------------------------------------------------------------------ */
/* Router inputs                                                       */
/* ------------------------------------------------------------------ */

/**
 * Every mutation carries an idempotency key (schema doc §1 rule 11): a retry
 * on a flaky phone network must never write twice.
 */
export const idempotent = z.object({ idempotencyKey: z.string().uuid() });

export const pushSaveInput = idempotent.extend({
  save: saveSchema,
  /**
   * Optimistic concurrency: the version the client last saw. The server
   * rejects a push built on a stale read rather than silently clobbering a
   * save made on another device — the failure mode that makes players
   * distrust cloud saves.
   */
  baseVersion: z.number().int().nonnegative(),
});

export const pullSaveOutput = z.object({
  save: saveSchema.nullable(),
  version: z.number().int().nonnegative(),
  updatedAt: z.string().datetime().nullable(),
});

export type PushSaveInput = z.infer<typeof pushSaveInput>;
export type PullSaveOutput = z.infer<typeof pullSaveOutput>;

/** Stable codes so the client can react without parsing prose. */
export const ERROR = {
  STALE_SAVE: "STALE_SAVE",
  NAME_TAKEN: "NAME_TAKEN",
  RATE_LIMITED: "RATE_LIMITED",
} as const;
export type ErrorCode = (typeof ERROR)[keyof typeof ERROR];
