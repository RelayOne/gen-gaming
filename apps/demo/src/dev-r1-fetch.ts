/**
 * Dev fetch — stands in for the real R1 endpoint until secrets are wired.
 * Returns a deterministic mutation of the input scene that demonstrates the
 * round-trip: bumps the version, jiggles the hero entity, and adds a tiny
 * new entity inferred from the prompt.
 *
 * This is wired ONLY when `useDevFakes` is true (no R1_ENDPOINT configured).
 * Production builds skip this entirely and use the real fetch.
 */

import type { Scene, SceneEntity } from "@gen-gaming/regen-runtime";

export const devR1Fetch: typeof fetch = async (_url, init) => {
  const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
    scene: Scene;
    prompt: string;
  };
  const scene = body.scene;
  const prompt = body.prompt;

  // Simulate ~250-450ms latency.
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 200));

  const next: Scene = {
    ...scene,
    version: scene.version + 1,
    caption: `${prompt.slice(0, 80)}`,
    entities: scene.entities.map((e) =>
      e.id === "hero"
        ? { ...e, x: clamp(e.x + 12, 0, scene.width - e.w) }
        : e,
    ),
  };

  // Add a new entity derived from the prompt.
  const seed = hash(prompt);
  const newEntity: SceneEntity = {
    id: `gen-${scene.version + 1}`,
    kind: pickKind(prompt),
    x: 60 + (seed % Math.max(1, scene.width - 120)),
    y: 30 + ((seed >> 4) % Math.max(1, scene.height - 60)),
    w: 14,
    h: 14,
    color: pickColor(seed),
    description: prompt,
  };
  next.entities = [...next.entities, newEntity];

  const responseBody = JSON.stringify({
    scene: next,
    trace: {
      model: "dev-fake-r1@0.1",
      reasoning: `dev: moved hero +12px, spawned ${newEntity.kind} from prompt`,
      request_id: `dev-${Date.now()}`,
      usage: { prompt_tokens: prompt.length, completion_tokens: 64 },
    },
  });

  return new Response(responseBody, {
    status: 200,
    headers: { "content-type": "application/json", "x-request-id": `dev-${Date.now()}` },
  });
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pickKind(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("goblin")) return "goblin";
  if (p.includes("tree")) return "tree";
  if (p.includes("coin")) return "coin";
  if (p.includes("door")) return "door";
  return "obj";
}
function pickColor(seed: number): string {
  const palette = ["#f5a524", "#ef4444", "#22c55e", "#a78bfa", "#06b6d4"];
  const i = palette[seed % palette.length];
  return i ?? "#888";
}
