#!/usr/bin/env node
/**
 * Screenshots of every app screen (work package 5, acceptance 18) at 390 x 844, 1280 x 800 and
 * 320 wide, from a real session in real Chrome. Each shot is also measured: horizontal scroll of
 * the page, and any visible text box whose content is wider than its box (clipped text).
 *
 *   pnpm shots                    all three sizes
 *   pnpm shots --size phone       one size: phone | desktop | narrow
 *   pnpm shots --url <base>       use a running dev server
 *
 * Output: <main checkout>/.review/wp5/shots/<size>/<nn>-<screen>.png and a report.json. The
 * author must OPEN every image: the measurements catch scroll and clipping, not ugliness.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DESKTOP, NARROW, PHONE, openPage, settle, withBrowser } from "./lib/browser.mjs";
import { ENTRY, startApp } from "./session.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};
function mainCheckout() {
  try {
    return dirname(execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: ROOT, encoding: "utf8" }).trim());
  } catch {
    return ROOT;
  }
}
/** RZ_SHOTS_OUT sends the shots somewhere else (a scratch folder), so a worktree run writes nothing
 *  into the main checkout. */
export const OUT = process.env.RZ_SHOTS_OUT ? resolve(process.env.RZ_SHOTS_OUT) : resolve(mainCheckout(), ".review/wp5/shots");
const SIZES = { phone: PHONE, desktop: DESKTOP, narrow: NARROW };

