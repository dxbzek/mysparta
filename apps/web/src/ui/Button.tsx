/** A bolted, ink-framed button. `primary` is the one full-width action of a screen (56 px). */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import css from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "hazard" | "dark";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** A square 44 px button for a single icon or a short word; give it an `aria-label`. */
  square?: boolean;
  /** A toggle that is on (speed 2x, sound on). Sets aria-pressed. */
  pressed?: boolean;
  children?: ReactNode;
}

export function Button({ variant = "secondary", square, pressed, className, type = "button", children, ...rest }: ButtonProps) {
  const cls = [css.button, css[variant], square ? css.icon : "", pressed ? css.on : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} aria-pressed={pressed === undefined ? undefined : pressed} {...rest}>
      {children}
    </button>
  );
}
