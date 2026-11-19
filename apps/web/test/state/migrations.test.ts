import { describe, expect, it, vi } from "vitest";
import { migrate, readDoc } from "../../src/state/migrations";
import { emptyDoc, playSpeed } from "../../src/state/schema";
import { isUlid, ulid } from "../../src/state/ulid";
import { boutGate, l1Knife, l1Pipe } from "@rankzero/core/fixtures";

describe("migrations", () => {
  it("runs each step in order up to the target version", () => {
    const table = { 1: (d: Record<string, unknown>) => ({ ...d, a: 1 }), 2: (d: Record<string, unknown>) => ({ ...d, b: (d.a as number) + 1 }) };
    expect(migrate({ schemaVersion: 1 }, table, 3)).toEqual({ ok: true, doc: { schemaVersion: 3, a: 1, b: 2 } });
  });
  it("refuses a newer version, a missing step and junk", () => {
    expect(migrate({ schemaVersion: 9 }).ok).toBe(false);
    expect(migrate({ schemaVersion: 1 }, {}, 2).ok).toBe(false);
    expect(migrate(null).ok).toBe(false);
    expect(migrate({}).ok).toBe(false);
  });
  it("a current-version document reads back unchanged", () => {
    const d = emptyDoc(1000);
    expect(d.schemaVersion).toBe(7);
    const r = readDoc(JSON.stringify(d));
    expect(r.ok && r.doc).toEqual(d);
    expect(readDoc("{").ok).toBe(false);
    expect(readDoc(JSON.stringify({ ...d, fighters: [{ id: 1 }] })).ok).toBe(false);
  });
  it("bad settings fall back to the defaults with a warning, not a failure", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = readDoc(JSON.stringify({ ...emptyDoc(1), settings: { speed: 7, sound: false } }));
    expect(r.ok && r.doc.settings).toEqual({ sound: false, speed: 1, reducedMotion: "system", liveLog: true, isVip: false });
  });
  it("1 to 4: a version-1 save gets isVip false and keeps every other setting", () => {
    const v1 = { ...emptyDoc(7), schemaVersion: 1, settings: { sound: false, speed: 2, reducedMotion: "on", liveLog: false } };
    const r = readDoc(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(7);
    expect(r.doc.settings).toEqual({ sound: false, speed: 2, reducedMotion: "on", liveLog: false, isVip: false });
    // settings that are not an object still fall back to the defaults
    const junk = readDoc(JSON.stringify({ ...v1, settings: "x" }));
    expect(junk.ok && junk.doc.settings).toEqual({ sound: true, speed: 1, reducedMotion: "system", liveLog: true, isVip: false });
  });
  it("3x is kept for a VIP save and dropped to 2x for one that is not", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const vip = readDoc(JSON.stringify({ ...emptyDoc(1), settings: { ...emptyDoc(1).settings, speed: 3, isVip: true } }));
    expect(vip.ok && vip.doc.settings.speed).toBe(3);
    const not = readDoc(JSON.stringify({ ...emptyDoc(1), settings: { ...emptyDoc(1).settings, speed: 3, isVip: false } }));
    expect(not.ok && not.doc.settings.speed).toBe(2);
    expect(playSpeed({ speed: 3, isVip: false })).toBe(2);
    expect(playSpeed({ speed: 3, isVip: true })).toBe(3);
    expect(playSpeed({ speed: 1, isVip: false })).toBe(1);
  });
});

describe("ulid", () => {
  it("is 26 Crockford characters and sorts by time", () => {
    const a = ulid(1_700_000_000_000, () => new Uint8Array(16));
    const b = ulid(1_700_000_000_001, () => new Uint8Array(16).fill(255));
    expect(isUlid(a) && isUlid(b)).toBe(true);
    expect(a < b).toBe(true);
    expect(ulid(5)).not.toBe(ulid(5));
  });
  it("keeps a content v2 log and drops a log written before it (log version 1), keeping the row", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const row = { id: "b1", at: 5, seed: boutGate.seed, rulesVersion: 1, logVersion: 2, snapshotA: l1Pipe, snapshotB: l1Knife,
      result: boutGate.result, role: "attacker", fighterId: "f1", xp: 2, lineId: 0, watched: true, before: { xp: 0, energy: 6, energyAt: 0 },
      log: boutGate };
    const old = { ...row, id: "b0", logVersion: 1, log: { ...JSON.parse(JSON.stringify(boutGate)), logVersion: 1 } };
    const r = readDoc(JSON.stringify({ ...emptyDoc(1), history: [row, old] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.history.map((h) => [h.id, h.logVersion, h.log === undefined])).toEqual([["b1", 2, false], ["b0", 1, true]]);
  });
});
