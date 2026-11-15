#!/usr/bin/env node
/**
 * Record a bout from the real fight screen in real Chrome (fight-screen lane).
 *
 *   pnpm record-bout --fixture bout-gate                 frame-exact video at 1x, 60 fps
 *   pnpm record-bout --fixture bout-gate --audio         ... with the cue list mixed in as sound
 *   pnpm record-bout --fixture bout-gate --realtime      plays in real time with 4x CPU throttle, reports frame times
 *   pnpm record-bout --shots                             screenshots: fight screen at set times, Locker mock, UI parts
 *   pnpm record-bout --seed 123                          needs the sim (after I1)
 *
 * How the video is made: the dev server serves the debug entry (src/debug/index.html); the tool
 * opens #/debug/bout paused, waits 800 ms after navigation and for window.__rz.ready, then for
 * every frame calls __rz.seek(i x 1000 / fps) and takes Page.captureScreenshot of the 390 x 844
 * page at clip.scale 2 (780 x 1688 pixels; the page itself runs at device scale 2, so the canvas is sharp), and pipes the frames to ffmpeg. A seek plays no
 * sound, so the audio track (--audio) is mixed in Node from sfx.mp3, sfx.json and the cue list:
 * each cue at its `at` (scaled by --speed). The mix is checked: every impact cue at or after its
 * contact, no two impact cues within 60 ms, the peak below clipping, and the longest silence.
 * An agent cannot hear: a person must still listen (brief 3.13).
 *
 * Flags: --fixture <name> | --seed <n> | --find <n> --level <L> (a find-bout candidate), --speed 1|2|3,
 * --at <ms,ms,...> extra phone shots [--only-at], --out-dir <dir>, --fps <n> (60), --out <file.mp4>,
 * --reduced, --audio, --realtime [--seconds 8], --shots, --port <n>, --copy-to <file>.
 * Output defaults to <main checkout>/.review/wp4/.
 */
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PHONE, DESKTOP, NARROW, openPage, settle, withBrowser } from "./lib/browser.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(ROOT, "apps/web");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

function mainCheckout() {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: ROOT, encoding: "utf8" }).trim();
    return dirname(common);
  } catch {
    return ROOT;
  }
}
const OUT_DIR = resolve(arg("out-dir", resolve(mainCheckout(), ".review/wp4")));

const freePort = () => new Promise((done, fail) => {
  const s = createServer();
  s.once("error", fail);
  s.listen(0, "127.0.0.1", () => {
    const { port } = s.address();
    s.close(() => done(port));
  });
});

async function startServer() {
  const port = Number(arg("port", 0)) || (await freePort());
  const vite = join(WEB, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [vite, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: WEB, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } });
  let log = "";
  child.stdout.on("data", (d) => { log += d; });
  child.stderr.on("data", (d) => { log += d; });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${url}/src/debug/index.html`);
      if (res.ok) return { url, stop: () => child.kill() };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`vite did not start:\n${log}`);
}

function debugUrl(base, extra) {
  const fixture = arg("fixture");
  const seed = arg("seed");
  const find = arg("find");
  const q = new URLSearchParams();
  if (find) { q.set("find", find); q.set("level", arg("level", "1")); }
  else if (seed) q.set("seed", seed); else q.set("fixture", fixture ?? "bout-gate");
  if (flag("reduced")) q.set("reduced", "1");
  for (const [k, v] of Object.entries(extra)) q.set(k, String(v));
  return `${base}/src/debug/index.html#/debug/bout?${q}`;
}

