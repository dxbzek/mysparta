/** A comic panel. `tone` picks the surface; text inside uses that surface's text tokens. */
import type { HTMLAttributes, ReactNode } from "react";
import css from "./Panel.module.css";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  tone?: "paper" | "raised" | "dark";
  title?: string;
  flush?: boolean;
  as?: "section" | "div" | "article";
  children?: ReactNode;
}

export function Panel({ tone = "paper", title, flush, as = "section", className, children, ...rest }: PanelProps) {
  const Tag = as;
  return (
    <Tag className={[css.panel, css[tone], flush ? css.flush : "", className ?? ""].filter(Boolean).join(" ")} {...rest}>
      {title ? <h2 className={css.title}>{title}</h2> : null}
      {children}
    </Tag>
  );
}
