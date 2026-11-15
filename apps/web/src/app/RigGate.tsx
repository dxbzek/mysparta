/**
 * A fight never starts with missing art: the content art (weapons, shields, pets, arenas) is its
 * own chunk, loaded after the first paint (seams/rig.ts). A screen that shows a fight puts it
 * inside <RigGate>; the face-off waits here, behind a short loading line, until the full rig is
 * in. Usually the chunk has long arrived by the time a fight is opened, and nothing shows.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { loadFullRig, rigReady, useRigVersion } from "../seams/rig";
import { UI } from "../text/ui";
import { Panel } from "../ui/Panel";
import common from "../screens/common.module.css";

export function RigGate({ children }: { children: ReactNode }) {
  useRigVersion();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (rigReady()) return;
    let live = true;
    loadFullRig().catch((error: unknown) => {
      console.warn("rig: the content art did not load", error);
      if (live) setFailed(true);
    });
    return () => { live = false; };
  }, [attempt]);
  if (rigReady()) return <>{children}</>;
  return (
    <main className={common.body} aria-busy={!failed}>
      <Panel>
        <p role="status">{failed ? UI.bout.loadFailed : UI.bout.loading}</p>
        {failed && <button type="button" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>{UI.bout.retry}</button>}
      </Panel>
    </main>
  );
}
