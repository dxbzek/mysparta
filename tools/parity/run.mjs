#!/usr/bin/env node
/**
 * Engine parity (work package 1). Run: pnpm parity [--engines node,chromium,webkit]
 *
 * Builds the parity page (tools/parity/index.html + main.ts) with Vite, then runs the 180 golden
 * bouts in each engine and compares every SHA-256 digest with packages/core/test/golden/digests.json
 * (the bundle carries the file as it was at build time). Fails unless every engine compared at
 * least 180 digests with no mismatch, and prints the count per engine.
 *
 * Browsers are Playwright's own Chromium and WebKit builds (CI installs them with
 * `playwright-core install`). One browser at a time, through the lock in tools/lib/browser.mjs.
 * The "node" engine needs no browser and runs the same bundle.
 */
import { createServer } from "node:http";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { acquireLock } from "../lib/browser.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const MIN = 180;
const args = process.argv.slice(2);
const at = args.indexOf("--engines");
const engines = (at >= 0 ? args[at + 1] : "node,chromium,webkit").split(",").map((e) => e.trim()).filter(Boolean);

// Vite lives in the web app's dependencies; the root package does not carry it.
const requireFromWeb = createRequire(join(ROOT, "apps", "web", "package.json"));
const { build } = await import(pathToFileURL(requireFromWeb.resolve("vite")).href);

const out = mkdtempSync(join(tmpdir(), "rankzero-parity-"));
let failed = false;
try {
  await build({
    root: HERE, base: "./", configFile: false, logLevel: "warn",
    build: { outDir: out, emptyOutDir: true, target: "es2022", minify: false, modulePreload: { polyfill: false } },
  });
  const assets = join(out, "assets");
  const bundle = readdirSync(assets).find((f) => f.endsWith(".js"));
  if (bundle === undefined) throw new Error("the parity build wrote no script");

  const results = [];
  for (const engine of engines) {
    if (engine === "node") {
      await import(pathToFileURL(join(assets, bundle)).href);
      results.push(await globalThis.__runParity("node"));
    } else {
      results.push(await inBrowser(engine, out));
    }
  }

  for (const r of results) {
    const ok = r.compared >= MIN && r.mismatches.length === 0;
    if (!ok) failed = true;
    console.log(`${ok ? "PASS" : "FAIL"} ${r.engine}: ${r.compared} digests compared, ${r.mismatches.length} mismatches`);
    for (const m of r.mismatches.slice(0, 10)) console.log(`  ${m}`);
    if (r.compared < MIN) console.log(`  fewer than ${MIN} digests compared`);
  }
  if (results.length !== engines.length) failed = true;
} finally {
  rmSync(out, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };

async function inBrowser(engine, dir) {
  const pw = await import("playwright-core");
  const type = pw[engine];
  if (type === undefined) throw new Error(`unknown engine "${engine}"`);
  const server = createServer((req, res) => {
    const path = join(dir, decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html");
    try {
      const body = readFileSync(path.endsWith("/") || path === dir ? join(dir, "index.html") : path);
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;
  const release = await acquireLock();
  let browser;
  try {
    browser = await type.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.waitForFunction(() => globalThis.__parity !== undefined, undefined, { timeout: 180000 });
    const r = await page.evaluate(() => globalThis.__parity);
    return { ...r, engine: `${engine} (${r.engine})` };
  } finally {
    if (browser !== undefined) await browser.close();
    release();
    server.close();
  }
}
