import type { RegenResponse, Scene } from "@gen-gaming/regen-runtime";

export type AegisCategory =
  | "violence"
  | "sexual"
  | "self-harm"
  | "hate"
  | "harassment"
  | "csam"
  | "deception"
  | "policy-violation"
  | "other";

export type AegisVerdict = "allow" | "block";

export interface AegisClassification {
  verdict: AegisVerdict;
  /** Required when verdict === "block". */
  category?: AegisCategory;
  /** Free-form rationale, surfaced in dev UI. */
  rationale?: string;
  /** AEGIS service request id. */
  requestId?: string;
  /** Wall-clock ms spent in the AEGIS call. */
  latencyMs?: number;
}

export interface AegisClassifier {
  classify(input: {
    scene: Scene;
    /** The user-facing prompt that produced this scene. */
    prompt: string;
  }): Promise<AegisClassification>;
}

export interface AegisGateOptions {
  classifier: AegisClassifier;
  /** Default 3 — covers the "drop frame + retry up to 3x" requirement. */
  maxRetries?: number;
  /** Build a stricter prompt for retries. Default appends a fixed clause. */
  buildRetryPrompt?: (originalPrompt: string, blocked: AegisClassification) => string;
}

export interface AegisAllowedResult {
  verdict: "allow";
  attempts: number;
  scene: RegenResponse["scene"];
  trace: RegenResponse["trace"];
  classification: AegisClassification;
}

export interface AegisBlockedResult {
  verdict: "block";
  attempts: number;
  /** The last classification we got. */
  classification: AegisClassification;
}

export type AegisGateResult = AegisAllowedResult | AegisBlockedResult;
