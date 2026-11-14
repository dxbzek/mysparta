/** The bottom tab bar (56 px). Plain labels come from the caller (brief 3.1: Home, Kit, History). */
import css from "./TabBar.module.css";

export interface TabBarProps<K extends string> {
  tabs: readonly { key: K; label: string }[];
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
          {t.label}
        </button>
      ))}
    </nav>
  );
}
