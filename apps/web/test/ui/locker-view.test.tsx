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
    expect(html).toContain("Fight (4 bouts left)");
    for (const tab of ["Home", "Kit", "History"]) expect(html).toContain(`>${tab}</button>`);
    // kit: 9 perks -> 6 icons and "+3"
    const kit = html.slice(html.indexOf(">Kit</h2>"), html.indexOf(">Last bouts</h2>"));
    expect(count(kit, /role="img"/g)).toBe(6);
    expect(kit).toContain(">+3</button>");
    expect(count(html, /aria-label="(Win|Loss)"/g)).toBe(3);
  });
  it("the one primary button has three states", () => {
    expect(renderToStaticMarkup(<LockerView {...lockerMockProps({ levelUp: true })} />)).toContain("Level up!");
    const done = renderToStaticMarkup(<LockerView {...lockerMockProps({ done: true })} />);
    expect(done).toContain("Done for tonight. Back in 5 h 12 min.");
    expect(done).not.toContain("Fight (");
  });
});
