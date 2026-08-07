import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { activeSlot, encodeSave, loadSlot, wipe } from "./save.js";
import "./fonts.css";
import "./styles.css";

/**
 * The last line of defence. Without this, one render exception tears React
 * down to a blank page — and because the save persists BEFORE the render that
 * consumes it, a poisoned save turns that blank page into a permanent crash
 * loop that is indistinguishable from total data loss. The boundary's whole
 * job is to keep the hunter recoverable: show the rescue code, offer a
 * reload, and make wiping the slot an explicit last resort.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    let code: string | null = null;
    try {
      const save = loadSlot(activeSlot());
      if (save) code = encodeSave(save);
    } catch {
      // even the save is unreadable — the raw string may still help support
      try {
        code = localStorage.getItem("agoge.save.v1");
      } catch {
        code = null;
      }
    }
    return (
      <div className="shell">
        <main className="content">
          <div className="card" style={{ maxWidth: 560, margin: "40px auto", padding: 20 }}>
            <h2>The Rift flickered.</h2>
            <p className="muted">
              Something broke while drawing the game. Your hunter is still saved in this browser —
              copy the rescue code below somewhere safe, then reload.
            </p>
            {code && (
              <textarea
                className="rescue-out"
                readOnly
                value={code}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Rescue code — select and copy it"
              />
            )}
            <p className="muted small">{String(this.state.error)}</p>
            <div className="draft-actions">
              <button className="btn primary" onClick={() => location.reload()}>
                Reload
              </button>
              <button
                className="btn tiny danger"
                onClick={() => {
                  // Explicit last resort — only after the code above is theirs.
                  wipe();
                  location.reload();
                }}
              >
                Reset this hunter
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
