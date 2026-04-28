/**
 * scene-store — versioned, per-tenant encrypted scene state.
 *
 * Storage backend is R2 (S3-compatible). KMS-wrapped envelope encryption:
 *   - Per scene: a fresh 256-bit DEK encrypts the JSON payload (AES-GCM).
 *   - The DEK is wrapped by the tenant's KMS key and stored alongside.
 *   - Reading: unwrap DEK via KMS, decrypt payload.
 *
 * The store uses optimistic concurrency: each `put` requires the caller to
 * pass `expectedVersion`. If R2 already has a higher version, `put` throws
 * `SceneStoreConflictError` and the caller is expected to re-read + retry.
 *
 * The default backend is HTTP (so the demo can run anywhere). Tests inject
 * an in-memory backend via `createInMemoryBackend`.
 */

export type {
  SceneStore,
  SceneStoreOptions,
  StorageBackend,
  KmsClient,
  StorageObject,
} from "./types.js";

export { createSceneStore } from "./store.js";
export { createInMemoryBackend, createInMemoryKms } from "./in-memory-backend.js";
export { SceneStoreConflictError, SceneStoreNotFoundError } from "./errors.js";
