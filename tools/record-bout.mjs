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
 * each cue at its `at` (scaled by --speed; at 2x and 3x a Move's hold, `Timeline.holds` via
 * `window.__rz.holds`, plays at 1x as the fight clock plays it). The mix is checked: every impact cue at or after its
 * contact, no two impact cues within 60 ms, every impact sound found in the mixed track within 30 ms
 * of its contact (a check of where the cues put each sound in the mix, not of the live player or the
 * picture; a match on the edge of the search window fails), the peak below clipping, and
 * the longest silence. With music (the default; --no-music leaves it out) the fight's music is mixed
 * under the cues as the live player plays it (apps/web/src/audio/music.ts): the two fight layers in
 * step, crossfaded by the HP the page reports (`__rz.music(t)`), faded out at the knockout, the ko
 * sting on the knockout blow, the win and loss cues played as the music's stings in place of the
 * sprite's jingles, the loops ducked under the stings and under big impacts, all at the default
 * music volume (60%, squared). The sync check runs on the effects alone, before the music goes in.
 * An agent cannot hear: a person must still listen (brief 3.13).
 *
 * Flags: --fixture <name> | --seed <n> | --find <n> --level <L> (a find-bout candidate) | --boss <rung> [--find <n>]
 * [--level <L>] (a boss bout of the ladder: pool rival n of realm "ladder-test" at level L, default the
 * rung's gate, against that rung's boss, with the boss banner, both ranks and the rank-up card), --speed 1|2|3,
 * --canvas WxH (the page size of the video, default 390x844; the fight screen is the whole page, so
 * 844x390 records a phone turned and 1280x720 a desktop; pages wider than 1000 px are taken at scale 1),
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
  const boss = arg("boss");
  const q = new URLSearchParams();
  // a boss bout (the ladder): pool rival --find (default 0) at --level (default the rung's gate) against the boss
  if (boss) { q.set("boss", boss); q.set("find", find ?? "0"); q.set("level", arg("level", String(3 * Number(boss)))); }
  else if (find) { q.set("find", find); q.set("level", arg("level", "1")); }
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

// ------------------------------------------------------------------ the clock's speed with holds

/** The fight clock's map at 2x and 3x (packages/stage/src/clock.ts, kept in step by hand: this
 *  file also runs under plain node): a Move's hold plays at 1x, the rest at the speed. `realOf`
 *  is real ms from 0 to presentation time `t`; `presentOf` is its inverse. With no holds (a host
 *  that does not expose them) both are a plain division by the speed. */
function realOf(t, speed, holds) {
  let real = 0;
  let at = 0;
  const edges = [...new Set(holds.flatMap((h) => [h[0], h[1]]))].filter((e) => e > 0).sort((p, q) => p - q);
  for (const e of [...edges, Infinity]) {
    const to = Math.min(e, t);
    if (to > at) {
      const held = holds.some((h) => at >= h[0] && at < h[1]);
      real += (to - at) / (held ? Math.min(speed, 1) : speed);
      at = to;
    }
    if (at >= t) break;
  }
  return real;
}
function presentOf(real, speed, holds, end) {
  let lo = 0;
  let hi = end;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (realOf(mid, speed, holds) < real) lo = mid; else hi = mid; }
  return Math.min(end, hi);
}

// ------------------------------------------------------------------ audio mix (Node)

function decodeMp3(file, rate) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4).slice();
}

