/**
 * A bottom sheet (the face-off sheet, a perk's detail, settings). `height` is a share of the
 * screen, 0.6 for the face-off sheet. Escape and the scrim close it.
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import css from "./Sheet.module.css";

export interface SheetProps {
  open: boolean;
  title: string;
  onClose(): void;
  closeLabel?: string;
  height?: number;
  children?: ReactNode;
}

export function Sheet({ open, title, onClose, closeLabel = "Close", height, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const key = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);
  return (
    <>
      {open ? <div className={css.scrim} onClick={onClose} aria-hidden="true" /> : null}
      <div
        ref={ref}
        className={[css.sheet, open ? "" : css.closed].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        tabIndex={-1}
        style={height ? { minHeight: `${Math.round(height * 100)}dvh` } : undefined}
      >
        <div className={css.head}>
          <h2 className={css.title}>{title}</h2>
          <Button onClick={onClose} aria-label={closeLabel}>{closeLabel}</Button>
        </div>
        {children}
      </div>
    </>
  );
}
