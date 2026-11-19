/**
 * Speed 1x / 2x / 3x (owner, 15 Nov 2026: "Add x1, x2 and x3 for VIP"). 3x shows a lock and is
 * not pressable as a speed until the save is VIP.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Controls } from "../../src/fight/Controls";
import type { ControlsProps } from "../../src/fight/Controls";

const noop = (): void => undefined;
const base: ControlsProps = { paused: false, ended: false, speed: 1, vip: false, sound: true, canSkip: true,
  onPlayPause: noop, onSpeed: noop, onLocked: noop, onSkip: noop, onSound: noop };
const html = (p: Partial<ControlsProps>): string => renderToStaticMarkup(<Controls {...base} {...p} />);

describe("speed controls", () => {
  it("shows 1x, 2x and 3x, the current one pressed", () => {
    const h = html({ speed: 2, vip: true });
    for (const s of ["1x", "2x", "3x"]) expect(h).toContain(`>${s}<`);
    expect(h).toContain('aria-label="Speed 2x" title="Speed 2x" aria-pressed="true"');
    expect(h).toContain('aria-label="Speed 1x" title="Speed 1x" aria-pressed="false"');
  });
  it("without VIP, 3x carries the lock and says it is a VIP perk", () => {
    const h = html({ vip: false });
    expect(h).toContain("Speed 3x, a VIP perk");
    expect((h.match(/viewBox="0 0 12 14"/g) ?? []).length).toBe(1);
  });
  it("with VIP there is no lock", () => {
    const h = html({ vip: true, speed: 3 });
    expect(h).not.toContain("VIP perk");
    expect(h).not.toContain('viewBox="0 0 12 14"');
    expect(h).toContain('aria-label="Speed 3x" title="Speed 3x" aria-pressed="true"');
  });
});
