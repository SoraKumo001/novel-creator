/**
 * API キー等の機微情報を AES-GCM で暗号化して保存するためのユーティリティ (S0-1)。
 *
 * - Node.js 18+ と Cloudflare Workers の双方で動作するよう WebCrypto SubtleCrypto のみを使用する
 *   (node:crypto は使わない)。
 * - 暗号化鍵は環境変数 SECRET_ENCRYPTION_KEY 由来の 32 バイト鍵 (base64 または hex 形式)。
 * - DB カラムは text のまま保持し、暗号文は `enc:v1:<base64(iv || ciphertext)>` 形式で格納する。
 *   プレフィックスを持たない既存値は平文 (レガシー) として扱い、読み取りは維持するが、
 *   保存時には必ず暗号化する (平文互換の新規書き込みは行わない)。
 * - 秘密をログやエラー返却に含めないこと。エラーメッセージには鍵・平文・暗号文を載せない。
 */

export const ENCRYPTED_SECRET_PREFIX = "enc:v1:";

const AES_GCM_IV_LENGTH_BYTES = 12;
const ENCRYPTION_KEY_LENGTH_BYTES = 32;
const HEX_ENCODED_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;
const BASE64_CHUNK_SIZE = 0x80_00;

export class SecretCryptoError extends Error {
  constructor(
    message = "Secret encryption operation failed",
    options: { cause?: unknown } = {}
  ) {
    super(message, options);
    this.name = "SecretCryptoError";
  }
}

/**
 * 値が本モジュールで暗号化された暗号文かどうかを判定する。
 */
export function isEncryptedSecret(
  value: string | null | undefined
): value is string {
  return typeof value === "string" && value.startsWith(ENCRYPTED_SECRET_PREFIX);
}

/**
 * 表示用のマスク表現を生成する。復号済み (またはレガシー平文) のキーを受け取り、
 * マスク文字列と保有有無を返す。入力自体は呼び出し側で破棄すること。
 */
export function maskApiKeyForDisplay(key: string | null | undefined): {
  apiKeyMasked: string | null;
  hasApiKey: boolean;
} {
  if (!key?.trim()) {
    return { apiKeyMasked: null, hasApiKey: false };
  }
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return { apiKeyMasked: "********", hasApiKey: true };
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return { apiKeyMasked: `${prefix}....${suffix}`, hasApiKey: true };
}

/**
 * テスト・セットアップ用の 32 バイト暗号化鍵を base64 形式で生成する。
 */
export function generateEncryptionKeyBase64(): string {
  const bytes = globalThis.crypto?.getRandomValues(
    new Uint8Array(ENCRYPTION_KEY_LENGTH_BYTES)
  );
  if (!bytes) {
    throw new SecretCryptoError(
      "A secure random number generator is not available in this runtime."
    );
  }
  return encodeBase64(bytes);
}

/**
 * 保存向けに API キーを暗号化する。null / undefined / 空文字は null として扱う (キー削除)。
 * 鍵未設定時は SecretCryptoError を投げる (平文保存へのフォールバックは行わない)。
 */
export async function encryptApiKey(
  apiKey: string | null | undefined,
  secretKeyValue: string | undefined
): Promise<string | null> {
  if (apiKey === null || apiKey === undefined || !apiKey.trim()) {
    return null;
  }
  return encryptSecret(apiKey.trim(), secretKeyValue);
}

/**
 * 保存値を復号する。null / undefined はそのまま返し、空文字は null として扱う。
 * プレフィックスを持たない値はレガシー平文としてそのまま返す (遅延移行のため鍵不要)。
 * 暗号文の復号に鍵は必須で、未設定・不一致の場合は SecretCryptoError を投げる。
 */
export async function decryptApiKey(
  stored: string | null | undefined,
  secretKeyValue: string | undefined
): Promise<string | null | undefined> {
  if (stored === undefined) {
    return undefined;
  }
  if (stored === null || !stored.trim()) {
    return null;
  }
  if (!isEncryptedSecret(stored)) {
    return stored;
  }
  return decryptSecret(stored, secretKeyValue);
}