/** The music mix (see the header): `music` is { samples: [{ r, scene, intensity }], koAt }, r in real ms. */
async function mixMusic(out, RATE, { samples, koAt, speed, holds, stings, ducks }) {
  const { FADE, DUCK, loopTargets } = await import("../apps/web/src/audio/music.ts");
  const { volumeGain } = await import("../apps/web/src/audio/engine.ts");
  const mj = JSON.parse(readFileSync(join(WEB, "public/audio/music.json"), "utf8"));
  const dec = {};
  for (const [id, t] of [...Object.entries(mj.tracks), ...Object.entries(mj.stings)]) dec[id] = decodeMp3(join(WEB, "public/audio", t.file), RATE);
  const vol = volumeGain(0.6);
  const n = out.length;
  // the loop gains: target from the nearest earlier sample, approached linearly over its fade
  const calm = mj.tracks["fight-calm"]; const intense = mj.tracks["fight-intense"];
  const len = Math.round((calm.loopEnd - calm.loopStart) * RATE);
  const g = { "fight-calm": 0, "fight-intense": 0 };
  let k = 0;
  // the duck envelope, 1 = no duck
  const duck = new Float32Array(n).fill(1);
  const dip = (atS, depth, attack, hold, release) => {
    const a = Math.round(atS * RATE); const b = a + Math.round(attack * RATE); const c = b + Math.round(hold * RATE); const d = c + Math.round(release * RATE);
    for (let i = Math.max(0, a); i < Math.min(n, d); i++) {
      const v = i < b ? 1 - (1 - depth) * ((i - a) / Math.max(1, b - a)) : i < c ? depth : depth + (1 - depth) * ((i - c) / Math.max(1, d - c));
      duck[i] = Math.min(duck[i], v);
    }
  };
  let stingUntil = -Infinity;
  for (const st of stings) {
    const dur = mj.stings[st.id].dur;
    dip(st.r / 1000, DUCK.sting, DUCK.stingAttack, dur, DUCK.stingRelease);
    stingUntil = Math.max(stingUntil, st.r / 1000 + DUCK.stingAttack + dur + DUCK.stingRelease);
  }
  for (const r of ducks) if (r / 1000 >= stingUntil || !stings.some((st) => r >= st.r && r / 1000 < st.r / 1000 + mj.stings[st.id].dur + 1)) dip(r / 1000, DUCK.impact, DUCK.impactAttack, DUCK.impactHold, DUCK.impactRelease);
  for (let i = 0; i < n; i++) {
    const rMs = (i / RATE) * 1000;
    while (k + 1 < samples.length && samples[k + 1].r <= rMs) k++;
    const s0 = samples[k] ?? { scene: "fight", intensity: 0 };
    const tgt = loopTargets(s0.scene, s0.intensity, true);
    const fade = s0.scene === "post" ? FADE.post : i < FADE.scene * RATE ? FADE.scene : FADE.layer;
    const step = 1 / (fade * RATE);
    for (const id of ["fight-calm", "fight-intense"]) {
      const d = tgt[id] - g[id];
      g[id] += Math.abs(d) <= step ? d : Math.sign(d) * step;
    }
    const pos = i % len;
    const a = dec["fight-calm"][Math.round(calm.loopStart * RATE) + pos] ?? 0;
    const b = dec["fight-intense"][Math.round(intense.loopStart * RATE) + pos] ?? 0;
    out[i] += vol * duck[i] * (g["fight-calm"] * a + g["fight-intense"] * b);
  }
  for (const st of stings) {
    const e = mj.stings[st.id]; const buf = dec[st.id];
    const at = Math.round((st.r / 1000) * RATE); const from = Math.round(e.start * RATE); const L = Math.round(e.dur * RATE);
    for (let i = 0; i < L && at + i < n; i++) out[at + i] += vol * (buf[from + i] ?? 0);
  }
  return { koAtMs: Number.isFinite(koAt) ? Math.round(realOf(koAt, speed, holds)) : null, stings: stings.map((st) => `${st.id}@${Math.round(st.r)}ms`), ducks: ducks.length };
}

