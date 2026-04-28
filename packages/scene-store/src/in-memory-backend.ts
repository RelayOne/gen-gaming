/**
 * In-memory backend used by tests and the dev demo. NOT for production.
 */

import type { StorageBackend, StorageObject, KmsClient } from "./types.js";
import { SceneStoreConflictError } from "./errors.js";

export function createInMemoryBackend(): StorageBackend & {
  /** Test helper. */
  _data: Map<string, StorageObject>;
} {
  const data = new Map<string, StorageObject>();
  return {
    _data: data,
    async get(key: string): Promise<StorageObject | null> {
      const v = data.get(key);
      return v ? clone(v) : null;
    },
    async put(key, obj, ifMatch): Promise<void> {
      const existing = data.get(key);
      const observed = existing?.storageVersion ?? null;
      if ((ifMatch ?? null) !== observed) {
        throw new SceneStoreConflictError(-1, observed);
      }
      data.set(key, clone(obj));
    },
  };
}

export function createInMemoryKms(): KmsClient {
  // Tests-only; wraps with a static XOR pad. Production uses GCP KMS.
  const PAD = new Uint8Array(32).map((_, i) => (i * 31 + 7) & 0xff);
  return {
    async wrap(_tenantId, dek): Promise<Uint8Array> {
      return xor(dek, PAD);
    },
    async unwrap(_tenantId, wrapped): Promise<Uint8Array> {
      return xor(wrapped, PAD);
    },
  };
}

function clone(o: StorageObject): StorageObject {
  return {
    body: new Uint8Array(o.body),
    iv: new Uint8Array(o.iv),
    wrappedDek: new Uint8Array(o.wrappedDek),
    storageVersion: o.storageVersion,
  };
}

function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i % b.length] ?? 0;
    out[i] = av ^ bv;
  }
  return out;
}