/** Horizontal scroll, and text that does not fit its box. Runs in the page. */
export function measure() {
  const vw = document.documentElement.clientWidth;
  const hScroll = document.documentElement.scrollWidth > vw + 1;
  const clipped = [];
  const outside = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (el.closest("[aria-hidden='true']")) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText && (cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1) {
      clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}: "${el.textContent.trim().slice(0, 40)}"`);
    }
    if (hasText && (r.right > vw + 1 || r.left < -1) && cs.position !== "fixed") outside.push(`${el.tagName.toLowerCase()}: "${el.textContent.trim().slice(0, 40)}"`);
  }
  return { hScroll, clipped: clipped.slice(0, 8), outside: outside.slice(0, 8) };
}

async function shoot(browser, sizeName, base) {
  const size = SIZES[sizeName];
  const dir0 = join(OUT, sizeName);
  const ctx = { page: null };
  try {
    return await shootInner(browser, sizeName, base, ctx);
  } catch (e) {
    if (ctx.page) await ctx.page.screenshot({ path: join(dir0, "error.png"), fullPage: true }).catch(() => undefined);
    console.error(`shots: failed at ${ctx.page?.url()}`);
    throw e;
  }
}

async function shootInner(browser, sizeName, base, ctx) {
  const size = SIZES[sizeName];
  const dir = join(OUT, sizeName);
  mkdirSync(dir, { recursive: true });
  const page = await openPage(browser, size);
  ctx.page = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const report = [];
  let n = 0;
  const btn = (name) => page.getByRole("button", { name, exact: true });
  const hash = async (h) => {
    await page.evaluate((x) => { location.hash = x; }, h);
    await page.waitForTimeout(500);
  };
  /** Sheets are fixed to the viewport, so they are shot as the viewport; screens as the full page. */
  const shot = async (name, wait = 500) => {
    await page.waitForTimeout(wait);
    const file = join(dir, `${String(++n).padStart(2, "0")}-${name}.png`);
    const sheet = await page.locator("[role=dialog][aria-hidden=false]").count();
    await page.screenshot({ path: file, fullPage: sheet === 0 });
    const m = await page.evaluate(measure);
    report.push({ size: sizeName, name, file, ...m });
    const bad = m.hScroll || m.clipped.length || m.outside.length;
    console.log(`${bad ? "CHECK" : "ok   "} ${sizeName.padEnd(7)} ${name}${m.hScroll ? "  horizontal scroll" : ""}${m.clipped.length ? `  clipped: ${m.clipped.join("; ")}` : ""}${m.outside.length ? `  outside: ${m.outside.join("; ")}` : ""}`);
  };
  const rival = () => page.locator("button[aria-label$='Open the face-off.']");
  const faceFight = () => page.getByRole("dialog", { name: "Face-off" }).getByRole("button", { name: "Fight", exact: true });
  const result = () => page.getByRole("region", { name: "Result" });

  /** From the Locker: play one bout to its result card. */
  const playOne = async (i) => {
    await page.getByRole("button", { name: "Fight", exact: true }).click();
    await rival().nth(i % 6).click();
    await faceFight().click();
    await page.waitForURL(/#\/bout\//);
    await page.getByRole("button", { name: "Skip to the end" }).click();
    await result().waitFor({ timeout: 15000 });
    await page.waitForTimeout(200);
  };
  const takeLevelUp = async (i) => {
    await page.locator("button[aria-label$='Select this card.']").nth(i % 2).click();
    await btn("Take it").click();
    const more = btn("Next level up");
    await Promise.race([more.waitFor(), btn("Back to the Locker").waitFor()]);
    if (await more.count()) {
      await more.click();
      return takeLevelUp(i + 1);
    }
    await btn("Back to the Locker").click();
  };

  // Create
  await page.goto(`${base}#/`);
  await settle(page);
  await shot("create-empty", 300);
  await page.locator("#rz-name").fill("Marla");
  await shot("create");
  await btn("Step into the Yard").click();
  await shot("reveal-playing", 1600);
  await btn("To the Locker").waitFor({ timeout: 10000 });
  await shot("reveal", 200);
  await btn("To the Locker").click();
  await page.waitForURL(/#\/locker$/);
  await shot("locker");
  await hash("#/settings");
  await shot("settings");
  await hash("#/locker");
  // Card and face-off
  await page.getByRole("button", { name: "Fight", exact: true }).click();
  await rival().first().waitFor();
  await shot("card");
  await rival().first().click();
  await shot("faceoff", 600);
  await faceFight().click();
  await page.waitForURL(/#\/bout\//);
  await shot("bout", 2600);
  await page.getByRole("button", { name: "Skip to the end" }).click();
  await result().waitFor();
  await shot("bout-result", 1500);
  // play on until a level-up waits
  let played = 1;
  for (let guard = 0; guard < 10; guard++) {
    if (await result().getByRole("button", { name: "Level up!", exact: true }).count()) break;
    await result().getByRole("button", { name: "Locker", exact: true }).click();
    await page.waitForURL(/#\/locker$/);
    await playOne(played++);
  }
  await result().getByRole("button", { name: "Level up!", exact: true }).click();
  await page.waitForURL(/#\/levelup$/);
  await shot("levelup", 700);
  await page.locator("button[aria-label$='Select this card.']").first().click();
  await shot("levelup-selected", 400);
  await btn("Take it").click();
  await shot("levelup-taken", 600);
  const more = btn("Next level up");
  if (await more.count()) {
    await more.click();
    await takeLevelUp(1);
  } else await btn("Back to the Locker").click();
  // spend the rest of the energy bar
  for (let guard = 0; guard < 12; guard++) {
    await page.waitForURL(/#\/locker$/);
    await page.getByText(/Out of energy|^Fight$|^Level up!$/).first().waitFor();
    if (await page.getByText(/Out of energy/).count()) break;
    if (await btn("Level up!").count()) {
      await btn("Level up!").click();
      await takeLevelUp(guard);
      continue;
    }
    await playOne(played++);
    const lvl = result().getByRole("button", { name: "Level up!", exact: true });
    if (await lvl.count()) {
      await lvl.click();
      await takeLevelUp(guard);
    } else {
      await result().getByRole("button", { name: "Locker", exact: true }).click();
    }
  }
  await shot("locker-done");
  await page.locator("[class*='kitButton']").first().click().catch(() => undefined);
  await shot("locker-perk", 500);
  await page.keyboard.press("Escape");
  await hash("#/kit");
  await shot("kit");
  await page.locator("main section button[aria-label]").first().click();
  await shot("kit-perk", 500);
  await page.keyboard.press("Escape");
  await btn("Retire this scrapper").click();
  await shot("kit-retire", 500);
  await page.keyboard.press("Escape");
  await hash("#/kit/talents");
  await shot("kit-talents");
  await page.locator("button[data-talent]").first().click();
  await shot("kit-talent-node", 500);
  await page.keyboard.press("Escape");
  await hash("#/kit/route");
  await shot("kit-route");
  await hash("#/kit/stats");
  await shot("kit-stats");
  // Inventory: the Kit's "Found N of 92" opens it; then the tab, filters, and both sheets
  await hash("#/kit");
  await page.locator("button", { hasText: /Found \d+ of \d+/ }).first().click();
  await page.waitForURL(/#\/inventory$/);
  await shot("inventory", 1500);
  await page.locator("button[data-state='unlocked']").first().click();
  await shot("inventory-item", 600);
  await page.keyboard.press("Escape");
  await page.locator("button[data-state='locked']").first().click();
  await shot("inventory-locked-item", 600);
  await page.keyboard.press("Escape");
  await page.getByRole("group", { name: "Show" }).getByRole("button", { name: "Weapons", exact: true }).click();
  await shot("inventory-weapons", 300);
  const weapon = page.locator("button[data-state='unlocked']").first();
  if (await weapon.count()) {
    await weapon.click();
    await shot("inventory-weapon-item", 900);
    await page.keyboard.press("Escape");
  }
  await page.getByRole("group", { name: "Show" }).getByRole("button", { name: "All", exact: true }).click();
  await btn("Show locked").click();
  await shot("inventory-unlocked-only", 300);
  await btn("Show locked").click();
  await hash("#/bouts");
  await shot("history");
  await page.locator("button[aria-label^='Replay the bout with']").first().click();
  await shot("replay", 2500);
  // two hours later (a full bar again): a bout left unwatched by a reload
  await page.goto(`${base.replace(ENTRY, `${ENTRY}?shift=0.1`)}#/locker`);
  await settle(page);
  if (await btn("Level up!").count()) {
    await btn("Level up!").click();
    await takeLevelUp(0);
  }
  await page.getByRole("button", { name: "Fight", exact: true }).click();
  await rival().first().click();
  await faceFight().click();
  await page.waitForURL(/#\/bout\//);
  await page.goto(`${base.replace(ENTRY, `${ENTRY}?shift=0.1`)}#/locker`);
  await settle(page);
  await shot("last-bout-finished");
  await page.goto(`${base}#/sandbox`);
  await settle(page);
  await shot("sandbox");
  // an unreadable save, in a fresh context
  const fresh = await openPage(browser, size);
  await fresh.goto(`${base}#/`);
  await settle(fresh);
  await fresh.evaluate(() => new Promise((done) => {
    const r = indexedDB.open("rankzero.save", 1);
    r.onsuccess = () => {
      const tx = r.result.transaction("kv", "readwrite");
      tx.objectStore("kv").put("{damaged bytes", "rankzero.slot.0");
      tx.oncomplete = () => { r.result.close(); done(); };
    };
  }));
  await fresh.reload();
  await settle(fresh);
  const file = join(dir, `${String(++n).padStart(2, "0")}-unreadable.png`);
  await fresh.screenshot({ path: file, fullPage: true });
  report.push({ size: sizeName, name: "unreadable", file, ...(await fresh.evaluate(measure)) });
  console.log(`ok    ${sizeName.padEnd(7)} unreadable`);
  if (errors.length) console.log(`page errors (${sizeName}): ${errors.join(" | ")}`);
  return { report, errors };
}

async function main() {
  const only = arg("size");
  const sizes = only ? [only] : ["phone", "desktop", "narrow"];
  const app = await startApp();
  const all = [];
  let errors = 0;
  try {
    await withBrowser(async (browser) => {
      for (const s of sizes) {
        const r = await shoot(browser, s, `${app.url}${ENTRY}`);
        all.push(...r.report);
        errors += r.errors.length;
      }
    });
  } finally {
    app.stop();
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "report.json"), JSON.stringify(all, null, 2));
  const scroll = all.filter((r) => r.hScroll).length;
  const clipped = all.filter((r) => r.clipped.length || r.outside.length).length;
  console.log(`\n${all.length} screenshots in ${OUT}. Horizontal scroll: ${scroll}. Clipped or outside text: ${clipped}. Page errors: ${errors}.`);
  console.log("Open every image: the numbers do not judge the look.");
  process.exitCode = scroll || errors ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
