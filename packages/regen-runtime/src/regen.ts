/**
 * Thin orchestrator around the R1 client. The driver itself does NOT enforce
 * AEGIS gating — that is the consumer's responsibility (see `aegis-gate`).
 * Keeping the gate outside the driver makes it impossible to "accidentally"
 * call the driver and skip the gate: the driver returns an unsafe scene and
 * the wiring layer is required to pass it through aegis-gate before the
 * renderer ever sees it.
 *
 * The exported `regen` function is sugar for `client.exec(req)` plus a small
 * amount of contract-checking so unit tests can target `regen` directly.
 */

import type { R1Client } from "./r1-client.js";
import type { RegenRequest, RegenResponse } from "./types.js";

export interface RegenOptions {
  client: R1Client;
}

export async function regen(
  req: RegenRequest,
  opts: RegenOptions,
): Promise<RegenResponse> {
  if (!req.prompt || req.prompt.trim().length === 0) {
    throw new Error("regen: prompt is required");
  }
  if (!req.scene) {
    throw new Error("regen: scene is required");
  }
  return opts.client.exec(req);
}
