/**
 * SEAM FILE (work package 0). Only the Lead edits it, at integration points.
 * Exports the frozen contract and, since I1, `createRig`, `gatePack` and `palette`;
 * at I3 also `contentPack`. The capsule test double is a separate entry: "@rankzero/rig/testing".
 */
export * from "./contracts";
export { createRig } from "./engine/createRig";
export { gatePack, palette } from "./gate/pack";
