/**
 * apps/api — Fastify + tRPC, per docs/04-technical-architecture.md §3.
 *
 * Stateless: every instance is interchangeable, all state lives in Postgres.
 * This is the cloud-save slice; the fight, ledger and phalanx routers join the
 * same appRouter as they are built.
 *
 * Not deployed. `pnpm --filter @agoge/api dev` runs it against DATABASE_URL.
 */
import { router } from "./trpc.js";
import { saveRouter } from "./routers/save.js";

export const appRouter = router({
  save: saveRouter,
});

/** The type the web client imports to get end-to-end inference. */
export type AppRouter = typeof appRouter;

export type { Store, StoredSave } from "./routers/save.js";
export type { Context } from "./trpc.js";
