/**
 * SEAM FILE (work package 0). Only the Lead edits it, at integration points.
 *   I1: #/debug/ routes mount the debug pages.  I2 (now): everything else mounts the app.
 */
import { isDebugHash, mountDebug } from "./debug/mount";
import { mountApp } from "./app/App";

const root = document.getElementById("root")!;
if (isDebugHash(location.hash)) {
  mountDebug(root);
} else {
  mountApp(root);
}
