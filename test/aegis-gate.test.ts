import { describe, expect, it, vi } from "vitest";
import { gate, type AegisClassifier } from "@gen-gaming/aegis-gate";
import type { RegenResponse, Scene } from "@gen-gaming/regen-runtime";

const baseScene: Scene = {
  version: 1,
  width: 320,
  height: 180,
  tenantId: "t1",
  entities: [],
};

function fakeRegenResponse(prompt: string): RegenResponse {
  return {
    scene: { ...baseScene, version: baseScene.version + 1, caption: prompt },
    trace: { latencyMs: 50, model: "test" },
  };
}

describe("aegis-gate", () => {
  it("happy: allows on first attempt and returns scene + trace", async () => {
    const classifier: AegisClassifier = {
      classify: vi.fn(async () => ({ verdict: "allow" as const, latencyMs: 1 })),
    };
    const regenOnce = vi.fn(async (p: string) => fakeRegenResponse(p));

    const out = await gate("hello", regenOnce, { classifier });

    expect(out.verdict).toBe("allow");
    expect(out.attempts).toBe(1);
    if (out.verdict === "allow") {
      expect(out.scene.caption).toBe("hello");
    }
    expect(regenOnce).toHaveBeenCalledTimes(1);
    expect(classifier.classify).toHaveBeenCalledTimes(1);
  });

  it("retry: blocks once then allows; uses stricter prompt on retry", async () => {
    let n = 0;
    const classifier: AegisClassifier = {
      async classify() {
        n++;
        return n === 1
          ? { verdict: "block", category: "violence", rationale: "too violent", latencyMs: 1 }
          : { verdict: "allow", latencyMs: 1 };
      },
    };
    const seenPrompts: string[] = [];
    const out = await gate("make it intense", async (p: string) => {
      seenPrompts.push(p);
      return fakeRegenResponse(p);
    }, { classifier });
    expect(out.verdict).toBe("allow");
    expect(out.attempts).toBe(2);
    expect(seenPrompts).toHaveLength(2);
    expect(seenPrompts[0]).toBe("make it intense");
    expect(seenPrompts[1]).toContain("STRICTER GUIDANCE");
    expect(seenPrompts[1]).toContain("violence");
  });

  it("error: returns block after exhausting maxRetries (drops frame)", async () => {
    const classifier: AegisClassifier = {
      classify: vi.fn(async () => ({
        verdict: "block" as const,
        category: "harassment" as const,
        rationale: "nope",
        latencyMs: 1,
      })),
    };
    const regenOnce = vi.fn(async (p: string) => fakeRegenResponse(p));

    const out = await gate("anything", regenOnce, {
      classifier,
      maxRetries: 3,
    });

    expect(out.verdict).toBe("block");
    // 1 initial + 3 retries
    expect(out.attempts).toBe(4);
    expect(regenOnce).toHaveBeenCalledTimes(4);
    if (out.verdict === "block") {
      expect(out.classification.category).toBe("harassment");
    }
  });
});
