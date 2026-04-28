import type { Scene } from "@gen-gaming/regen-runtime";
import type { SceneStore, SceneStoreOptions, StorageObject } from "./types.js";
import { SceneStoreConflictError } from "./errors.js";
import { decrypt, encrypt, generateDek, generateIv, utf8, utf8Decode } from "./crypto.js";

const DEFAULT_TIMEOUT_MS = 750;

export function createSceneStore(opts: SceneStoreOptions): SceneStore {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async get(tenantId: string, sceneId: string): Promise<Scene | null> {
      const key = makeKey(tenantId, sceneId);
      const obj = await withTimeout(
        opts.backend.get(key),
        timeoutMs,
        "scene-store.get",
      );
      if (!obj) return null;

      const dek = await opts.kms.unwrap(tenantId, obj.wrappedDek);
      try {
        const plaintext = await decrypt(dek, obj.iv, obj.body);
        const parsed = JSON.parse(utf8Decode(plaintext)) as Scene;
        if (parsed.tenantId !== tenantId) {
          throw new Error(
            `scene-store: tenant mismatch in stored scene (got ${parsed.tenantId}, expected ${tenantId})`,
          );
        }
        return parsed;
      } finally {
        zero(dek);
      }
    },

    async put(scene: Scene, sceneId: string, expectedVersion: number): Promise<void> {
      const key = makeKey(scene.tenantId, sceneId);

      // Pre-flight: confirm the storage object's version matches the version
      // the caller expected to overwrite. We trust the backend's ifMatch
      // for the actual write, but doing a get gives us a useful error.
      const existing = await withTimeout(
        opts.backend.get(key),
        timeoutMs,
        "scene-store.put.preflight",
      );

      if (existing) {
        const observed = parseVersionTag(existing.storageVersion);
        if (observed !== expectedVersion) {
          throw new SceneStoreConflictError(expectedVersion, existing.storageVersion);
        }
      } else if (expectedVersion !== 0) {
        // If there's nothing in the store, only allow a "create" (expected=0).
        throw new SceneStoreConflictError(expectedVersion, null);
      }

      const dek = await generateDek();
      try {
        const iv = generateIv();
        const wrappedDek = await opts.kms.wrap(scene.tenantId, dek);
        const plaintext = utf8(JSON.stringify(scene));
        const body = await encrypt(dek, iv, plaintext);

        const newStorageVersion = makeVersionTag(scene.version);
        const obj: StorageObject = { body, iv, wrappedDek, storageVersion: newStorageVersion };
        await withTimeout(
          opts.backend.put(key, obj, existing?.storageVersion ?? null),
          timeoutMs,
          "scene-store.put",
        );
      } finally {
        zero(dek);
      }
    },
  };
}

function makeKey(tenantId: string, sceneId: string): string {
  // R2 key layout: tenants/<tenantId>/scenes/<sceneId>.json.enc
  // Per-tenant prefix lets us scope IAM + lifecycle rules per tenant.
  return `tenants/${tenantId}/scenes/${sceneId}.json.enc`;
}

function makeVersionTag(v: number): string {
  return `v${v}`;
}

function parseVersionTag(tag: string): number {
  if (!tag.startsWith("v")) return -1;
  const n = Number(tag.slice(1));
  return Number.isFinite(n) ? n : -1;
}

function zero(buf: Uint8Array): void {
  buf.fill(0);
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}
