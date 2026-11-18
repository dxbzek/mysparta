/** The Locker view renders from props alone, with the three button states of brief 3.11 B. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { lockerMockProps } from "../../src/debug/DebugApp";
import { LockerView } from "../../src/ui/LockerView";

const count = (html: string, re: RegExp): number => (html.match(re) ?? []).length;

describe("LockerView", () => {
  it("shows the hero, stats, kit strip, last bouts and plain tab labels", () => {
    const p = lockerMockProps();
    const html = renderToStaticMarkup(<LockerView {...p} />);
    expect(html).toContain("Old Roy");
    expect(html).toContain("Level 10");
    expect(html).toContain("<span>5 / 8</span>");
    expect(html).toContain(">Fight</button>");
    // the energy bar (content v3): 4 of 6 cells lit, the countdown to the next point
    const bar = html.slice(html.indexOf('aria-label="Energy: 4 of 6.'));
    expect(bar.length).toBeGreaterThan(0);
    expect(count(bar.slice(0, bar.indexOf("</main>")), /class="[^"]*_on_/g)).toBe(4);
    expect(html).toContain("+1 in 12:04");
    for (const tab of ["Home", "Kit", "History"]) expect(html).toContain(`>${tab}</button>`);
    // kit: 9 perks -> 6 icons and "+3"
    const kit = html.slice(html.indexOf(">Kit</h2>"), html.indexOf(">Last bouts</h2>"));
    expect(count(kit, /role="img"/g)).toBe(6);
    expect(kit).toContain(">+3</button>");
    expect(count(html, /aria-label="(Win|Loss)"/g)).toBe(3);
  });
  it("the stats panel lists all six stats, Health with the others, as Reveal, Level-up and Kit do (review r2, content v3)", () => {
    const html = renderToStaticMarkup(<LockerView {...lockerMockProps()} />);
    const stats = html.slice(html.indexOf('aria-label="Stats"'));
    for (const s of ["Health", "Strength", "Agility", "Speed", "Toughness", "Precision"]) expect(stats).toMatch(new RegExp(`aria-label="${s} [0-9]+"`));
  });
  it("a new scrapper's Last bouts says there are none, with no All bouts link (finding 62)", () => {
    const html = renderToStaticMarkup(<LockerView {...lockerMockProps()} bouts={[]} />);
    expect(html).toContain("No bouts yet. Tap Fight to pick a rival.");
    expect(html).not.toContain(">All bouts</button>");
  });
  it("the one primary button has three states", () => {
    expect(renderToStaticMarkup(<LockerView {...lockerMockProps({ levelUp: true })} />)).toContain("Level up!");
    const done = renderToStaticMarkup(<LockerView {...lockerMockProps({ done: true })} />);
    expect(done).toContain("Out of energy. +1 in 12:04.");
    expect(done).not.toContain(">Fight</button>");
    expect(done).toContain('aria-label="Energy: 0 of 6.'); 
  });
});
