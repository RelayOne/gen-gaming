export class SceneStoreConflictError extends Error {
  readonly code = "SCENE_STORE_CONFLICT" as const;
  readonly expectedVersion: number;
  readonly observedStorageVersion: string | null;

  constructor(expectedVersion: number, observedStorageVersion: string | null) {
    super(
      `scene-store conflict: expected version ${expectedVersion}, observed ${
        observedStorageVersion ?? "none"
      }`,
    );
    this.name = "SceneStoreConflictError";
    this.expectedVersion = expectedVersion;
    this.observedStorageVersion = observedStorageVersion;
  }
}

export class SceneStoreNotFoundError extends Error {
  readonly code = "SCENE_STORE_NOT_FOUND" as const;
  constructor(key: string) {
    super(`scene-store: key not found: ${key}`);
    this.name = "SceneStoreNotFoundError";
  }
}
