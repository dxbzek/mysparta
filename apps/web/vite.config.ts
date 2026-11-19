import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the build works at any path (a Pages subpath, a LAN preview).
  base: "./",
  plugins: [react()],
  // The workspace packages ship TypeScript source. Vite transforms them directly.
  optimizeDeps: { exclude: ["@rankzero/core", "@rankzero/rig", "@rankzero/stage"] },
  // PORT comes from the launcher when 5173 is taken. Nothing here needs a fixed port.
  server: {
    port:
      Number((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.PORT) ||
      5173,
    host: true,
  },
});
