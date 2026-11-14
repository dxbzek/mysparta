import { describe, expect, it, vi } from "vitest";
import { migrate, readDoc } from "../../src/state/migrations";
import { emptyDoc } from "../../src/state/schema";
import { isUlid, ulid } from "../../src/state/ulid";

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
  it("a version-1 document reads back unchanged", () => {
    const d = emptyDoc(1000);
    const r = readDoc(JSON.stringify(d));
    expect(r.ok && r.doc).toEqual(d);
    expect(readDoc("{").ok).toBe(false);
    expect(readDoc(JSON.stringify({ ...d, fighters: [{ id: 1 }] })).ok).toBe(false);
  });
  it("bad settings fall back to the defaults with a warning, not a failure", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = readDoc(JSON.stringify({ ...emptyDoc(1), settings: { speed: 7, sound: false } }));
    expect(r.ok && r.doc.settings).toEqual({ sound: false, speed: 1, reducedMotion: "system", liveLog: true });
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
});
