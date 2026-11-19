/**
 * The fight screen's drawer (owner, 19 Nov 2026: "I dont want the ui below honestly"). The stage
 * is the whole screen; the bout log and the two fighter cards live here, closed by default. It
 * opens from the LOG button (the log) or from a fighter's HP bar (the fighters, that one's card
 * in view), as a sheet over the bottom of a phone held upright and a panel down the right side
 * of a turned phone or a desktop.
 *
 * It closes on a tap outside it (the scrim), the Close button, Escape, or a swipe toward its
 * edge on its head (down for the sheet, right for the panel). Focus moves into it when it opens
 * and back to what opened it when it closes; Tab stays inside it while it is open.
 *
 * No timer and no CSS animation (src/fight is one clock): it simply is open or closed.
 */
import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import css from "./fight.module.css";

export type DrawerTab = "log" | "fighters";

/** How far (CSS px) a swipe on the drawer's head must travel toward its edge to close it. */
export const SWIPE_CLOSE_PX = 56;

/** Whether a swipe from `from` to `to` closes the drawer: down for the sheet, right for the panel. Pure. */
export function swipeCloses(from: { x: number; y: number }, to: { x: number; y: number }, side: boolean): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return side ? dx >= SWIPE_CLOSE_PX && Math.abs(dx) > Math.abs(dy) : dy >= SWIPE_CLOSE_PX && Math.abs(dy) > Math.abs(dx);
}

export interface FightDrawerProps {
  open: boolean;
  tab: DrawerTab;
  onTab(tab: DrawerTab): void;
  onClose(): void;
  /** The panel down the side (a wide screen) rather than the sheet at the bottom. */
  side: boolean;
  log: ReactNode;
  fighters: ReactNode;
}

const TABS: readonly { id: DrawerTab; label: string }[] = [{ id: "log", label: "Log" }, { id: "fighters", label: "Fighters" }];

export function FightDrawer({ open, tab, onTab, onClose, side, log, fighters }: FightDrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    const key = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      opener.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  // Tab and Shift+Tab stay inside the open drawer
  const trap = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== "Tab" || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>("button, [href], input, [tabindex]:not([tabindex='-1'])")].filter((el) => !el.hasAttribute("disabled"));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>): void => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const s = swipe.current;
    swipe.current = null;
    if (s !== null && s.id === e.pointerId && swipeCloses(s, { x: e.clientX, y: e.clientY }, side)) onClose();
  };
  // the arrow keys move between the two tabs (the tab pattern)
  const tabKey = (e: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: DrawerTab = tab === "log" ? "fighters" : "log";
    onTab(next);
    ref.current?.querySelector<HTMLElement>(`#fight-tab-${next}`)?.focus();
  };

  return (
    <>
      <div className={css.drawerScrim} onClick={onClose} aria-hidden="true" data-drawer-scrim="" />
      <div ref={ref} className={`${css.drawer} ${side ? css.drawerSide : css.drawerSheet}`} role="dialog" aria-modal="true"
        aria-label={tab === "log" ? "Bout log" : "Fighters"} tabIndex={-1} onKeyDown={trap} data-drawer={tab}>
        <div className={css.drawerHead} onPointerDown={down} onPointerUp={up} onPointerCancel={() => { swipe.current = null; }}>
          <span className={css.drawerGrip} aria-hidden="true" />
          <div className={css.drawerTabs} role="tablist" aria-label="Show">
            {TABS.map((t) => (
              <button key={t.id} id={`fight-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls="fight-drawer-panel"
                tabIndex={tab === t.id ? 0 : -1} className={`${css.drawerTab} ${tab === t.id ? css.drawerTabOn : ""}`}
                onClick={() => onTab(t.id)} onKeyDown={tabKey}>{t.label}</button>
            ))}
          </div>
          <button type="button" className={css.drawerClose} onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div id="fight-drawer-panel" className={css.drawerBody} role="tabpanel" aria-labelledby={`fight-tab-${tab}`}>
          {tab === "log" ? log : fighters}
        </div>
      </div>
    </>
  );
}
