/** The bottom tab bar (56 px). Plain labels come from the caller (brief 3.1: Home, Kit, History). */
import css from "./TabBar.module.css";

export interface TabBarProps<K extends string> {
  /** `badge`: a count in a red disc on the tab (unspent talent points on Kit), with its own label. */
  tabs: readonly { key: K; label: string; badge?: { n: number; label: string } }[];
  active: K;
  onSelect(key: K): void;
  label?: string;
}

export function TabBar<K extends string>({ tabs, active, onSelect, label = "Main" }: TabBarProps<K>) {
  return (
    <nav className={css.bar} aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          className={[css.tab, t.key === active ? css.active : ""].filter(Boolean).join(" ")}
          aria-current={t.key === active ? "page" : undefined}
          onClick={() => onSelect(t.key)}
        >
          <span className={css.label}>{t.label}{t.badge !== undefined && t.badge.n > 0
            ? <span className={css.badge} aria-label={t.badge.label} data-testid="tab-badge">{t.badge.n}</span> : null}</span>
        </button>
      ))}
    </nav>
  );
}
