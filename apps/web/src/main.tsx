/**
 * SEAM FILE (work package 0). Only the Lead edits it, at integration points.
 *   I1: #/debug/ routes mount the debug pages.  I2 (now): everything else mounts the app.
 * The debug pages are their own chunk (loaded only on a #/debug/ hash), so the first screen's
 * JS stays inside its 180 KB budget.
 */
import { isDebugHash } from "./debug/route";
import { mountApp } from "./app/App";

const root = document.getElementById("root")!;
if (isDebugHash(location.hash)) {
  void import("./debug/mount").then((m) => m.mountDebug(root));
} else {
  mountApp(root);
}
