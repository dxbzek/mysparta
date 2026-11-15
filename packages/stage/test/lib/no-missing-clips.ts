/**
 * Every stage test fails when the stage asks a rig for a clip it does not have (review finding
 * 20 and 53: a pet's "evade", a scrapper's "run"). The rigs warn once ("[rig] no clip ...",
 * "[capsuleRig] no clip ...") and play idle, which hides a sliding body; here that warning ends
 * the test that caused it.
 *
 * The one allowed case: the stage's footwork clips on a test double (the capsule rig) or on a rig
 * built from the gate pack alone (named by that test with `allowMissingClips`), which footwork.ts
 * documents as playing idle with the same timing.
 */
import { afterEach } from "vitest";

/** The footwork clips a test double may lack: the stage plays idle there with the same timing
 *  (footwork.ts). Allowed for the capsule test rig only. */
export const FOOTWORK: ReadonlySet<string> = new Set(["dash-push", "brake", "shuffle", "slip"]);
const MISSING =/no clip "([^"]+)" for (?:rig "([^"]+)"|the (scrapper))/;
let allowed = new Set<string>();
let seen: string[] = [];
const original = console.warn.bind(console);

console.warn = (...args: unknown[]): void => {
  const text = args.map(String).join(" ");
  const m = MISSING.exec(text);
  const fallback = text.includes("[capsuleRig]") && FOOTWORK.has(m?.[1] ?? "");
  if (m !== null && !allowed.has(m[1]!) && !fallback) seen.push(text);
  original(...args);
};

/** Clip names this test may ask for although its rig lacks them (call it in the test file). */
export function allowMissingClips(names: readonly string[]): void {
  allowed = new Set([...allowed, ...names]);
}

// a warning from building a player outside a test (at collection) fails the file's first test
afterEach(() => {
  const found = seen;
  seen = [];
  if (found.length > 0) throw new Error(`the stage asked for clips the rig does not have:\n${found.join("\n")}`);
});