async function mixCues({ cues, contacts, durationMs, speed, holds = [], music = null }) {
  const RATE = 44100;
  const map = JSON.parse(readFileSync(join(WEB, "public/audio/sfx.json"), "utf8"));
  const sprites = map.files.map((f) => decodeMp3(join(WEB, "public/audio", f), RATE));
  // the same pick as the fight screen: the cue item's own set, else the family's (needs tsx)
  const { soundFor } = await import("../apps/web/src/audio/cues.ts");
  const listOf = (name) => map.sets[name] ?? map.sets[map.families[name]];
  const size = (name) => listOf(name)?.length ?? 0;
  const out = new Float32Array(Math.ceil((realOf(durationMs, speed, holds) / 1000 + 2) * RATE));
  const IMPACT = new Set(["fist", "blunt", "blade", "block"]);
  const problems = [];
  let lastImpact = -Infinity;
  const spans = [];
  const placed = [];
  const stings = [];
  const ducks = [];
  const { DUCK_SETS, STING_FOR } = await import("../apps/web/src/audio/engine.ts");
  for (const c of cues) {
    const pick = soundFor(c, size);
    if (music) {
      const r = realOf(c.at, speed, holds);
      if (c.accent === true && Number.isFinite(music.koAt) && c.at === music.koAt) stings.push({ id: "ko", r });
      // the live engine plays the win and loss cues as the music's stings (no double jingle)
      if (pick && STING_FOR[pick.name]) { stings.push({ id: STING_FOR[pick.name], r }); continue; }
      if (pick && (DUCK_SETS.has(pick.name) || DUCK_SETS.has(map.families[pick.name] ?? ""))) ducks.push(r);
    }
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
    const at = Math.round((realOf(c.at, speed, holds) / 1000) * RATE);
    const from = Math.round((e.start / 1000) * RATE);
    const len = Math.round((e.dur / 1000) * RATE);
    for (let i = 0; i < len && at + i < out.length; i++) out[at + i] += sprite[from + i] ?? 0;
    spans.push([at, at + len]);
    if (IMPACT.has(c.family)) placed.push({ c, sprite, from, len });
  }
  // The placement check, on the mixed track (round-2 close: this was reported as "sync measured on
  // the mix", but the mix places each sprite at its own cue, so finding the sprite again only
  // re-reads cue.at - contact.at plus the sprite's onset; it says nothing about the live player,
  // whose timing is the cue scheduler's, apps/web/test/audio/schedule.test.ts, nor about what the
  // picture shows, which only decoding the recorded audio against the frames can tell). Each
  // impact sound is found by matching its sprite's first 60 ms against the track from 80 ms before
  // to 150 ms after its contact; its onset must be within 30 ms of the contact. A best match on the
  // edge of that window is a failure (the sound is outside it, the match is something else), and
  // a sprite too short to match is counted, not skipped silently.
  const offsets = [];
  let unmatched = 0;
  for (const { c, sprite, from, len } of placed) {
    const mark = contacts.find((m) => m.step === c.step);
    if (!mark) continue;
    let pk = 0;
    for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(sprite[from + i] ?? 0));
    let on = 0;
    while (on < len && Math.abs(sprite[from + on] ?? 0) <= 0.15 * pk) on++;
    const L = Math.min(len - on, Math.round(0.06 * RATE));
    if (L < 100) { unmatched++; problems.push(`impact sound at ${Math.round(c.at)} ms: its sprite is too short to find in the mix`); continue; }
    const contact = Math.round((realOf(mark.at, speed, holds) / 1000) * RATE);
    let best = -Infinity, bestAt = 0, tn = 0;
    for (let i = 0; i < L; i++) tn += sprite[from + on + i] ** 2;
    for (let o = contact - Math.round(0.08 * RATE); o <= contact + Math.round(0.15 * RATE); o += 2) {
      if (o < 0 || o + L > out.length) continue;
      let dot = 0, en = 0;
      for (let i = 0; i < L; i += 2) { const v = out[o + i]; dot += v * sprite[from + on + i]; en += v * v; }
      const sc = dot / Math.sqrt(en * tn / 2 + 1e-12);
      if (sc > best) { best = sc; bestAt = o; }
    }
    const ms = ((bestAt - contact) / RATE) * 1000;
    offsets.push(ms);
    if (ms <= -79 || ms >= 149) problems.push(`impact sound at ${Math.round(c.at)} ms: best match on the edge of the search window (${Math.round(ms)} ms), so not found near its contact`);
    if (Math.abs(ms) > 30) problems.push(`impact sound at ${Math.round(c.at)} ms starts ${Math.round(ms)} ms from its contact (measured on the mix)`);
  }
  const abs = offsets.map(Math.abs).sort((p, q) => p - q);
  const sync = { checks: "cue placement in the mix only: not the live player, not the picture", impacts: offsets.length, unmatched,
    medianMs: abs.length ? Number(abs[abs.length >> 1].toFixed(1)) : null, worstMs: abs.length ? Number(abs[abs.length - 1].toFixed(1)) : null };

  const musicReport = music ? await mixMusic(out, RATE, { ...music, speed, holds, stings, ducks }) : null;
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
    report: { cues: cues.length, music: musicReport, sync, problems, peak: Number(peak.toFixed(3)), clippedSamples, limiterGain: Number(gain.toFixed(3)), longestSilenceMs: Math.round((longest / RATE) * 1000) },
  };
}

