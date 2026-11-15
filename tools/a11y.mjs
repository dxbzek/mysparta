#!/usr/bin/env node
/**
 * Computed contrast and tap-target sizes on every app screen (work package 5, acceptance 19),
 * in real Chrome at 390 x 844.
 *
 *   pnpm a11y [--url <base>]          (--plant adds a known fault, to see the check fail)
 *
 * Contrast: every visible text node's colour against the first solid background behind it
 * (background images such as halftone dots are ignored; the token pairs underneath are what the
 * dots sit on). Text inside a disabled control or a dimmed "not taken" card is skipped: WCAG
 * exempts inactive parts. Limit 4.5:1 for all text (brief 3.15).
 * Tap targets: every button, link, input, select, textarea and tab must be 44 x 44 px or more.
 * Exit code 1 when anything fails.
 */
import { PHONE, openPage, settle, withBrowser } from "./lib/browser.mjs";
import { ENTRY, startApp } from "./session.mjs";

function audit() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
    }
    let out = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) out = blend(layers[i], out);
    return out;
  };
  const inactive = (el) => {
    for (let e = el; e; e = e.parentElement) {
      if (e.disabled || e.getAttribute?.("aria-disabled") === "true" || e.getAttribute?.("aria-hidden") === "true") return true;
      if (parseFloat(getComputedStyle(e).opacity) < 1) return true;
    }
    return false;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const contrast = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || !n.textContent.trim() || !visible(el) || inactive(el)) continue;
    if (el.closest("canvas, svg, textarea, [class*='visuallyHidden'], .rz-visually-hidden")) continue;
    const fg = parse(getComputedStyle(el).color);
    if (!fg) continue;
    const bg = bgOf(el);
    const a = lum(blend(fg, bg)) + 0.05;
    const b = lum(bg) + 0.05;
    const ratio = Math.max(a, b) / Math.min(a, b);
    if (ratio < 4.5) contrast.push(`${ratio.toFixed(2)}:1 "${n.textContent.trim().slice(0, 30)}"`);
  }
  const taps = [];
  for (const el of document.querySelectorAll("button, a[href], input, select, textarea, [role=tab], [role=button]")) {
    if (!visible(el) || el.closest("[aria-hidden='true']")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) taps.push(`${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`);
  }
  return { contrast: [...new Set(contrast)], taps: [...new Set(taps)] };
}

async function main() {
  const app = await startApp();
  const base = `${app.url}${ENTRY}`;
  const results = [];
  try {
    await withBrowser(async (browser) => {
      const page = await openPage(browser, PHONE);
      const btn = (name) => page.getByRole("button", { name, exact: true });
      const check = async (name) => {
        await page.waitForTimeout(600);
        const r = await page.evaluate(audit);
        results.push({ name, ...r });
        const bad = r.contrast.length + r.taps.length;
        console.log(`${bad ? "FAIL" : "ok  "}  ${name}${r.contrast.length ? `\n      contrast: ${r.contrast.join("; ")}` : ""}${r.taps.length ? `\n      tap targets: ${r.taps.join("; ")}` : ""}`);
      };
      const hash = (h) => page.evaluate((x) => { location.hash = x; }, h);
      await page.goto(`${base}#/`);
      await settle(page);
      await page.locator("#rz-name").fill("Dez");
      if (process.argv.includes("--plant")) {
        // planted-fault control: one low-contrast line and one small button must be reported
        await page.evaluate(() => document.body.insertAdjacentHTML("afterbegin", "<p style='color:#aaa;background:#fff'>planted grey text</p><button style='width:20px;height:20px'>x</button>"));
      }
      await check("create");
      await btn("Step into the Yard").click();
      await btn("To the Locker").waitFor({ timeout: 10000 });
      await check("reveal");
      await btn("To the Locker").click();
      await page.waitForURL(/#\/locker$/);
      await check("locker");
      await hash("#/settings");
      await check("settings");
      for (let i = 0; i < 4; i++) {
        await hash("#/locker");
        await page.waitForTimeout(400);
        if (await btn("Level up!").count()) break;
        await page.getByRole("button", { name: /^Fight \(\d+ bouts? left\)$/ }).click();
        await page.locator("button[aria-label$='Open the face-off.']").first().waitFor();
        if (i === 0) await check("card");
        await page.locator("button[aria-label$='Open the face-off.']").nth(i).click();
        if (i === 0) await check("face-off");
        await page.getByRole("dialog", { name: "Face-off" }).getByRole("button", { name: "Fight", exact: true }).click();
        await page.waitForURL(/#\/bout\//);
        if (i === 0) await check("bout (fight-screen lane)");
        await page.getByRole("button", { name: "Skip to the end" }).click();
        await page.getByRole("region", { name: "Result" }).waitFor();
        if (i === 0) await check("bout result (fight-screen lane)");
        await page.getByRole("region", { name: "Result" }).getByRole("button", { name: "Locker", exact: true }).click();
      }
      if (await btn("Level up!").count()) {
        await btn("Level up!").click();
        await page.waitForURL(/#\/levelup$/);
        await check("level-up");
        await page.locator("button[aria-label$='Select this card.']").first().click();
        await btn("Take it").click();
        await check("level-up taken");
      }
      for (const h of ["#/kit", "#/kit/route", "#/kit/stats", "#/bouts", "#/inventory"]) {
        await hash(h);
        await check(h);
      }
      await page.locator("button[data-state='unlocked']").first().click();
      await check("inventory item sheet");
      await page.keyboard.press("Escape");
      await page.locator("button[data-state='locked']").first().click();
      await check("inventory locked item sheet");
      await page.keyboard.press("Escape");
    });
  } finally {
    app.stop();
  }
  const failed = results.filter((r) => r.contrast.length || r.taps.length);
  console.log(`\n${results.length} screens checked, ${failed.length} with problems.`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
