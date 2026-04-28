/**
 * Wire types shared by the regen driver and the demo. Kept deliberately
 * small so the R1 prompt stays cheap and parseable.
 */

export interface SceneEntity {
  /** Stable id; R1 must preserve ids across regens unless removing the entity. */
  id: string;
  /** Free-form short label, e.g. "hero", "goblin", "exit". */
  kind: string;
  /** Top-left x in scene-units (0..scene.width). */
  x: number;
  /** Top-left y in scene-units (0..scene.height). */
  y: number;
  /** Width in scene-units. */
  w: number;
  /** Height in scene-units. */
  h: number;
  /** CSS colour string. */
  color: string;
  /** Optional plain-text description used for AEGIS classification. */
  description?: string;
}

export interface Scene {
  /** Server-issued scene version; bumps on every successful regen. */
  version: number;
  /** Scene-units; the demo maps these onto canvas pixels. */
  width: number;
  height: number;
  /** Tenant id used for envelope encryption in scene-store. */
  tenantId: string;
  /** Entities currently in the scene. Order is render order. */
  entities: SceneEntity[];
  /** Free-form short caption shown above the canvas. */
  caption?: string;
}

export interface RegenRequest {
  scene: Scene;
  prompt: string;
  /** Optional steering hints appended after the user prompt. */
  steering?: string;
}

export interface RegenTrace {
  /** Wall-clock ms spent in the R1 call. */
  latencyMs: number;
  /** Verbatim model name reported by R1, if any. */
  model?: string;
  /** Free-form chain-of-thought / "why" string from R1. */
  reasoning?: string;
  /** Token usage if R1 reported it. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
  /** Server request id; useful for correlating logs. */
  requestId?: string;
}

export interface RegenResponse {
  scene: Scene;
  trace: RegenTrace;
}