// ------------------------------------------------------------------ modes

/** The page size of the video: --canvas WxH, else the phone held upright. */
function videoSize() {
  const m = /^(\d{3,4})x(\d{3,4})$/.exec(arg("canvas", ""));
  if (!m) return PHONE;
  const width = Number(m[1]);
  return { width, height: Number(m[2]), deviceScaleFactor: width > 1000 ? 1 : 2 };
}

async function recordVideo(browser, base) {
  const fps = Number(arg("fps", 60));
  const size = videoSize();
  const speed = [2, 3].includes(Number(arg("speed", 1))) ? Number(arg("speed", 1)) : 1;
  const name = arg("boss") ? `boss-${arg("boss")}-find-${arg("find", "0")}-l${arg("level", String(3 * Number(arg("boss"))))}`
    : arg("find") ? `find-${arg("find")}-l${arg("level", "1")}` : arg("seed") ? `seed-${arg("seed")}` : arg("fixture", "bout-gate");
  mkdirSync(OUT_DIR, { recursive: true });
  const out = resolve(arg("out", join(OUT_DIR, `${name}-capsule${size === PHONE ? "" : `-${size.width}x${size.height}`}${flag("reduced") ? "-reduced" : ""}${speed > 1 ? `-${speed}x` : ""}.mp4`)));
  const page = await openPage(browser, size, { reducedMotion: flag("reduced") });
  await page.goto(debugUrl(base, { paused: 1, t: 0, sound: 0 }));
  await waitReady(page);
  // the Moves the clock plays at 1x at 2x and 3x (Timeline.holds), when the debug page exposes them
  const info = await page.evaluate(() => ({ durationMs: window.__rz.durationMs, cues: window.__rz.cues, contacts: window.__rz.contacts,
    holds: window.__rz.holds ?? [] }));
  const frames = Math.ceil((realOf(info.durationMs, speed, info.holds) / 1000) * fps) + 1;
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
    const t = speed === 1 || info.holds.length === 0 ? Math.min(info.durationMs, (i * 1000 * speed) / fps)
      : presentOf((i * 1000) / fps, speed, info.holds, info.durationMs);
    await page.evaluate((tt) => window.__rz.seek(tt), t);
    const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: size.deviceScaleFactor } });
    if (!ff.stdin.write(Buffer.from(shot.data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 300 === 0) process.stdout.write(`frame ${i}/${frames}\n`);
  }
  ff.stdin.end();
  await done;
  const played = await page.evaluate(() => window.__rz.played);
  let report = null;
  if (flag("audio")) {
    // the music scene and intensity the page reports for every frame's fight time (real ms)
    const music = flag("no-music") ? null : { koAt: await page.evaluate(() => window.__rz.koAt ?? null) ?? Infinity, samples: [] };
    if (music) {
      const samples = [];
      for (let i = 0; i < frames; i += 6) {
        const r = (i * 1000) / fps;
        const t = speed === 1 || info.holds.length === 0 ? Math.min(info.durationMs, r * speed) : presentOf(r, speed, info.holds, info.durationMs);
        const m = await page.evaluate((tt) => (window.__rz.music ? window.__rz.music(tt) : { scene: "fight", intensity: 0 }), t);
        samples.push({ r, ...m });
      }
      music.samples = samples;
    }
    const { wav, report: r } = await mixCues({ ...info, speed, music });
    report = r;
    writeFileSync(join(work, "cues.wav"), wav);
    writeFileSync(out.replace(/\.mp4$/, ".wav"), wav);
    // the cue list the mix was made from, for checking the track against the picture
    writeFileSync(out.replace(/\.mp4$/, ".cues.json"), JSON.stringify({ durationMs: info.durationMs, cues: info.cues, contacts: info.contacts, holds: info.holds, speed }));
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