async function waitReady(page) {
  await settle(page, 800);
  await page.waitForFunction(() => window.__rz && window.__rz.ready === true, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

async function overflowReport(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const bad = [];
    for (const el of document.querySelectorAll("button, a, input, [role=button]")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      if (r.width < 44 || r.height < 44) bad.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const clipped = [];
    for (const el of document.querySelectorAll("span, h1, h2, p, li, button")) {
      if (el.children.length > 0 && el.tagName !== "BUTTON") continue;
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible" && el.clientWidth > 0) clipped.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}"`);
    }
    // text that leaves the viewport (a parent with overflow: hidden would hide it from scrollWidth)
    const offscreen = [];
    const vw = window.innerWidth;
    for (const el of document.querySelectorAll("span, h1, h2, p, li, button, [data-hp]")) {
      if (el.children.length > 0 && el.tagName !== "BUTTON") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || getComputedStyle(el).visibility === "hidden") continue;
      if (r.right > vw + 1 || r.left < -1) offscreen.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    // the two HUD halves and the two HP numbers must not overlap
    const overlap = [];
    const boxes = (sel) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect());
    for (const sel of ["[data-hp]", "[data-side] > div:first-child"]) {
      const [p, q] = boxes(sel);
      if (p && q && p.right > q.left && q.right > p.left && p.bottom > q.top && q.bottom > p.top) overlap.push(sel);
    }
    // controls hidden below the fold or under another element (owner: "some UI not visible")
    const hidden = [];
    for (const el of document.querySelectorAll("button, [role=meter], input")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || getComputedStyle(el).visibility === "hidden" || el.closest("[aria-hidden=true]")) continue;
      if (r.bottom > window.innerHeight + 1 || r.top < -1) { hidden.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24)}" below the fold`); continue; }
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && !el.contains(hit) && !hit.contains(el)) hidden.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? "").slice(0, 24)}" covered by ${hit.className || hit.tagName}`);
    }
    return { pageScrollX: doc.scrollWidth > doc.clientWidth, pageScrollY: document.scrollingElement.scrollHeight > window.innerHeight + 1, smallTargets: bad, clipped, offscreen, overlap, hidden };
  });
}

// ------------------------------------------------------------------ audio mix (Node)

function decodeMp3(file, rate) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4).slice();
}

