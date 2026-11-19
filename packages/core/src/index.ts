/**
 * SEAM FILE (work package 0). Only the Lead edits it, at integration points.
 * Today it exports the seeded random helpers and the frozen contracts.
 * Since I1 it also exports the sim (`./api`), checked against the frozen CoreApi.
 * Fixtures are a separate entry: "@rankzero/core/fixtures".
 */
export * from "./prng";
export * from "./contracts/ids";
export * from "./contracts/fighter";
export * from "./contracts/content";
export * from "./contracts/log";
export * from "./contracts/reduce";
export * from "./contracts/check";
export type * from "./contracts/api";
export * from "./api";

import type { CoreApi } from "./contracts/api";
import { api } from "./api";
const check: CoreApi = api;
void check;
