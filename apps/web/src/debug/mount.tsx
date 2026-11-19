/**
 * Mounts the debug pages. The Lead's `main.tsx` calls `mountDebug(root)` when the hash starts
 * with `#/debug/` (the I1 integration step). Until then `src/debug/index.html` is a dev-only
 * entry that loads this module directly, so the fight screen can be recorded before I1.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../tokens.css";
import { DebugApp } from "./DebugApp";

export { isDebugHash } from "./route";

export function mountDebug(root: HTMLElement): void {
  createRoot(root).render(
    <StrictMode>
      <DebugApp />
    </StrictMode>,
  );
}
