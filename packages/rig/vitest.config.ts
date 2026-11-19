import { defineConfig } from "vitest/config";

// Ground rule 7 of the build plan: two workers. 120 s per test and hook (round-2 close: the slow
// stage and sim tests take 10 to 27 s alone and failed a full `pnpm test` on timeouts under load).
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    minWorkers: 1,
    maxWorkers: 2,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
