/**
 * The cloud-save router: pull a champion down, push one up.
 *
 * The interesting part is not the CRUD, it is the two failure modes that make
 * players stop trusting a cloud save, both handled here:
 *
 *   - the same push arriving twice on a flaky network (idempotency keys), and
 *   - a save from a second device silently clobbering the first
 *     (optimistic concurrency on `version`, rejected as STALE_SAVE rather
 *     than merged behind the player's back).
 *
 * Storage sits behind the `Store` interface so this file is testable without a
 * database and portable if the project ever moves off Postgres.
 */

import { TRPCError } from "@trpc/server";
import { ERROR, pullSaveOutput, pushSaveInput, type PullSaveOutput, type Save } from "@agoge/protocol";
import { publicProcedure, router, type Context } from "../trpc.js";

export interface StoredSave {
  save: Save;
  version: number;
  updatedAt: string;
}

/** What the router needs from persistence — implemented over Postgres. */
export interface Store {
  getSave(profileId: string): Promise<StoredSave | null>;
  /** Writes only if `baseVersion` still matches; null means it did not. */
  putSave(profileId: string, save: Save, baseVersion: number): Promise<StoredSave | null>;
  /** Returns the recorded response if this key has already been handled. */
  seenIdempotencyKey(profileId: string, key: string): Promise<unknown | undefined>;
  recordIdempotencyKey(profileId: string, key: string, route: string, response: unknown): Promise<void>;
}

function requireProfile(ctx: Context): string {
  if (!ctx.profileId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "No profile on this request." });
  }
  return ctx.profileId;
}

export const saveRouter = router({
  pull: publicProcedure.output(pullSaveOutput).query(async ({ ctx }): Promise<PullSaveOutput> => {
    const profileId = requireProfile(ctx);
    const stored = await ctx.store.getSave(profileId);
    // A fresh account is not an error — it is a player who has not synced yet.
    if (!stored) return { save: null, version: 0, updatedAt: null };
    return { save: stored.save, version: stored.version, updatedAt: stored.updatedAt };
  }),

  push: publicProcedure.input(pushSaveInput).output(pullSaveOutput).mutation(async ({ ctx, input }) => {
    const profileId = requireProfile(ctx);

    // Replayed request: hand back exactly what the first attempt returned.
    const already = await ctx.store.seenIdempotencyKey(profileId, input.idempotencyKey);
    if (already !== undefined) return already as PullSaveOutput;

    const written = await ctx.store.putSave(profileId, input.save, input.baseVersion);
    if (!written) {
      // Someone else moved first. The client re-pulls and decides; the server
      // does not guess which champion the player meant to keep.
      throw new TRPCError({
        code: "CONFLICT",
        message: ERROR.STALE_SAVE,
      });
    }

    const response: PullSaveOutput = {
      save: written.save,
      version: written.version,
      updatedAt: written.updatedAt,
    };
    await ctx.store.recordIdempotencyKey(profileId, input.idempotencyKey, "save.push", response);
    return response;
  }),
});