async function mixCues({ cues, contacts, durationMs, speed }) {
  const RATE = 44100;
  const map = JSON.parse(readFileSync(join(WEB, "public/audio/sfx.json"), "utf8"));
  const sprites = map.files.map((f) => decodeMp3(join(WEB, "public/audio", f), RATE));
  // the same pick as the fight screen: the cue item's own set, else the family's (needs tsx)
  const { soundFor } = await import("../apps/web/src/audio/cues.ts");
  const listOf = (name) => map.sets[name] ?? map.sets[map.families[name]];
  const size = (name) => listOf(name)?.length ?? 0;
  const out = new Float32Array(Math.ceil(((durationMs / speed) / 1000 + 2) * RATE));
  const IMPACT = new Set(["fist", "blunt", "blade", "block"]);
  const problems = [];
  let lastImpact = -Infinity;
  const spans = [];
  for (const c of cues) {
    const pick = soundFor(c, size);
    const e = pick === null ? undefined : listOf(pick.name)?.[pick.variant];
    if (!e) { problems.push(`no sound for ${c.family}[${c.variant}] ${c.item ?? ""}`); continue; }
    const sprite = sprites[e.f ?? 0];
    if (IMPACT.has(c.family)) {
      const mark = contacts.find((m) => m.step === c.step);
      if (!mark) problems.push(`impact cue at ${c.at} ms (step ${c.step}) has no contact mark`);
      else if (c.at < mark.at) problems.push(`impact cue at ${c.at} ms is before its contact at ${mark.at} ms`);
      if (c.at - lastImpact < 60) problems.push(`impact cues ${lastImpact} and ${c.at} ms are closer than 60 ms`);
      lastImpact = c.at;
    }
    const at = Math.round(((c.at / speed) / 1000) * RATE);
    const from = Math.round((e.start / 1000) * RATE);
    const len = Math.round((e.dur / 1000) * RATE);
    for (let i = 0; i < len && at + i < out.length; i++) out[at + i] += sprite[from + i] ?? 0;
    spans.push([at, at + len]);
  }
  let peak = 0;
  let clippedSamples = 0;
  for (const v of out) { const a = Math.abs(v); if (a > peak) peak = a; if (a >= 1) clippedSamples++; }
  // longest silence between the first and last cue
  spans.sort((p, q) => p[0] - q[0]);
  let longest = 0;
  let end = spans.length ? spans[0][1] : 0;
  for (const [s, e] of spans) { if (s > end) longest = Math.max(longest, s - end); end = Math.max(end, e); }
  // soft limiter so the file never clips; the report gives the raw peak
  const gain = peak > 0.98 ? 0.98 / peak : 1;
  const pcm = Buffer.alloc(out.length * 2);
  for (let i = 0; i < out.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[i] * gain * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return {
    wav: Buffer.concat([h, pcm]),
    report: { cues: cues.length, problems, peak: Number(peak.toFixed(3)), clippedSamples, limiterGain: Number(gain.toFixed(3)), longestSilenceMs: Math.round((longest / RATE) * 1000) },
  };
}

// ------------------------------------------------------------------ modes

async function recordVideo(browser, base) {
  const fps = Number(arg("fps", 60));
  const speed = [2, 3].includes(Number(arg("speed", 1))) ? Number(arg("speed", 1)) : 1;
  const name = arg("find") ? `find-${arg("find")}-l${arg("level", "1")}` : arg("seed") ? `seed-${arg("seed")}` : arg("fixture", "bout-gate");
  mkdirSync(OUT_DIR, { recursive: true });
  const out = resolve(arg("out", join(OUT_DIR, `${name}-capsule${flag("reduced") ? "-reduced" : ""}${speed > 1 ? `-${speed}x` : ""}.mp4`)));
  const page = await openPage(browser, PHONE, { reducedMotion: flag("reduced") });
  await page.goto(debugUrl(base, { paused: 1, t: 0, sound: 0 }));
  await waitReady(page);
  const info = await page.evaluate(() => ({ durationMs: window.__rz.durationMs, cues: window.__rz.cues, contacts: window.__rz.contacts }));
  const frames = Math.ceil((info.durationMs / speed / 1000) * fps) + 1;
  const cdp = await page.context().newCDPSession(page);
  const work = join(tmpdir(), "rankzero-record");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const video = join(work, "video.mp4");
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "veryfast", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", video], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((ok, fail) => ff.on("close", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exit ${code}`)))));
  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = Math.min(info.durationMs, (i * 1000 * speed) / fps);
    await page.evaluate((tt) => window.__rz.seek(tt), t);
    const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90, clip: { x: 0, y: 0, width: PHONE.width, height: PHONE.height, scale: 2 } });
    if (!ff.stdin.write(Buffer.from(shot.data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 300 === 0) process.stdout.write(`frame ${i}/${frames}\n`);
  }
  ff.stdin.end();
  await done;
  const played = await page.evaluate(() => window.__rz.played);
  let report = null;
  if (flag("audio")) {
    const { wav, report: r } = await mixCues({ ...info, speed });
    report = r;
    writeFileSync(join(work, "cues.wav"), wav);
    writeFileSync(out.replace(/\.mp4$/, ".wav"), wav);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", video, "-i", join(work, "cues.wav"), "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", out]);
  } else {
    copyFileSync(video, out);
  }
  console.log(JSON.stringify({ out, frames, fps, speed, durationMs: info.durationMs, seconds: Math.round((Date.now() - started) / 1000), soundsPlayedBySeeks: played, audio: report }, null, 1));
  const copyTo = arg("copy-to");
  if (copyTo) { copyFileSync(out, copyTo); console.log(`copied to ${copyTo}`); }
}

async function realtime(browser, base) {
  const seconds = Number(arg("seconds", 8));
  const page = await openPage(browser, PHONE, { reducedMotion: flag("reduced") });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(debugUrl(base, { sound: 0 }));
  await waitReady(page);
  await page.evaluate(() => window.__rz.seek(1500));
  const stats = await page.evaluate((ms) => new Promise((done) => {
    const times = [];
    let last = performance.now();
    const end = last + ms;
    const step = (now) => {
      times.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(step);
      else {
        times.sort((p, q) => p - q);
        const avg = times.reduce((s, v) => s + v, 0) / times.length;
        done({ frames: times.length, avgMs: Number(avg.toFixed(2)), fps: Number((1000 / avg).toFixed(1)), p95Ms: Number(times[Math.floor(times.length * 0.95)].toFixed(2)), worstMs: Number(times[times.length - 1].toFixed(2)) });
      }
    };
    requestAnimationFrame(step);
  }), seconds * 1000);
  console.log(JSON.stringify({ mode: "realtime, 4x CPU throttle, headless", ...stats }, null, 1));
}

