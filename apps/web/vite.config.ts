import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // @agoge/core ships TypeScript source; let Vite transform it directly.
  optimizeDeps: { exclude: ["@agoge/core"] },
  server: { port: 5173, host: true },
});
