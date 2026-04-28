/**
 * Real R1 HTTP client. Posts a structured prompt to the configured endpoint
 * (typically https://cp.heroa.ai/v1/r1/exec) and parses the JSON envelope
 * back into a `Scene` + `RegenTrace`.
 *
 * The client is `fetch`-based and has no runtime dependencies beyond the
 * platform fetch (Node 20+, browsers, Cloud Run, edge runtimes). Tests can
 * inject a fake fetch via `R1ClientOptions.fetch`.
 */

import type {
  RegenRequest,
  RegenResponse,
  Scene,
  SceneEntity,
  RegenTrace,
} from "./types.js";
import { R1ProtocolError, R1TimeoutError } from "./errors.js";

export interface R1ClientOptions {
  endpoint: string;
  apiKey: string;
  /** Per-call timeout. Defaults to 1500ms (matches our hard ceiling). */
  timeoutMs?: number;
  /** Override fetch (used by tests). */
  fetch?: typeof fetch;
  /** Override Date.now (used by tests for deterministic latency). */
  now?: () => number;
}

export interface R1Client {
  exec(req: RegenRequest): Promise<RegenResponse>;
}

const DEFAULT_TIMEOUT_MS = 1500;

export function createR1Client(opts: R1ClientOptions): R1Client {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error(
      "createR1Client: no fetch available. Pass `fetch` explicitly.",
    );
  }
  const now = opts.now ?? (() => Date.now());
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async exec(req: RegenRequest): Promise<RegenResponse> {
      const body = buildR1Body(req);
      const started = now();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let raw: Response;
      try {
        raw = await fetchImpl(opts.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${opts.apiKey}`,
            "x-gen-gaming-client": "regen-runtime/0.1.0",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if (
          err instanceof DOMException && err.name === "AbortError" ||
          (err as { name?: string } | null)?.name === "AbortError"
        ) {
          throw new R1TimeoutError(timeoutMs);
        }
        throw new R1ProtocolError(
          `R1 fetch failed: ${(err as Error)?.message ?? String(err)}`,
        );
      } finally {
        clearTimeout(timer);
      }

      const latencyMs = now() - started;

      if (!raw.ok) {
        const snippet = await safeReadSnippet(raw);
        throw new R1ProtocolError(
          `R1 returned HTTP ${raw.status}`,
          raw.status,
          snippet,
        );
      }

      let parsed: unknown;
      try {
        parsed = await raw.json();
      } catch (err: unknown) {
        throw new R1ProtocolError(
          `R1 returned non-JSON: ${(err as Error)?.message ?? String(err)}`,
          raw.status,
        );
      }

      const { scene, trace } = parseR1Envelope(parsed, req.scene);
      const headerReqId = raw.headers.get("x-request-id") ?? undefined;
      const requestId = headerReqId ?? trace.requestId;
      const finalTrace: RegenTrace = { ...trace, latencyMs };
      if (requestId !== undefined) finalTrace.requestId = requestId;
      return { scene, trace: finalTrace };
    },
  };
}

interface R1WireRequest {
  task: "gen-gaming.regen";
  scene: Scene;
  prompt: string;
  steering?: string;
  schema_version: 1;
}

function buildR1Body(req: RegenRequest): R1WireRequest {
  const out: R1WireRequest = {
    task: "gen-gaming.regen",
    scene: req.scene,
    prompt: req.prompt,
    schema_version: 1,
  };
  if (req.steering !== undefined) {
    out.steering = req.steering;
  }
  return out;
}

function parseR1Envelope(
  body: unknown,
  inputScene: Scene,
): { scene: Scene; trace: RegenTrace } {
  if (!body || typeof body !== "object") {
    throw new R1ProtocolError("R1 response was not an object");
  }
  const obj = body as Record<string, unknown>;

  const sceneRaw = obj["scene"];
  if (!sceneRaw || typeof sceneRaw !== "object") {
    throw new R1ProtocolError("R1 response missing `scene`");
  }
  const scene = coerceScene(sceneRaw as Record<string, unknown>, inputScene);

  const traceRaw = (obj["trace"] ?? {}) as Record<string, unknown>;
  const usageRaw = (traceRaw["usage"] ?? {}) as Record<string, unknown>;
  const trace: RegenTrace = { latencyMs: 0 };
  if (typeof traceRaw["model"] === "string") trace.model = traceRaw["model"] as string;
  if (typeof traceRaw["reasoning"] === "string") trace.reasoning = traceRaw["reasoning"] as string;
  if (typeof traceRaw["request_id"] === "string") trace.requestId = traceRaw["request_id"] as string;
  const usage: { promptTokens?: number; completionTokens?: number } = {};
  if (typeof usageRaw["prompt_tokens"] === "number") usage.promptTokens = usageRaw["prompt_tokens"] as number;
  if (typeof usageRaw["completion_tokens"] === "number") usage.completionTokens = usageRaw["completion_tokens"] as number;
  if (usage.promptTokens !== undefined || usage.completionTokens !== undefined) {
    trace.usage = usage;
  }
  return { scene, trace };
}

function coerceScene(raw: Record<string, unknown>, fallback: Scene): Scene {
  const version = typeof raw["version"] === "number"
    ? (raw["version"] as number)
    : fallback.version + 1;
  const width = typeof raw["width"] === "number"
    ? (raw["width"] as number)
    : fallback.width;
  const height = typeof raw["height"] === "number"
    ? (raw["height"] as number)
    : fallback.height;
  const tenantId = typeof raw["tenantId"] === "string"
    ? (raw["tenantId"] as string)
    : fallback.tenantId;
  const captionRaw = raw["caption"];
  const caption = typeof captionRaw === "string" ? captionRaw : undefined;

  const entitiesRaw = Array.isArray(raw["entities"]) ? raw["entities"] : [];
  const entities = entitiesRaw.map((e, idx) => coerceEntity(e, idx));

  const out: Scene = {
    version,
    width,
    height,
    tenantId,
    entities,
  };
  if (caption !== undefined) out.caption = caption;
  return out;
}

function coerceEntity(raw: unknown, idx: number): SceneEntity {
  if (!raw || typeof raw !== "object") {
    throw new R1ProtocolError(`R1 returned non-object entity at index ${idx}`);
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r["id"] === "string" ? r["id"] : `e${idx}`;
  const kind = typeof r["kind"] === "string" ? r["kind"] : "shape";
  const x = num(r["x"], 0);
  const y = num(r["y"], 0);
  const w = num(r["w"], 16);
  const h = num(r["h"], 16);
  const color = typeof r["color"] === "string" ? r["color"] : "#888";
  const description = typeof r["description"] === "string"
    ? (r["description"] as string)
    : undefined;
  const out: SceneEntity = { id, kind, x, y, w, h, color };
  if (description !== undefined) out.description = description;
  return out;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

async function safeReadSnippet(res: Response): Promise<string | undefined> {
  try {
    const text = await res.text();
    return text.slice(0, 240);
  } catch {
    return undefined;
  }
}
