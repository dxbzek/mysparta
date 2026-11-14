import { defineConfig } from "vitest/config";

// Ground rule 7 of the build plan: two workers, 30 s per test.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    minWorkers: 1,
    maxWorkers: 2,
    testTimeout: 30000,
  },
});