async function shots(browser, base) {
  mkdirSync(OUT_DIR, { recursive: true });
  const results = [];
  const shoot = async (size, url, file, prep, fullPage = false) => {
    const page = await openPage(browser, size);
    await page.goto(url);
    await waitReady(page);
    if (prep) await prep(page);
    await page.waitForTimeout(100);
    const path = join(OUT_DIR, file);
    await page.screenshot({ path, fullPage });
    results.push({ file: path, size: `${size.width}x${size.height}`, ...(await overflowReport(page)) });
    await page.context().close();
  };
  const at = (t) => async (page) => { await page.evaluate((tt) => window.__rz.seek(tt), t); };
  const source = arg("find") ? `find=${arg("find")}&level=${arg("level", "1")}` : `fixture=${arg("fixture", "bout-gate")}`;
  const bout = (q) => `${base}/src/debug/index.html#/debug/bout?${source}&paused=1&sound=0${q}`;
  for (const extra of (arg("at", "") || "").split(",").filter(Boolean).map(Number)) {
    await shoot(PHONE, bout(`&t=${extra}`), `fight-at-${extra}ms.png`, at(extra));
  }
  if (flag("only-at")) { console.log(JSON.stringify(results, null, 1)); return; }
  await shoot(PHONE, bout("&t=900"), "fight-intro-900ms.png", at(900));
  await shoot(PHONE, bout("&t=6000"), "fight-mid-6000ms.png", at(6000));
  await shoot(PHONE, bout(""), "fight-contact-plus-60ms.png", async (page) => {
    await page.evaluate(() => { const c = window.__rz.contacts[2]; window.__rz.seek(c.at + 60); });
  });
  const dur = await (async () => {
    const page = await openPage(browser, PHONE);
    await page.goto(bout(""));
    await waitReady(page);
    const d = await page.evaluate(() => window.__rz.durationMs);
    await page.context().close();
    return d;
  })();
  await shoot(PHONE, bout(`&t=${dur}`), "fight-result.png", at(dur));
  await shoot(PHONE, `${base}/src/debug/index.html#/debug/bout?fixture=bout-all-steps&paused=1&sound=0&replay=1`, "fight-all-steps-replay-9000ms.png", at(9000));
  await shoot(NARROW, bout("&t=6000"), "fight-320.png", at(6000));
  await shoot(DESKTOP, bout("&t=6000"), "fight-desktop.png", at(6000));
  await shoot(PHONE, `${base}/src/debug/index.html#/debug/locker`, "locker-mock.png");
  await shoot(PHONE, `${base}/src/debug/index.html#/debug/locker`, "locker-mock-scrolled.png", async (page) => { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); });
  await shoot(PHONE, `${base}/src/debug/index.html#/debug/locker?levelup=1`, "locker-mock-levelup.png");
  await shoot(NARROW, `${base}/src/debug/index.html#/debug/locker`, "locker-mock-320.png");
  await shoot(PHONE, `${base}/src/debug/index.html#/debug/ui`, "ui-parts.png", async (page) => {
    const bag = await page.evaluate(() => {
      const side = document.querySelector('[data-testid="bag-12"] [data-side="a"]');
      const icons = side.querySelectorAll('[role="img"]').length;
      const chip = side.querySelector("[data-more]");
      const r = side.getBoundingClientRect();
      const last = side.lastElementChild.getBoundingClientRect();
      return { icons, chip: chip ? chip.textContent : null, sideWidth: Math.round(r.width), scrollWidth: side.scrollWidth, clientWidth: side.clientWidth, lastRight: Math.round(last.right), sideRight: Math.round(r.right) };
    });
    results.push({ bagStrip12: bag });
  }, true);
  console.log(JSON.stringify(results, null, 1));
}

const server = await startServer();
try {
  await withBrowser(async (browser) => {
    if (flag("shots")) await shots(browser, server.url);
    else if (flag("realtime")) await realtime(browser, server.url);
    else await recordVideo(browser, server.url);
  });
} finally {
  server.stop();
}
