import type { Scene } from "@gen-gaming/regen-runtime";

export interface SceneStoreOptions {
  backend: StorageBackend;
  kms: KmsClient;
  /**
   * Per-call timeout for backend ops. Defaults to 750ms so a slow store
   * never holds up the regen loop's <800ms target.
   */
  timeoutMs?: number;
}

export interface SceneStore {
  /** Read the current version of a tenant's scene. Returns null if absent. */
  get(tenantId: string, sceneId: string): Promise<Scene | null>;

  /**
   * Persist a new scene version. The caller MUST pass the version they
   * expect to overwrite (i.e. the version they read). If the store has
   * advanced past that, `put` throws `SceneStoreConflictError`.
   */
  put(scene: Scene, sceneId: string, expectedVersion: number): Promise<void>;
}

export interface StorageObject {
  body: Uint8Array;
  /** Storage-level version tag. Implementations use whatever fits. */
  storageVersion: string;
  /** Wrapped DEK (raw bytes). */
  wrappedDek: Uint8Array;
  /** Per-object random IV used for AES-GCM. */
  iv: Uint8Array;
}

export interface StorageBackend {
  get(key: string): Promise<StorageObject | null>;
  /** Throws ConflictError when ifMatch doesn't match the current storageVersion. */
  put(key: string, obj: StorageObject, ifMatch: string | null): Promise<void>;
}

export interface KmsClient {
  /** Returns wrappedDek bytes (opaque). */
  wrap(tenantId: string, dek: Uint8Array): Promise<Uint8Array>;
  /** Reverses wrap. */
  unwrap(tenantId: string, wrappedDek: Uint8Array): Promise<Uint8Array>;
}
