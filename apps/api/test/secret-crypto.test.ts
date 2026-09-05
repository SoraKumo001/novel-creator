import { describe, expect, it } from "vitest";
import {
  decryptApiKey,
  decryptSecret,
  ENCRYPTED_SECRET_PREFIX,
  encodeBase64,
  encryptApiKey,
  encryptSecret,
  generateEncryptionKeyBase64,
  isEncryptedSecret,
  maskApiKeyForDisplay,
  SecretCryptoError,
} from "../src/lib/secret-crypto.js";

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("secret-crypto", () => {
  it("base64 鍵で roundtrip できること", async () => {
    const key = generateEncryptionKeyBase64();
    const encrypted = await encryptSecret("sk-test-secret-value", key);
    expect(encrypted.startsWith(ENCRYPTED_SECRET_PREFIX)).toBe(true);
    expect(encrypted).not.toContain("sk-test-secret-value");
    await expect(decryptSecret(encrypted, key)).resolves.toBe(
      "sk-test-secret-value"
    );
  });

  it("hex 鍵で roundtrip できること", async () => {
    const raw = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const hexKey = toHex(raw);
    const encrypted = await encryptSecret("AIza-legacy-key-1234", hexKey);
    expect(isEncryptedSecret(encrypted)).toBe(true);
    await expect(decryptSecret(encrypted, hexKey)).resolves.toBe(
      "AIza-legacy-key-1234"
    );
  });

  it("同じ平文でも毎回異なる暗号文になること (ランダム IV)", async () => {
    const key = generateEncryptionKeyBase64();
    const first = await encryptSecret("same-plaintext", key);
    const second = await encryptSecret("same-plaintext", key);
    expect(first).not.toBe(second);
  });

  it("encryptApiKey は null/undefined/空文字を null に正規化すること", async () => {
    const key = generateEncryptionKeyBase64();
    await expect(encryptApiKey(null, key)).resolves.toBeNull();
    await expect(encryptApiKey(undefined, key)).resolves.toBeNull();
    await expect(encryptApiKey("   ", key)).resolves.toBeNull();
  });

  it("decryptApiKey はレガシー平文を鍵なしでそのまま返すこと (遅延移行)", async () => {
    await expect(decryptApiKey("sk-legacy-plaintext", undefined)).resolves.toBe(
      "sk-legacy-plaintext"
    );
    await expect(decryptApiKey(null, undefined)).resolves.toBeNull();
    await expect(decryptApiKey(undefined, undefined)).resolves.toBeUndefined();
  });

  it("鍵未設定時は暗号化で明示エラーになり秘密を含まないこと", async () => {
    const failure = await encryptApiKey("sk-super-secret", undefined).then(
      () => null,
      (error: unknown) => error
    );
    expect(failure).toBeInstanceOf(SecretCryptoError);
    expect(String((failure as Error).message)).toContain("MASTER_SECRET");
    expect(String((failure as Error).message)).not.toContain("sk-super-secret");
  });

  it("鍵未設定時は暗号文の復号で明示エラーになること", async () => {
    const key = generateEncryptionKeyBase64();
    const encrypted = await encryptSecret("sk-test", key);
    await expect(decryptSecret(encrypted, undefined)).rejects.toThrow(
      SecretCryptoError
    );
  });

  it("異なる鍵では復号できないこと", async () => {
    const key = generateEncryptionKeyBase64();
    const other = generateEncryptionKeyBase64();
    const encrypted = await encryptSecret("sk-test", key);
    await expect(decryptSecret(encrypted, other)).rejects.toThrow(
      SecretCryptoError
    );
  });

  it("不正な鍵・改ざんされた暗号文はエラーになること", async () => {
    await expect(encryptSecret("x", "too-short")).rejects.toThrow(
      SecretCryptoError
    );
    await expect(encryptSecret("x", "!!!not-base64!!!")).rejects.toThrow(
      SecretCryptoError
    );
    const key = generateEncryptionKeyBase64();
    const encrypted = await encryptSecret("sk-test", key);
    const tampered = `${encrypted.slice(0, -4)}AAAA`;
    await expect(decryptSecret(tampered, key)).rejects.toThrow(
      SecretCryptoError
    );
    await expect(decryptSecret("plain-value", key)).rejects.toThrow(
      SecretCryptoError
    );
  });

  it("isEncryptedSecret はプレフィックスで判定すること", () => {
    expect(isEncryptedSecret(`${ENCRYPTED_SECRET_PREFIX}abc`)).toBe(true);
    expect(isEncryptedSecret("sk-plain")).toBe(false);
    expect(isEncryptedSecret(null)).toBe(false);
    expect(isEncryptedSecret(undefined)).toBe(false);
  });

  it("maskApiKeyForDisplay は従来のマスク規則に従うこと", () => {
    expect(maskApiKeyForDisplay(null)).toEqual({
      apiKeyMasked: null,
      hasApiKey: false,
    });
    expect(maskApiKeyForDisplay("short")).toEqual({
      apiKeyMasked: "********",
      hasApiKey: true,
    });
    expect(maskApiKeyForDisplay("AIzaFakeKey12345678")).toEqual({
      apiKeyMasked: "AIza....5678",
      hasApiKey: true,
    });
  });

  it("encodeBase64 は 32 バイト鍵を可逆に変換できること", () => {
    const raw = globalThis.crypto.getRandomValues(new Uint8Array(32));
    expect(encodeBase64(raw).length).toBeGreaterThan(0);
  });
});
