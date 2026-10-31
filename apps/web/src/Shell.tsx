/** The page frame every screen sits in: header, breadcrumb, footer. */

export function Shell({
  children,
  header,
  crumb,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  /** where you are, e.g. "Hall / Arena" */
  crumb?: string;
}) {
  return (
    <div className="shell">
      {header}
      {crumb && (
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumb.split(" / ").map((part, i, all) => (
            <span key={part}>
              {i > 0 && <span className="crumb-sep">/</span>}
              <span className={i === all.length - 1 ? "crumb on" : "crumb"}>{part}</span>
            </span>
          ))}
        </nav>
      )}
      <main className="content">{children}</main>
      <footer className="foot">
        RANK ZERO prototype — deterministic sim v1 · your progress is saved in this browser
        <br />
        characters and weapons from the LPC universal sprite set (CC BY-SA 3.0 / GPL 3.0) ·
        arenas, icons and pets drawn in-engine
      </footer>
    </div>
  );
}

