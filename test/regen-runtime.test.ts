import { describe, expect, it } from "vitest";
import {
  createR1Client,
  R1ProtocolError,
  R1TimeoutError,
  regen,
  type Scene,
} from "@gen-gaming/regen-runtime";

const baseScene: Scene = {
  version: 1,
  width: 320,
  height: 180,
  tenantId: "t1",
  entities: [{ id: "hero", kind: "hero", x: 10, y: 10, w: 16, h: 16, color: "#6cf" }],
};

function fakeOk(payload: object, headers: Record<string, string> = {}): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json", ...headers },
    })) as unknown as typeof fetch;
}

describe("regen-runtime", () => {
  it("happy path: returns parsed scene + trace + measured latency", async () => {
    let now = 1000;
    const tick = (): typeof fetch =>
      (async () => {
        now += 320;
        return new Response(
          JSON.stringify({
            scene: { version: 2, width: 320, height: 180, tenantId: "t1",
              entities: [{ id: "hero", kind: "hero", x: 22, y: 10, w: 16, h: 16, color: "#6cf" },
                         { id: "g1", kind: "goblin", x: 100, y: 80, w: 14, h: 14, color: "#f5a524" }],
              caption: "added a goblin" },
            trace: { model: "r1@1.0", reasoning: "added 1 entity", request_id: "req-abc",
                     usage: { prompt_tokens: 12, completion_tokens: 22 } },
          }),
          { status: 200, headers: { "content-type": "application/json", "x-request-id": "req-abc" } },
        );
      }) as unknown as typeof fetch;
    const client = createR1Client({ endpoint: "x", apiKey: "k", fetch: tick(), now: () => now });
    const out = await regen({ scene: baseScene, prompt: "add a goblin" }, { client });
    expect(out.scene.version).toBe(2);
    expect(out.scene.entities).toHaveLength(2);
    expect(out.scene.caption).toBe("added a goblin");
    expect(out.trace.latencyMs).toBe(320);
    expect(out.trace.model).toBe("r1@1.0");
    expect(out.trace.requestId).toBe("req-abc");
  });

  it("happy path: requires non-empty prompt", async () => {
    const client = createR1Client({
      endpoint: "x",
      apiKey: "x",
      fetch: (() => {
        throw new Error("should not be called");
      }) as unknown as typeof fetch,
    });
    await expect(
      regen({ scene: baseScene, prompt: "  " }, { client }),
    ).rejects.toThrow(/prompt is required/);
  });

  it("happy path: tolerates missing trace fields gracefully", async () => {
    const client = createR1Client({
      endpoint: "x", apiKey: "x", now: () => 0,
      fetch: fakeOk({ scene: { version: 5, width: 320, height: 180, tenantId: "t1", entities: [] } }),
    });
    const out = await regen({ scene: baseScene, prompt: "p" }, { client });
    expect(out.scene.version).toBe(5);
    expect(out.scene.entities).toHaveLength(0);
    expect(out.trace.reasoning).toBeUndefined();
  });

  it("error path: throws R1TimeoutError on AbortError", async () => {
    const fakeFetch = ((async (_url: string, init: RequestInit) => {
      await new Promise((_, reject) => {
        const signal = init.signal;
        signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }) as unknown) as typeof fetch;
    const client = createR1Client({ endpoint: "x", apiKey: "x", fetch: fakeFetch, timeoutMs: 25 });
    await expect(
      regen({ scene: baseScene, prompt: "p" }, { client }),
    ).rejects.toBeInstanceOf(R1TimeoutError);
  });

  it("error path: throws R1ProtocolError on HTTP 500", async () => {
    const fakeFetch = (async () =>
      new Response("oops", { status: 500 })) as unknown as typeof fetch;
    const client = createR1Client({ endpoint: "x", apiKey: "x", fetch: fakeFetch, now: () => 0 });
    await expect(
      regen({ scene: baseScene, prompt: "p" }, { client }),
    ).rejects.toBeInstanceOf(R1ProtocolError);
  });

  it("error path: throws R1ProtocolError on missing scene", async () => {
    const client = createR1Client({
      endpoint: "x", apiKey: "x", now: () => 0,
      fetch: fakeOk({ trace: {} }),
    });
    await expect(
      regen({ scene: baseScene, prompt: "p" }, { client }),
    ).rejects.toThrow(/missing `scene`/);
  });
});
