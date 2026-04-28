/**
 * Tiny crypto helpers using Web Crypto (Node 20+ + browsers + edge).
 * AES-GCM with 96-bit IV and 128-bit auth tag, 256-bit DEK.
 */

const ALG = { name: "AES-GCM", length: 256 } as const;

export async function generateDek(): Promise<Uint8Array> {
  const key = await crypto.subtle.generateKey(ALG, true, ["encrypt", "decrypt"]);
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export function generateIv(): Uint8Array {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  return iv;
}

export async function encrypt(
  dek: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", toAB(dek), ALG, false, ["encrypt"]);
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toAB(iv) }, key, toAB(plaintext));
  return new Uint8Array(buf);
}

export async function decrypt(
  dek: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", toAB(dek), ALG, false, ["decrypt"]);
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toAB(iv) }, key, toAB(ciphertext));
  return new Uint8Array(buf);
}

/**
 * Web Crypto in TS lib.dom requires `ArrayBuffer` (not `SharedArrayBuffer`).
 * `Uint8Array<ArrayBufferLike>` widens too far; copying into a fresh
 * ArrayBuffer guarantees the right backing store.
 */
function toAB(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function utf8Decode(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}
