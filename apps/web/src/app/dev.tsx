/**
 * Dev-only entry for src/app/dev.html. `?shift=<days>` moves the device clock, so the session
 * script can check the day rollover (acceptance 13) in a real browser.
 */
import { deviceClock } from "../state/day";
import { mountApp } from "./App";

const shift = Number(new URLSearchParams(location.search).get("shift") ?? "0");
mountApp(document.getElementById("root")!, { clock: deviceClock(Number.isFinite(shift) ? shift * 86_400_000 : 0) });
