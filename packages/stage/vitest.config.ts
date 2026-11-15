import { defineConfig } from "vitest/config";

// Ground rule 7 of the build plan: two workers, 30 s per test.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // a clip the rig does not have fails the test (lib/no-missing-clips.ts)
    setupFiles: ["test/lib/no-missing-clips.ts"],
    minWorkers: 1,
    maxWorkers: 2,
    testTimeout: 30000,
  },
});
