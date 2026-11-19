/** The debug routes of the frozen contract: #/debug/bout?seed=<n>&t=<ms>&paused=1 and ?fixture=<name>. */
import { describe, expect, it } from "vitest";
import { parseDebugRoute } from "../../src/debug/route";
import { seekTimeFor } from "../../src/fight/ReplayBar";
import { resultPose } from "../../src/fight/ResultCard";

describe("debug routes", () => {
  it("reads a fixture route", () => {
    expect(parseDebugRoute("#/debug/bout?fixture=bout-all-steps&t=1500&paused=1&speed=2&reduced=1")).toMatchObject({
      page: "bout", fixture: "bout-all-steps", seed: null, t: 1500, paused: true, speed: 2, reduced: "on",
    });
  });
  it("reads a seed route", () => {
    expect(parseDebugRoute("#/debug/bout?seed=1234&t=0")).toMatchObject({ page: "bout", fixture: null, seed: 1234, paused: false, speed: 1, vip: false });
    expect(parseDebugRoute("#/debug/bout?speed=3&vip=1")).toMatchObject({ speed: 3, vip: true });
  });
  it("defaults to the gate bout, and ignores a bad fixture name", () => {
    expect(parseDebugRoute("#/debug/bout")).toMatchObject({ fixture: "bout-gate", t: 0 });
    expect(parseDebugRoute("#/debug/bout?fixture=nope")).toMatchObject({ fixture: "bout-gate" });
  });
  it("reads the Locker mock and the UI page", () => {
    expect(parseDebugRoute("#/debug/locker?levelup=1")).toEqual({ page: "locker", levelUp: true, done: false });
    expect(parseDebugRoute("#/debug/ui")).toEqual({ page: "ui" });
    expect(parseDebugRoute("#/card").page).toBe("unknown");
  });
});

describe("fight helpers", () => {
  it("the scrub bar seeks to the end of a step", () => {
    expect(seekTimeFor([100, 200, 300], 0)).toBe(0);
    expect(seekTimeFor([100, 200, 300], 2)).toBe(200);
    expect(seekTimeFor([100, 200, 300], 9)).toBe(300);
  });
  it("the result card slides first, then fills, from resultIn alone", () => {
    expect(resultPose(0)).toEqual({ slide: 0, fill: 0 });
    expect(resultPose(1)).toEqual({ slide: 1, fill: 1 });
    expect(resultPose(0.34).slide).toBe(1);
    expect(resultPose(0.2).fill).toBe(0);
  });
});
