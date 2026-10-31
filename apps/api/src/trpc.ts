/**
 * tRPC wiring. The context carries the caller's profile (resolved from the
 * Supabase JWT by the Fastify plugin) and the storage layer, so procedures
 * never reach for a global.
 */
import { initTRPC } from "@trpc/server";
import type { Store } from "./routers/save.js";

export interface Context {
  /** null for an unauthenticated request — procedures decide if that is fatal. */
  profileId: string | null;
  store: Store;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
