import { describe, expect, it } from "vitest";
import {
  createInMemoryBackend,
  createInMemoryKms,
  createSceneStore,
  SceneStoreConflictError,
} from "@gen-gaming/scene-store";
import type { Scene } from "@gen-gaming/regen-runtime";

function s(version: number, tenantId = "t1", caption?: string): Scene {
  const out: Scene = {
    version,
    width: 320,
    height: 180,
    tenantId,
    entities: [{ id: "hero", kind: "hero", x: 10, y: 10, w: 16, h: 16, color: "#fff" }],
  };
  if (caption !== undefined) out.caption = caption;
  return out;
}

describe("scene-store", () => {
  it("happy: round-trips an encrypted scene", async () => {
    const backend = createInMemoryBackend();
    const store = createSceneStore({ backend, kms: createInMemoryKms() });

    await store.put(s(0, "tenantA", "first"), "scene-1", 0);
    const got = await store.get("tenantA", "scene-1");
    expect(got).toBeTruthy();
    expect(got?.caption).toBe("first");
    expect(got?.tenantId).toBe("tenantA");

    // Stored body is NOT plaintext.
    const stored = backend._data.get("tenants/tenantA/scenes/scene-1.json.enc");
    expect(stored).toBeTruthy();
    const asText = new TextDecoder().decode(stored!.body);
    expect(asText.includes("first")).toBe(false);
    expect(asText.includes("tenantA")).toBe(false);
  });

  it("happy: returns null for missing keys", async () => {
    const store = createSceneStore({
      backend: createInMemoryBackend(),
      kms: createInMemoryKms(),
    });
    expect(await store.get("nope", "nope")).toBeNull();
  });

  it("error: rejects put when expectedVersion mismatches", async () => {
    const store = createSceneStore({
      backend: createInMemoryBackend(),
      kms: createInMemoryKms(),
    });
    await store.put(s(0), "scene-1", 0);
    await store.put(s(1), "scene-1", 0);

    // Now stored version is 1; expecting 0 should conflict.
    await expect(store.put(s(2), "scene-1", 0)).rejects.toBeInstanceOf(
      SceneStoreConflictError,
    );
  });

  it("error: rejects put when key exists but caller passes expected=0", async () => {
    const store = createSceneStore({
      backend: createInMemoryBackend(),
      kms: createInMemoryKms(),
    });
    await store.put(s(0), "scene-1", 0);
    // existing record is v0; expecting 5 is a conflict.
    await expect(store.put(s(6), "scene-1", 5)).rejects.toBeInstanceOf(
      SceneStoreConflictError,
    );
  });
});
