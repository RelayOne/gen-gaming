/**
 * gate — the single chokepoint between regen output and renderer.
 *
 * Flow:
 *   - call regenOnce(prompt) -> RegenResponse
 *   - classify(scene, prompt) -> verdict
 *   - allow: return { verdict: "allow", scene, trace, classification, attempts }
 *   - block: build stricter prompt, retry regenOnce, classify again, up to maxRetries
 *   - exhaust: return { verdict: "block", classification, attempts }
 *
 * The gate accepts the regen callback rather than the regen-runtime client
 * directly, so the consumer can compose: gate(prompt, scene, regenAgain, opts).
 * This makes it impossible to skip the gate in production wiring — the demo
 * imports `gate`, not `regen`.
 */

import type { RegenResponse } from "@gen-gaming/regen-runtime";
import type { AegisGateOptions, AegisGateResult } from "./types.js";

export type RegenAttempt = (
  prompt: string,
  attemptIdx: number,
) => Promise<RegenResponse>;

export async function gate(
  initialPrompt: string,
  regenOnce: RegenAttempt,
  opts: AegisGateOptions,
): Promise<AegisGateResult> {
  const maxRetries = opts.maxRetries ?? 3;
  const buildRetry = opts.buildRetryPrompt ?? defaultBuildRetryPrompt;

  let prompt = initialPrompt;
  let lastClassification = undefined as
    | undefined
    | Awaited<ReturnType<typeof opts.classifier.classify>>;

  // Total attempts = 1 initial + maxRetries retries
  for (let attempt = 1; attempt <= 1 + maxRetries; attempt++) {
    const response = await regenOnce(prompt, attempt);
    const classification = await opts.classifier.classify({
      scene: response.scene,
      prompt,
    });
    lastClassification = classification;

    if (classification.verdict === "allow") {
      return {
        verdict: "allow",
        attempts: attempt,
        scene: response.scene,
        trace: response.trace,
        classification,
      };
    }

    // Blocked. Drop the frame and retry with a stricter prompt.
    prompt = buildRetry(initialPrompt, classification);
  }

  return {
    verdict: "block",
    attempts: 1 + maxRetries,
    classification: lastClassification ?? {
      verdict: "block",
      category: "policy-violation",
      rationale: "exhausted retries with no classification",
    },
  };
}

function defaultBuildRetryPrompt(
  original: string,
  blocked: { category?: string; rationale?: string },
): string {
  const cat = blocked.category ?? "policy-violation";
  return [
    original,
    "",
    `STRICTER GUIDANCE: previous output was blocked for ${cat}.`,
    "Avoid: graphic violence, sexual content, hate, self-harm, deceptive realism.",
    "Keep entities abstract, stylised, and family-safe.",
  ].join("\n");
}
