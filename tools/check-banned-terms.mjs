#!/usr/bin/env node
/**
 * Banned-terms check (work package 0). Run: pnpm check:terms
 *
 * Rank Zero is an original game. This check keeps the names of the game it is NOT, and the
 * words of the build it replaced, out of the repo. It reads every file git knows about
 * (tracked, plus new files that are not ignored), so a fault is seen before it is committed.
 *
 * Two groups, as the brief sets them:
 *
 *   NAMES    banned in every file except pnpm-lock.yaml and licence texts:
 *            the reference game's names, its studio, its community revival, the skill names
 *            the brief lists, and the old build's own words.
 *   WORDS    ordinary English words that are banned only as feature names: in player-facing
 *            text, in content ids, and in file and folder names.
 *
 * Matching is by whole word or whole phrase, with any case and with spaces, hyphens or
 * underscores between the words, and camelCase counts as word breaks ("fooBar" is "foo bar").
 * The few made-up names in JOINED also match inside a longer word, because nothing else
 * spells them.
 *
 * The lists are stored letter-shifted (ROT13) so that this file passes its own check.
 * To read them: node tools/check-banned-terms.mjs --list
 *
 * tools/banned-terms.allow holds the paths that may name a banned term. Today it is one
 * test, which must name the old build's storage prefix to prove those keys are never touched.
 *
 * Not covered: the reference's rank names. The brief bans them but does not list them, and
 * nobody may open the reference to copy a list. Add them to PHRASES when the owner supplies them.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const JOINED = ["zloehgr", "ynoehgr", "ryoehgb", "zrvaoehgnyb", "zbgvbagjva", "rgreanygjva", "ntbtr", "xyrbf"];
const PHRASES = ["zl oehgr", "yn oehgr", "ry oehgb", "zrva oehgnyb", "zbgvba gjva", "rgreany gjva",
  "pel bs gur qnzarq", "gentvp cbgvba", "cvyrqevire", "synfu sybbq", "svrepr oehgr", "onyyrg fubrf",
  "yrnq fxryrgba", "urephyrna fgeratgu", "sryvar ntvyvgl", "yvtugavat obyg", "fvkgu frafr",
  "svfgf bs shel", "jrncbaf znfgre", "hagbhpunoyr", "veba urnq", "ulcabfvf", "gnzre",
  "punzcvba", "ivtbe", "evsg"];
const WORDS = ["oehgr", "pryy", "qbwb", "chcvy", "znfgre", "qrfgval"];

/** Where the WORDS group applies to file contents. File and folder names are checked everywhere. */
const WORD_SCOPES = [
  /^apps\/web\/src\/text\//,
  /^apps\/web\/index\.html$/,
  /^packages\/core\/src\/contracts\/ids\.ts$/,
  /^packages\/core\/src\/content\//,
];
/** Files whose contents the NAMES group does not read. */
const LOCKFILE = "pnpm-lock.yaml";
/** LICENSE, LICENCE.txt, COPYING, OFL.txt, Inter-OFL.txt, LICENSE-MIT. Not "licence.ts". */
const LICENCE_TEXT = /(^|[\/._-])(licen[cs]e|copying|ofl)(-[a-z0-9]+)?(\.(txt|md))?$/i;

const rot13 = (s) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phrase = (term) => term.split(" ").map(escape).join("[\\s_-]*");
const whole = (term) => new RegExp(`(?<![a-z0-9])${phrase(term)}s?(?![a-z0-9])`, "i");
const anywhere = (term) => new RegExp(escape(term), "i");

const NAME_RULES = [
  ...JOINED.map(rot13).map((term) => ({ term, test: anywhere(term) })),
  ...PHRASES.map(rot13).map((term) => ({ term, test: whole(term) })),
];
const WORD_RULES = WORDS.map(rot13).map((term) => ({ term, test: whole(term) }));

/** "LockerView" reads as "Locker View", "XMLHttp" as "XML Http". */
const splitCamel = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
const hit = (rules, text) => {
  const loose = splitCamel(text);
  return rules.filter((r) => r.test.test(text) || r.test.test(loose));
};

if (process.argv.includes("--list")) {
  console.log("NAMES (every file):\n  " + NAME_RULES.map((r) => r.term).join("\n  "));
  console.log("WORDS (player text, content ids, file names):\n  " + WORD_RULES.map((r) => r.term).join("\n  "));
  process.exit(0);
}

function gitFiles() {
  const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  return [...new Set(out.toString("utf8").split("\0").filter(Boolean))]
    .filter((f) => existsSync(resolve(ROOT, f)) && statSync(resolve(ROOT, f)).isFile())
    .sort();
}

const allowFile = resolve(ROOT, "tools/banned-terms.allow");
const allow = new Set(existsSync(allowFile)
  ? readFileSync(allowFile, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  : []);

const problems = [];
const files = gitFiles();
let read = 0;

for (const file of files) {
  // 1. The path itself: names and words, in every file.
  for (const r of [...hit(NAME_RULES, file), ...hit(WORD_RULES, file)]) {
    problems.push(`${file}: the path holds the banned term "${r.term}"`);
  }
  // 2. The contents.
  if (file === LOCKFILE || LICENCE_TEXT.test(file) || allow.has(file)) continue;
  const bytes = readFileSync(resolve(ROOT, file));
  if (bytes.subarray(0, 8000).includes(0)) continue;            // binary: nothing to read
  read += 1;
  const inWordScope = WORD_SCOPES.some((s) => s.test(file));
  const lines = bytes.toString("utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const r of hit(NAME_RULES, line)) problems.push(`${file}:${i + 1}: banned name "${r.term}"`);
    if (inWordScope) for (const r of hit(WORD_RULES, line)) problems.push(`${file}:${i + 1}: "${r.term}" is banned in player text, content ids and file names`);
  });
}

for (const path of allow) {
  if (!files.includes(path)) console.log(`check:terms note: the allowlisted path does not exist yet: ${path}`);
}

if (problems.length > 0) {
  console.error(`check:terms FAILED: ${problems.length} banned term${problems.length === 1 ? "" : "s"}\n` + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log(`check:terms ok: ${files.length} paths, ${read} files read, ${NAME_RULES.length} names and ${WORD_RULES.length} words checked, ${allow.size} allowlisted path${allow.size === 1 ? "" : "s"}`);
