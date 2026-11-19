/**
 * The one way a tool opens a browser (work package 0).
 *
 *   import { withBrowser, openPage, settle, PHONE } from "./lib/browser.mjs";
 *   await withBrowser(async (browser) => {
 *     const page = await openPage(browser, PHONE);
 *     await page.goto(url);
 *     await settle(page);
 *     ...
 *   });
 *
 * Rules it enforces:
 *   - One browser at a time on this machine. A lock file in the system temp folder is taken
 *     before the launch and removed after the close. Lanes work in separate worktrees, so the
 *     lock must live outside the repo.
 *   - The installed Chrome, headless (`channel: "chrome"`). No browser is downloaded.
 *   - The browser is closed in `finally`, also when the tool throws.
 *
 * A lock left by a process that died is taken over: its pid no longer runs, or it is older
 * than `staleMs`.
 */
import { closeSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const LOCK_FILE = join(tmpdir(), "rankzero-browser.lock");
export const PHONE = { width: 390, height: 844, deviceScaleFactor: 2 };
export const DESKTOP = { width: 1280, height: 800, deviceScaleFactor: 1 };
export const NARROW = { width: 320, height: 720, deviceScaleFactor: 2 };
/** A phone on its side: the fight screen fills it (the stage only, owner 19 Nov 2026). */
export const TURNED = { width: 844, height: 390, deviceScaleFactor: 2 };

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === "EPERM";
  }
}

function readLock(lockFile) {
  try {
    return JSON.parse(readFileSync(lockFile, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Takes the lock, waiting for another holder. Returns a function that gives it back.
 * @param {{ lockFile?: string, timeoutMs?: number, staleMs?: number, pollMs?: number }} [opts]
 * @returns {Promise<() => void>}
 */
export async function acquireLock(opts = {}) {
  const { lockFile = LOCK_FILE, timeoutMs = 10 * 60_000, staleMs = 20 * 60_000, pollMs = 500 } = opts;
  const started = Date.now();
  for (;;) {
    try {
      const fd = openSync(lockFile, "wx");
      writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now(), cwd: process.cwd() }));
      closeSync(fd);
      let held = true;
      const release = () => {
        if (!held) return;
        held = false;
        const lock = readLock(lockFile);
        if (lock === null || lock.pid === process.pid) rmSync(lockFile, { force: true });
        process.off("exit", release);
      };
      process.once("exit", release);
      return release;
    } catch (error) {
      if (!error || error.code !== "EEXIST") throw error;
    }
    const lock = readLock(lockFile);
    const stale = lock === null || typeof lock.pid !== "number" || !alive(lock.pid) || Date.now() - (lock.at ?? 0) > staleMs;
    if (stale) {
      rmSync(lockFile, { force: true });
      continue;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`browser lock: still held by pid ${lock.pid} (${lock.cwd}) after ${Math.round(timeoutMs / 1000)} s`);
    }
    await sleep(pollMs);
  }
}

/**
 * Runs `fn(browser)` with the one allowed browser and always closes it.
 * @template T
 * @param {(browser: import("playwright-core").Browser) => Promise<T>} fn
 * @param {{ headless?: boolean, args?: string[], lockTimeoutMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function withBrowser(fn, opts = {}) {
  const release = await acquireLock({ timeoutMs: opts.lockTimeoutMs });
  let browser;
  try {
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({
      channel: "chrome",
      headless: opts.headless ?? true,
      args: ["--hide-scrollbars", "--mute-audio", ...(opts.args ?? [])],
    });
    return await fn(browser);
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      release();
    }
  }
}

/** A page at a fixed size. Sizes: PHONE (390 x 844 at scale 2), DESKTOP (1280 x 800), NARROW (320 wide). */
export async function openPage(browser, size = PHONE, opts = {}) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.deviceScaleFactor ?? 1,
    reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
  });
  return context.newPage();
}

/** Wait after a navigation before a screenshot. A hidden page paints late; 800 ms was the measured need. */
export async function settle(page, ms = 800) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(ms);
}
