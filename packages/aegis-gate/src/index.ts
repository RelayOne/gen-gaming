/**
 * aegis-gate — wraps every regen output with AEGIS classification BEFORE
 * the renderer can display it. Contract:
 *
 *   1. Caller passes a `RegenResponse` plus a `regenAgain` callback.
 *   2. Gate calls AEGIS to classify the output.
 *   3. If allowed, gate returns { verdict: "allow", scene, trace }.
 *   4. If blocked, gate drops the frame, calls `regenAgain` with a stricter
 *      prompt, and re-classifies. Up to `maxRetries` (default 3).
 *   5. After exhausting retries, gate returns { verdict: "blocked", category, attempts }.
 *
 * The AEGIS endpoint is coordinated with the AEGIS-DETECTOR-BUILD agent (see
 * `/home/eric/repos/plans/agents/agent-AEGIS-BUILD-progress.md`). Until that
 * service is provisioned, callers can pass a local `classify` function via
 * `AegisGateOptions.classify`. The default classifier is the HTTP one.
 */

export type {
  AegisVerdict,
  AegisCategory,
  AegisClassification,
  AegisAllowedResult,
  AegisBlockedResult,
  AegisGateResult,
  AegisGateOptions,
  AegisClassifier,
} from "./types.js";

export { createHttpAegisClassifier } from "./http-classifier.js";
export type { HttpAegisOptions } from "./http-classifier.js";

export { gate } from "./gate.js";
