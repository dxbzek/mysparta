/**
 * Parity page (work package 1). Runs the 180 golden bouts in whatever engine loads it, hashes each
 * canonical log with WebCrypto SHA-256 and compares with the stored digests. The same module runs
 * in Node (tools/parity/run.mjs imports the built bundle) and in headless Chromium and WebKit.
 */
import { simulateFight } from "../../packages/core/src/sim/simulate";
import { canonical } from "../../packages/core/src/canonical";
import { goldenBouts } from "../../packages/core/test/golden/scenarios";
import stored from "../../packages/core/test/golden/digests.json";

export interface ParityResult { engine: string; compared: number; mismatches: string[]; digests: Record<string, string[]> }

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function runParity(engine: string, want: Record<string, string[]> = stored as Record<string, string[]>): Promise<ParityResult> {
  const digests: Record<string, string[]> = {};
  const mismatches: string[] = [];
  let compared = 0;
  for (const g of goldenBouts()) {
    const d = await sha256(canonical(simulateFight(g.seed, g.a, g.b, 1)));
    (digests[g.scenario] ??= []).push(d);
    const expected = want[g.scenario]?.[g.i];
    if (expected === undefined) mismatches.push(`${g.scenario} #${g.i}: no stored digest`);
    else if (expected !== d) mismatches.push(`${g.scenario} #${g.i}: ${d} != ${expected}`);
    compared += 1;
  }
  return { engine, compared, mismatches, digests };
}

declare global {
  // eslint-disable-next-line no-var
  var __runParity: typeof runParity | undefined;
  // eslint-disable-next-line no-var
  var __parity: ParityResult | undefined;
}
globalThis.__runParity = runParity;

if (typeof document !== "undefined") {
  const out = document.getElementById("out");
  void runParity(navigator.userAgent).then((r) => {
    globalThis.__parity = r;
    if (out !== null) out.textContent = `${r.compared} compared, ${r.mismatches.length} mismatches\n${r.mismatches.join("\n")}`;
  });
}
