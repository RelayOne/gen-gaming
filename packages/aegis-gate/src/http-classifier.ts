/**
 * Real HTTP classifier for the AEGIS service. Coordinated with the
 * AEGIS-DETECTOR-BUILD agent — endpoint shape:
 *
 *   POST {endpoint}/v1/classify
 *   { "subject": { "kind": "gen-gaming.scene", "scene": ..., "prompt": ... } }
 *   ->
 *   { "verdict": "allow"|"block", "category": "...", "rationale": "...", "request_id": "..." }
 */

import type { AegisClassification, AegisClassifier, AegisCategory } from "./types.js";

export interface HttpAegisOptions {
  endpoint: string;
  apiKey: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  now?: () => number;
}

const DEFAULT_TIMEOUT_MS = 1000;

const KNOWN_CATEGORIES: ReadonlySet<AegisCategory> = new Set([
  "violence",
  "sexual",
  "self-harm",
  "hate",
  "harassment",
  "csam",
  "deception",
  "policy-violation",
  "other",
]);

export function createHttpAegisClassifier(opts: HttpAegisOptions): AegisClassifier {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error(
      "createHttpAegisClassifier: no fetch available. Pass `fetch` explicitly.",
    );
  }
  const now = opts.now ?? (() => Date.now());
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async classify({ scene, prompt }): Promise<AegisClassification> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const started = now();

      let raw: Response;
      try {
        raw = await fetchImpl(`${trimSlash(opts.endpoint)}/v1/classify`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${opts.apiKey}`,
            "x-gen-gaming-client": "aegis-gate/0.1.0",
          },
          body: JSON.stringify({
            subject: { kind: "gen-gaming.scene", scene, prompt },
          }),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        // Fail closed: if AEGIS is unreachable we BLOCK, never default-allow.
        return {
          verdict: "block",
          category: "policy-violation",
          rationale: `AEGIS unreachable: ${(err as Error)?.message ?? String(err)}`,
          latencyMs: now() - started,
        };
      } finally {
        clearTimeout(timer);
      }

      const latencyMs = now() - started;

      if (!raw.ok) {
        // Fail closed on non-200.
        return {
          verdict: "block",
          category: "policy-violation",
          rationale: `AEGIS HTTP ${raw.status}`,
          latencyMs,
        };
      }

      let parsed: unknown;
      try {
        parsed = await raw.json();
      } catch {
        return {
          verdict: "block",
          category: "policy-violation",
          rationale: "AEGIS non-JSON response",
          latencyMs,
        };
      }

      return parseClassification(parsed, latencyMs);
    },
  };
}

function parseClassification(body: unknown, latencyMs: number): AegisClassification {
  if (!body || typeof body !== "object") {
    return {
      verdict: "block",
      category: "policy-violation",
      rationale: "AEGIS response was not an object",
      latencyMs,
    };
  }
  const obj = body as Record<string, unknown>;
  const verdictRaw = obj["verdict"];
  const verdict = verdictRaw === "allow" ? "allow" : "block";
  const categoryRaw = obj["category"];
  const category = typeof categoryRaw === "string" &&
      KNOWN_CATEGORIES.has(categoryRaw as AegisCategory)
    ? (categoryRaw as AegisCategory)
    : verdict === "block"
    ? "policy-violation"
    : undefined;
  const rationale = typeof obj["rationale"] === "string"
    ? (obj["rationale"] as string)
    : undefined;
  const requestId = typeof obj["request_id"] === "string"
    ? (obj["request_id"] as string)
    : undefined;

  const out: AegisClassification = { verdict, latencyMs };
  if (category !== undefined) out.category = category;
  if (rationale !== undefined) out.rationale = rationale;
  if (requestId !== undefined) out.requestId = requestId;
  return out;
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
