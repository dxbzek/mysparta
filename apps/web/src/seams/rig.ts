/**
 * SEAM FILE (work package 0). Only the Lead edits it, at integration points.
 * The one place where the app gets its rig. Screens and the fight screen import `rig` from
 * here and never from a rig package directly.
 *   G0: the capsule test double.
 *   I1: createRig(gatePack).
 *   I3: createRig(gatePack, contentPack).
 *   I3 fix (now): the content art is its own chunk, so the first screen does not wait for it
 *   (Initial JS budget, 180 KB gzip). `rig` starts as createRig(gatePack) and becomes
 *   createRig(gatePack, contentPack) when the chunk arrives (`loadFullRig`, started after the
 *   first paint by the app). `rig` is one stable object that forwards to the current rig, so a
 *   frame loop picks the full art up on its next frame; `useRigVersion` re-renders a tree that
 *   reads icons or portraits during render; `rigReady` tells a fight whether it may start.
 */
import { useSyncExternalStore } from "react";
import type { Rig } from "@rankzero/rig";
import { createRig, gatePack } from "@rankzero/rig";

let current: Rig = createRig(gatePack);
let ready = false;
let version = 0;
let loading: Promise<Rig> | null = null;
const listeners = new Set<() => void>();

export const rig: Rig = {
  clipInfo: (...a) => current.clipInfo(...a),
  samplePose: (...a) => current.samplePose(...a),
  drawActor: (...a) => current.drawActor(...a),
  handAnchor: (...a) => current.handAnchor(...a),
  drawProp: (...a) => current.drawProp(...a),
  drawStage: (...a) => current.drawStage(...a),
  strikePoint: (...a) => current.strikePoint(...a),
  hitPoint: (...a) => current.hitPoint(...a),
  drawFx: (...a) => current.drawFx(...a),
  portrait: (...a) => current.portrait(...a),
  companionPortrait: (...a) => current.companionPortrait(...a),
  icon: (...a) => current.icon(...a),
};

/** The content art has arrived and `rig` draws it. */
export function rigReady(): boolean { return ready; }

/** Loads the content chunk once and swaps the full rig in. Safe to call any number of times. */
export function loadFullRig(): Promise<Rig> {
  loading ??= import("@rankzero/rig/content").then(({ contentPack }) => {
    current = createRig(gatePack, contentPack);
    ready = true;
    version++;
    for (const l of [...listeners]) l();
    return rig;
  }).catch((error: unknown) => {
    loading = null;               // a failed fetch (offline) may be tried again
    throw error;
  });
  return loading;
}

export function subscribeRig(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** 0 with the gate art only, then 1 once the full rig is in: read it to re-render on the swap. */
export function useRigVersion(): number {
  return useSyncExternalStore(subscribeRig, () => version, () => version);
}
