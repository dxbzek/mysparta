/**
 * Finding 40: a lazy screen that fails to load gets its own Retry (a fresh `lazy`, since React
 * keeps a failed one failed), and a stale chunk after a deploy reloads the page once.
 */
import { describe, expect, it, vi } from "vitest";
import { reloadOnStaleChunks, retryable } from "../../src/app/App";

function fakeWindow() {
  const handlers: Array<() => void> = [];
  const store = new Map<string, string>();
  return {
    win: {
      addEventListener: (type: string, fn: () => void) => { if (type === "vite:preloadError") handlers.push(fn); },
      sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
    } as unknown as Window,
    fire: () => handlers.forEach((h) => h()),
  };
}

describe("lazy screens", () => {
  it("a retry makes a fresh lazy component that loads again", () => {
    const load = vi.fn(() => Promise.resolve({ default: () => null }));
    const chunk = retryable<object>(load);
    const first = chunk.get();
    expect(chunk.get()).toBe(first);
    chunk.reset();
    expect(chunk.get()).not.toBe(first);
  });

  it("keeps one component type after the chunk arrives, so the open screen is not remounted", async () => {
    const Screen = (): null => null;
    const chunk = retryable<object>(() => Promise.resolve({ default: Screen }));
    const first = chunk.get();                // asked for before the chunk arrived: the lazy wrapper
    expect(first).not.toBe(Screen);
    chunk.preload();
    await new Promise((r) => setTimeout(r, 0));
    expect(chunk.get()).toBe(first);          // the app re-renders: same type, the screen keeps its state
  });

  it("a chunk prefetched before its first use mounts as the screen itself", async () => {
    const Screen = (): null => null;
    const chunk = retryable<object>(() => Promise.resolve({ default: Screen }));
    chunk.preload();
    await new Promise((r) => setTimeout(r, 0));
    expect(chunk.get()).toBe(Screen);
    expect(chunk.get()).toBe(Screen);
  });

  it("a stale chunk reloads the page once, not in a loop", () => {
    const { win, fire } = fakeWindow();
    const reload = vi.fn();
    let now = 1_000_000;
    reloadOnStaleChunks(win, reload, () => now);
    fire();
    expect(reload).toHaveBeenCalledTimes(1);
    now += 5_000;
    fire();                                   // offline right after the reload: leave it to Retry
    expect(reload).toHaveBeenCalledTimes(1);
    now += 120_000;
    fire();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does nothing when session storage is blocked (no reload loop possible)", () => {
    const reload = vi.fn();
    const handlers: Array<() => void> = [];
    const win = {
      addEventListener: (_t: string, fn: () => void) => handlers.push(fn),
      get sessionStorage(): Storage { throw new Error("blocked"); },
    } as unknown as Window;
    reloadOnStaleChunks(win, reload);
    handlers.forEach((h) => h());
    expect(reload).not.toHaveBeenCalled();
  });
});
