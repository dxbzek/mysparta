/** Dev-only entry for src/debug/index.html (see mount.tsx). */
import { mountDebug } from "./mount";

if (!location.hash) location.hash = "#/debug/bout?fixture=bout-gate";
mountDebug(document.getElementById("root")!);
