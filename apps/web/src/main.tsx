import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/** Placeholder page. The app is mounted here at the integration points of the build plan. */
function Placeholder() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        background: "#1B1E3F",
        color: "#F4F5FA",
        font: "600 16px/1.4 system-ui, sans-serif",
      }}
    >
      <h1 style={{ margin: 0, font: "900 44px/1 system-ui, sans-serif", letterSpacing: "0.04em" }}>RANK ZERO</h1>
      <p style={{ margin: 0 }}>Name a scrapper. Watch them fight.</p>
      <p style={{ margin: 0, color: "#C9CCE0", fontWeight: 400 }}>The Yard is being rebuilt. Nothing to play yet.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Placeholder />
  </StrictMode>,
);
