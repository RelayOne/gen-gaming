/**
 * regen-runtime — generative-gaming regen loop driver.
 *
 * Public surface:
 *   - types:  Scene, SceneEntity, RegenRequest, RegenResponse, RegenTrace
 *   - client: createR1Client, R1Client
 *   - driver: regen
 *
 * The driver is intentionally thin: it formats a request, calls R1, parses
 * the response, returns the new scene + a reasoning trace + observed latency.
 * It does NOT decide whether the output is safe to render; that is
 * `aegis-gate`'s job and the driver's caller is required to invoke it.
 */

export type {
  Scene,
  SceneEntity,
  RegenRequest,
  RegenResponse,
  RegenTrace,
} from "./types.js";

export { createR1Client } from "./r1-client.js";
export type { R1Client, R1ClientOptions } from "./r1-client.js";

export { regen } from "./regen.js";
export type { RegenOptions } from "./regen.js";

export { R1TimeoutError, R1ProtocolError } from "./errors.js";