/**
 * 平文を AES-GCM で暗号化し、プレフィックス付き base64 暗号文を返す。
 */
export async function encryptSecret(
  plaintext: string,
  secretKeyValue: string | undefined
): Promise<string> {
  const key = await importEncryptionKey(secretKeyValue);
  const iv = globalThis.crypto.getRandomValues(
    new Uint8Array(AES_GCM_IV_LENGTH_BYTES)
  );
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = await getSubtleCrypto().encrypt(
    { iv, name: "AES-GCM" },
    key,
    data
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return `${ENCRYPTED_SECRET_PREFIX}${encodeBase64(combined)}`;
}

/**
 * 本モジュールで暗号化された値を復号する。プレフィックスを持たない値は受け付けない。
 */
export async function decryptSecret(
  stored: string,
  secretKeyValue: string | undefined
): Promise<string> {
  if (!isEncryptedSecret(stored)) {
    throw new SecretCryptoError("The value is not an encrypted secret.");
  }
  const key = await importEncryptionKey(secretKeyValue);
  const combined = decodeBase64ToBytes(
    stored.slice(ENCRYPTED_SECRET_PREFIX.length)
  );
  if (combined.length <= AES_GCM_IV_LENGTH_BYTES) {
    throw new SecretCryptoError("The encrypted secret is malformed.");
  }
  const iv = combined.slice(0, AES_GCM_IV_LENGTH_BYTES);
  const ciphertext = combined.slice(AES_GCM_IV_LENGTH_BYTES);
  try {
    const plaintext = await getSubtleCrypto().decrypt(
      { iv, name: "AES-GCM" },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plaintext);
  } catch (cause) {
    throw new SecretCryptoError(
      "Failed to decrypt the stored secret. The encryption key may be incorrect.",
      { cause }
    );
  }
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new SecretCryptoError(
      "WebCrypto SubtleCrypto is not available in this runtime."
    );
  }
  return subtle;
}

async function importEncryptionKey(
  secretKeyValue: string | undefined
): Promise<CryptoKey> {
  if (!secretKeyValue?.trim()) {
    throw new SecretCryptoError(
      "SECRET_ENCRYPTION_KEY is not configured. Set a 32-byte base64 or hex key."
    );
  }
  const raw = parseKeyBytes(secretKeyValue);
  try {
    return await getSubtleCrypto().importKey(
      "raw",
      raw,
      { name: "AES-GCM" },
      false,
      ["decrypt", "encrypt"]
    );
  } catch (cause) {
    throw new SecretCryptoError(
      "SECRET_ENCRYPTION_KEY could not be imported as an AES-GCM key.",
      { cause }
    );
  }
}

/**
 * 環境変数値を 32 バイト鍵として解釈する。64 文字の hex または base64 を受け付ける。
 */
function parseKeyBytes(secretKeyValue: string): Uint8Array<ArrayBuffer> {
  const trimmed = secretKeyValue.trim();
  const bytes = HEX_ENCODED_KEY_PATTERN.test(trimmed)
    ? decodeHex(trimmed)
    : decodeBase64ToBytes(trimmed);
  if (bytes.length !== ENCRYPTION_KEY_LENGTH_BYTES) {
    throw new SecretCryptoError(
      "SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes."
    );
  }
  return bytes;
}

function decodeHex(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Workers 対応のため Buffer を使わず base64 エンコードする。
 */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + BASE64_CHUNK_SIZE)
    );
  }
  return btoa(binary);
}

/**
 * base64 (base64url の `-`/`_` も許容) をデコードする。
 */
function decodeBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  let binary: string;
  try {
    binary = atob(normalized + "=".repeat(paddingLength));
  } catch (cause) {
    throw new SecretCryptoError(
      "SECRET_ENCRYPTION_KEY is not valid base64 or hex.",
      { cause }
    );
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
