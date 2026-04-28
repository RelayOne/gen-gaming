/**
 * Demo wiring: connects the prompt UI to the regen loop. Crucially,
 * the renderer is wired to `gate(...)` from `@gen-gaming/aegis-gate`,
 * not directly to `regen(...)`. There is no path that displays a scene
 * without going through the gate.
 */

import { regen, createR1Client } from "@gen-gaming/regen-runtime";
import type { RegenResponse, Scene } from "@gen-gaming/regen-runtime";
import { gate } from "@gen-gaming/aegis-gate";
import {
  createInMemoryBackend,
  createInMemoryKms,
  createSceneStore,
  SceneStoreConflictError,
} from "@gen-gaming/scene-store";

import { renderScene } from "./renderer.js";
import { initialScene } from "./initial-scene.js";
import { devClassifier } from "./dev-classifier.js";
import { devR1Fetch } from "./dev-r1-fetch.js";

const TENANT_ID = "demo-tenant";
const SCENE_ID = "demo-scene";

const env = await readEnv();
const r1ClientOpts: Parameters<typeof createR1Client>[0] = {
  endpoint: env.r1Endpoint,
  apiKey: env.r1ApiKey,
};
// In dev (no real R1), inject a deterministic local fetch.
if (env.useDevFakes) r1ClientOpts.fetch = devR1Fetch;
const r1Client = createR1Client(r1ClientOpts);
const classifier = env.useDevFakes
  ? devClassifier
  : (await import("@gen-gaming/aegis-gate")).createHttpAegisClassifier({
      endpoint: env.aegisEndpoint,
      apiKey: env.aegisApiKey,
    });

// scene-store backend: in-memory for the demo (per-tab session storage),
// real R2-backed backend would be plugged here for production. Encryption
// is identical in both paths (createSceneStore wraps the backend with
// AES-GCM + KMS regardless), so the encryption code path is exercised even
// in the demo's in-memory deployment.
const store = createSceneStore({
  backend: createInMemoryBackend(),
  kms: createInMemoryKms(),
});

const canvas = byId<HTMLCanvasElement>("scene");
const promptInput = byId<HTMLTextAreaElement>("prompt");
const regenBtn = byId<HTMLButtonElement>("regenerate");
const busy = byId<HTMLElement>("busy");
const captionEl = byId<HTMLElement>("caption");
const latencyEl = byId<HTMLElement>("latency");
const aegisEl = byId<HTMLElement>("aegis");
const reasoningEl = byId<HTMLElement>("reasoning");
const attemptsEl = byId<HTMLElement>("attempts");
const blockBanner = byId<HTMLElement>("block-banner");

// Mark demo mode in the UI when no real R1/AEGIS endpoints are configured.
if (env.useDevFakes) {
  const badge = document.createElement("div");
  badge.id = "demo-mode-badge";
  badge.textContent =
    "DEMO MODE — running with built-in fakes. R1 + AEGIS are scaffolded but not wired to live services on this deploy.";
  badge.style.cssText =
    "padding:8px 12px;border:1px solid var(--warn);color:var(--warn);background:rgba(245,165,36,0.08);border-radius:6px;font-size:12px;margin-bottom:12px;";
  const main = document.querySelector("main");
  const header = document.querySelector("header");
  if (main && header) main.insertBefore(badge, header.nextSibling);
}

let currentScene: Scene = initialScene(TENANT_ID);
await safePut(currentScene, /* expected */ 0);
renderScene(canvas, currentScene);
captionEl.textContent = currentScene.caption ?? "";

