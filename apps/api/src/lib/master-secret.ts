/**
 * MASTER_SECRET から用途別の秘密を導出するユーティリティ。
 *
 * - Node.js 18+ と Cloudflare Workers の双方で動作するよう
 *   WebCrypto SubtleCrypto のみを使用する (node:crypto 禁止)。
 * - HKDF/SHA-256 で 32 バイトを導出し、info で用途分離する。
 * - 秘密の一元管理: 個別変数は存在しない。すべての用途は
 *   MASTER_SECRET から導出する。
 * - 導出値をログに出力してはならない。
 */

const AUTH_INFO = "novel-creator/auth-v1";
const ENC_INFO = "novel-creator/enc-v1";
const DERIVED_LENGTH_BITS = 256;
const BASE64_CHUNK_SIZE = 0x80_00;

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto SubtleCrypto is not available in this runtime.");
  }
  return subtle;
}

function assertMasterConfigured(
  master: string | undefined
): asserts master is string {
  if (!master?.trim()) {
    throw new Error("MASTER_SECRET is not configured.");
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + BASE64_CHUNK_SIZE)
    );
  }
  return btoa(binary);
}

async function deriveKeyBytes(
  master: string,
  info: string
): Promise<Uint8Array> {
  assertMasterConfigured(master);
  const subtle = getSubtleCrypto();
  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(master),
    { hash: "SHA-256", name: "HKDF" },
    false,
    ["deriveBits"]
  );
  const bits = await subtle.deriveBits(
    {
      hash: "SHA-256",
      info: new TextEncoder().encode(info),
      name: "HKDF",
      salt: new Uint8Array(0),
    },
    baseKey,
    DERIVED_LENGTH_BITS
  );
  return new Uint8Array(bits);
}

/** MASTER_SECRET が設定済みかどうか。 */
export function isMasterConfigured(env: {
  MASTER_SECRET?: string | null;
}): boolean {
  return !!env.MASTER_SECRET?.trim();
}

/** 用途分離した 32 バイト鍵を CryptoKey (AES-GCM) として導出する。 */
export async function deriveEncryptionCryptoKey(
  master: string
): Promise<CryptoKey> {
  const raw = await deriveKeyBytes(master, ENC_INFO);
  const buffer = new Uint8Array(raw).buffer as ArrayBuffer;
  return getSubtleCrypto().importKey(
    "raw",
    buffer,
    { name: "AES-GCM" },
    false,
    ["decrypt", "encrypt"]
  );
}

/** 暗号化保存用の base64 鍵を導出する。 */
export async function deriveEncryptionKeyBase64(
  master: string
): Promise<string> {
  const raw = await deriveKeyBytes(master, ENC_INFO);
  return encodeBase64(raw);
}

/** better-auth 用 secret を導出する (導出 32 バイトの base64)。 */
export async function deriveAuthSecret(master: string): Promise<string> {
  const raw = await deriveKeyBytes(master, AUTH_INFO);
  return encodeBase64(raw);
}
