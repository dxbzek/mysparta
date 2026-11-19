#!/usr/bin/env node
/**
 * Ownership check (work package 0). Run: pnpm check:owners
 *
 * Rule: one writer per file. OWNERS.json maps globs to lanes (work packages).
 *
 * Check A, always: every file git knows about (tracked, plus new files that are not ignored)
 *   matches exactly one lane. A path with no owner fails. A path with two owners fails.
 *
 * Check B, on a lane branch: the lane is read from the branch name `rebuild/v2-<lane>`
 *   (for example rebuild/v2-wp3). Every path that branch changed since it left the base
 *   branch, committed or not, must belong to that lane. Deleted paths count, and so does the
 *   old path of a renamed file: the diffs run with --no-renames, because git's rename
 *   detection would otherwise report only the new path and a lane could take another lane's
 *   file with `git mv`.
 *
 * Options:
 *   --lane wp3            check the diff as that lane, whatever the branch is called
 *   --branch <name>       read the lane from this name instead of the current branch
 *   --base <ref>          the branch the lane left (default rebuild/v2)
 *
 * On the integration branch itself (rebuild/v2) and in CI only check A runs: the Lead merges
 * there and edits the seam files.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const git = (...a) => execFileSync("git", a, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
const lines = (text) => text.split(/\r?\n|\0/).map((l) => l.trim()).filter(Boolean);
const fail = (message) => {
  console.error(`check:owners FAILED: ${message}`);
  process.exit(1);
};

// ---- OWNERS.json
const ownersFile = resolve(ROOT, "OWNERS.json");
if (!existsSync(ownersFile)) fail("OWNERS.json is missing");
const lanes = JSON.parse(readFileSync(ownersFile, "utf8")).lanes;
if (!lanes || typeof lanes !== "object") fail("OWNERS.json has no \"lanes\" object");

/** `**` crosses folders, `*` and `?` stay inside one name. `a/**` also matches nothing after `a/`. */
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}
const rules = Object.entries(lanes).map(([lane, globs]) => {
  if (!Array.isArray(globs)) fail(`OWNERS.json: lane ${lane} is not a list of globs`);
  return {
    lane,
    yes: globs.filter((g) => !g.startsWith("!")).map(globToRegExp),
    no: globs.filter((g) => g.startsWith("!")).map((g) => globToRegExp(g.slice(1))),
  };
});
const ownersOf = (path) => rules.filter((r) => r.yes.some((re) => re.test(path)) && !r.no.some((re) => re.test(path))).map((r) => r.lane);

// ---- check A: exactly one owner per file
const files = [...new Set(lines(git("ls-files", "-z", "--cached", "--others", "--exclude-standard")))]
  .filter((f) => existsSync(resolve(ROOT, f)) && statSync(resolve(ROOT, f)).isFile())
  .sort();
const problems = [];
const count = Object.fromEntries(rules.map((r) => [r.lane, 0]));
for (const file of files) {
  const owners = ownersOf(file);
  if (owners.length === 0) problems.push(`${file}: no owner (add a glob to OWNERS.json, or move the file)`);
  else if (owners.length > 1) problems.push(`${file}: ${owners.length} owners (${owners.join(", ")})`);
  else count[owners[0]] += 1;
}

// ---- check B: a lane only changes its own paths
let branch = option("--branch");
if (branch === undefined) {
  try { branch = git("branch", "--show-current").trim(); } catch { branch = ""; }
  if (!branch) branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";
}
const base = option("--base") ?? "rebuild/v2";
const lane = option("--lane") ?? (/^rebuild\/v2-(wp\d+)$/.exec(branch) ?? [])[1];
let changed = [];
if (lane !== undefined) {
  if (!(lane in lanes)) fail(`"${lane}" is not a lane in OWNERS.json`);
  let from;
  try { from = git("merge-base", base, "HEAD").trim(); } catch { fail(`cannot find where this branch left ${base}`); }
  changed = [...new Set([
    ...lines(git("diff", "--name-only", "--no-renames", "-z", from, "HEAD")),
    ...lines(git("diff", "--name-only", "--no-renames", "-z", "HEAD")),
    ...lines(git("ls-files", "-z", "--others", "--exclude-standard")),
  ])].sort();
  for (const file of changed) {
    const owners = ownersOf(file);
    if (owners.length !== 1 || owners[0] !== lane) {
      problems.push(`${file}: changed by lane ${lane}, owned by ${owners.length === 0 ? "nobody" : owners.join(", ")}`);
    }
  }
}

if (problems.length > 0) {
  fail(`${problems.length} path${problems.length === 1 ? "" : "s"}\n` + problems.map((p) => "  " + p).join("\n"));
}
const tally = Object.entries(count).map(([l, n]) => `${l} ${n}`).join(", ");
console.log(`check:owners ok: ${files.length} files, each with exactly one owner (${tally})`);
console.log(lane === undefined
  ? `check:owners: branch "${branch}" is not a lane branch, so no lane diff was checked`
  : `check:owners: lane ${lane} changed ${changed.length} path${changed.length === 1 ? "" : "s"} since ${base}, all its own`);
