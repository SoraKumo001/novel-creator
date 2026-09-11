import { describe, expect, it } from "vitest";

import {
  deriveAuthSecret,
  deriveEncryptionKeyBase64,
  isMasterConfigured,
} from "../src/lib/master-secret.js";
import { getSecretEncryptionKeyValue } from "../src/lib/secret-crypto.js";

describe("master-secret", () => {
  it("導出は決定的であること", async () => {
    const master = "test-master-secret-value-123";
    await expect(deriveAuthSecret(master)).resolves.toBe(
      await deriveAuthSecret(master)
    );
    await expect(deriveEncryptionKeyBase64(master)).resolves.toBe(
      await deriveEncryptionKeyBase64(master)
    );
  });

  it("用途分離で auth と enc は異なる値になること", async () => {
    const master = "test-master-secret-value-123";
    const auth = await deriveAuthSecret(master);
    const enc = await deriveEncryptionKeyBase64(master);
    expect(auth).not.toBe(enc);
  });

  it("導出 32 バイトが base64 として復号できること", async () => {
    const master = "another-master-secret";
    for (const value of [
      await deriveAuthSecret(master),
      await deriveEncryptionKeyBase64(master),
    ]) {
      const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
      expect(bytes.length).toBe(32);
    }
  });

  it("空文字 master はエラーになること", async () => {
    await expect(deriveAuthSecret("")).rejects.toThrow();
    await expect(deriveAuthSecret("   ")).rejects.toThrow();
    await expect(deriveEncryptionKeyBase64("")).rejects.toThrow();
  });

  it("isMasterConfigured は空文字を false とすること", () => {
    expect(isMasterConfigured({ MASTER_SECRET: "x" })).toBe(true);
    expect(isMasterConfigured({ MASTER_SECRET: "  " })).toBe(false);
    expect(isMasterConfigured({})).toBe(false);
  });

  it("暗号鍵解決は MASTER から導出し、未設定時は undefined を返すこと", async () => {
    const derived = await getSecretEncryptionKeyValue({
      MASTER_SECRET: "master-secret-value",
    });
    expect(derived).toBe(
      await deriveEncryptionKeyBase64("master-secret-value")
    );
    await expect(getSecretEncryptionKeyValue({})).resolves.toBeUndefined();
  });
});