regenBtn.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    promptInput.focus();
    return;
  }

  setBusy(true);
  blockBanner.hidden = true;

  try {
    const result = await gate(
      prompt,
      async (effectivePrompt: string): Promise<RegenResponse> => {
        return regen(
          { scene: currentScene, prompt: effectivePrompt },
          { client: r1Client },
        );
      },
      { classifier, maxRetries: 3 },
    );

    if (result.verdict === "block") {
      const cat = result.classification.category ?? "policy-violation";
      blockBanner.hidden = false;
      blockBanner.textContent = `Content classified as ${cat} after ${result.attempts} attempts. Frame dropped.`;
      aegisEl.textContent = `block (${cat})`;
      attemptsEl.textContent = String(result.attempts);
      reasoningEl.textContent = result.classification.rationale ?? "—";
      latencyEl.textContent = "—";
      return;
    }

    // Persist and render.
    const next = result.scene;
    try {
      await store.put(next, SCENE_ID, currentScene.version);
    } catch (err) {
      if (err instanceof SceneStoreConflictError) {
        // Re-read, re-render, and bail; user can hit regenerate again.
        const fresh = await store.get(TENANT_ID, SCENE_ID);
        if (fresh) {
          currentScene = fresh;
          renderScene(canvas, currentScene);
          captionEl.textContent = currentScene.caption ?? "";
        }
        blockBanner.hidden = false;
        blockBanner.textContent =
          "Scene-store conflict — another writer advanced the scene. Reloaded; please retry.";
        return;
      }
      throw err;
    }
    currentScene = next;
    renderScene(canvas, currentScene);
    captionEl.textContent = currentScene.caption ?? "";
    latencyEl.textContent = `${Math.round(result.trace.latencyMs)} ms`;
    aegisEl.textContent = "allow";
    reasoningEl.textContent = result.trace.reasoning ?? "—";
    attemptsEl.textContent = String(result.attempts);
  } catch (err: unknown) {
    blockBanner.hidden = false;
    blockBanner.textContent = `Regen failed: ${
      (err as Error)?.message ?? String(err)
    }`;
  } finally {
    setBusy(false);
  }
});

function setBusy(b: boolean): void {
  regenBtn.disabled = b;
  busy.hidden = !b;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

async function safePut(scene: Scene, expected: number): Promise<void> {
  try {
    await store.put(scene, SCENE_ID, expected);
  } catch (err) {
    if (err instanceof SceneStoreConflictError) {
      // Another tab seeded; that's fine for the demo.
      return;
    }
    throw err;
  }
}

async function readEnv(): Promise<{
  r1Endpoint: string;
  r1ApiKey: string;
  aegisEndpoint: string;
  aegisApiKey: string;
  useDevFakes: boolean;
}> {
  // Resolution order:
  //   1. window.GEN_GAMING_CONFIG (set by inline <script> at deploy time)
  //   2. /runtime-config.json (fetched same-origin; written by Caddy)
  //   3. dev-fakes (the public demo)
  // The same-origin /runtime-config.json lets Cloud Run inject endpoints +
  // short-lived tokens without rebuilding the image.
  const w = globalThis as unknown as {
    GEN_GAMING_CONFIG?: {
      r1Endpoint?: string;
      r1ApiKey?: string;
      aegisEndpoint?: string;
      aegisApiKey?: string;
    };
  };
  let cfg = w.GEN_GAMING_CONFIG ?? {};
  if (!cfg.r1Endpoint || !cfg.aegisEndpoint) {
    try {
      const r = await fetch("/runtime-config.json", { cache: "no-store" });
      if (r.ok) {
        const fetched = (await r.json()) as typeof cfg;
        cfg = { ...cfg, ...fetched };
      }
    } catch {
      // network or parse failure -> fall through to dev-fakes
    }
  }
  const useDevFakes = !cfg.r1Endpoint || !cfg.aegisEndpoint;
  return {
    r1Endpoint: cfg.r1Endpoint ?? "https://cp.heroa.ai/v1/r1/exec",
    r1ApiKey: cfg.r1ApiKey ?? "dev-fake",
    aegisEndpoint: cfg.aegisEndpoint ?? "https://aegis.relayone.ai",
    aegisApiKey: cfg.aegisApiKey ?? "dev-fake",
    useDevFakes,
  };
}
