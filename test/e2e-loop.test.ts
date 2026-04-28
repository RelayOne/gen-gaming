/**
 * End-to-end: regen-runtime -> aegis-gate -> scene-store, in process.
 * This is the closest we can get to the demo flow without spinning up
 * Vite + Playwright. It exercises the same wiring main.ts uses.
 */

import { describe, expect, it } from "vitest";
import {
  createR1Client,
  regen,
  type RegenResponse,
  type Scene,
} from "@gen-gaming/regen-runtime";
import { gate, type AegisClassifier } from "@gen-gaming/aegis-gate";
import {
  createInMemoryBackend,
  createInMemoryKms,
  createSceneStore,
} from "@gen-gaming/scene-store";

function fakeR1Fetch(): typeof fetch {
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { scene: Scene; prompt: string };
    const v = body.scene.version + 1;
    return new Response(
      JSON.stringify({
        scene: { ...body.scene, version: v, caption: body.prompt },
        trace: { model: "test-r1", reasoning: "ok", request_id: `req-${v}` },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
}

const allowAll: AegisClassifier = {
  async classify() {
    return { verdict: "allow", latencyMs: 1 };
  },
};

describe("e2e loop", () => {
  it("regen -> gate -> store: end-to-end happy path persists v1 scene", async () => {
    const r1 = createR1Client({ endpoint: "x", apiKey: "k", fetch: fakeR1Fetch(), now: () => 0 });
    const store = createSceneStore({ backend: createInMemoryBackend(), kms: createInMemoryKms() });
    const initial: Scene = { version: 0, width: 320, height: 180, tenantId: "demo", entities: [] };
    await store.put(initial, "scene-1", 0);
    const result = await gate(
      "add a tree",
      async (p: string): Promise<RegenResponse> =>
        regen({ scene: initial, prompt: p }, { client: r1 }),
      { classifier: allowAll },
    );
    expect(result.verdict).toBe("allow");
    if (result.verdict !== "allow") return;
    await store.put(result.scene, "scene-1", initial.version);
    const persisted = await store.get("demo", "scene-1");
    expect(persisted?.version).toBe(1);
    expect(persisted?.caption).toBe("add a tree");
  });
});
