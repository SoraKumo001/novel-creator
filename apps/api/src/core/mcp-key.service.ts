import { type Database, type McpApiKey, mcpApiKeys } from "@novel-creator/db";
import { desc, eq } from "drizzle-orm";
import { deriveEncryptionKeyBase64 } from "../lib/master-secret.js";
import { encryptSecret } from "../lib/secret-crypto.js";
import { assertFound, ValidationError } from "./types.js";

/** 発行トークンのプレフィックス。DB の prefix カラムは先頭8文字を格納する。 */
export const MCP_KEY_TOKEN_PREFIX = "mcp_";
const MCP_KEY_RANDOM_BYTES = 32;
const MCP_KEY_PREFIX_LENGTH = 8;

export interface CreateMcpKeyInput {
  expiresAt?: Date | null;
  name: string;
  novelId?: string | null;
  userId: string;
}

export interface CreatedMcpKey {
  plainKey: string;
  record: McpApiKey;
}

/**
 * トークン文字列の SHA-256 ハッシュ（hex）を求める。
 * WebCrypto のみを使用し、Node.js / Workers の双方で動作する。
 */
export async function hashMcpKeyToken(token: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 発行トークンを生成する（`mcp_` + 32byte base64url）。
 * 32byte → base64url 43文字のため全体は47文字になる。
 */
export function generateMcpKeyToken(): string {
  const bytes = globalThis.crypto.getRandomValues(
    new Uint8Array(MCP_KEY_RANDOM_BYTES)
  );
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  const base64url = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .split("=")[0];
  return `${MCP_KEY_TOKEN_PREFIX}${base64url}`;
}

/**
 * MCP API キーを発行する。平文は戻り値でのみ返し、DB には
 * SHA-256 ハッシュと enc:v1 暗号文を保管する（平文は保存しない）。
 * 暗号化鍵は MASTER_SECRET からの既存導出に限定する。
 */
export async function createMcpKey(
  db: Database,
  input: CreateMcpKeyInput,
  env: { MASTER_SECRET?: string | null }
): Promise<CreatedMcpKey> {
  if (!input.name?.trim()) {
    throw new ValidationError("Name is required");
  }
  if (!input.userId?.trim()) {
    throw new ValidationError("User ID is required");
  }
  if (!env.MASTER_SECRET?.trim()) {
    throw new ValidationError("MASTER_SECRET is not configured");
  }
  const secretKeyValue = await deriveEncryptionKeyBase64(env.MASTER_SECRET);

  const plainKey = generateMcpKeyToken();
  const [record] = await db
    .insert(mcpApiKeys)
    .values({
      encryptedKey: await encryptSecret(plainKey, secretKeyValue),
      expiresAt: input.expiresAt ?? null,
      keyHash: await hashMcpKeyToken(plainKey),
      name: input.name.trim(),
      novelId: input.novelId ?? null,
      prefix: plainKey.slice(0, MCP_KEY_PREFIX_LENGTH),
      userId: input.userId,
    })
    .returning();
  assertFound(record, "MCP API Key not found");
  return { plainKey, record };
}

/** 発行済みキーの一覧を取得する（平文は保持していないため含まない）。 */
export async function listMcpKeys(
  db: Database,
  userId: string
): Promise<McpApiKey[]> {
  return db
    .select()
    .from(mcpApiKeys)
    .where(eq(mcpApiKeys.userId, userId))
    .orderBy(desc(mcpApiKeys.createdAt));
}

/** キーを失効させる（revokedAt を設定する。物理削除はしない）。 */
export async function revokeMcpKey(
  db: Database,
  id: string
): Promise<McpApiKey> {
  const [row] = await db
    .update(mcpApiKeys)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(mcpApiKeys.id, id))
    .returning();
  assertFound(row, "MCP API Key not found");
  return row;
}

/**
 * 提示トークンを検証する。keyHash 照合→revokedAt/expiresAt 判定を行い、
 * 有効な場合のみレコードを返す。encryptedKey の復号は行わない。
 */
export async function verifyMcpKey(
  db: Database,
  token: string
): Promise<McpApiKey | null> {
  if (!token.startsWith(MCP_KEY_TOKEN_PREFIX)) {
    return null;
  }
  const [row] = await db
    .select()
    .from(mcpApiKeys)
    .where(eq(mcpApiKeys.keyHash, await hashMcpKeyToken(token)));
  if (!row) {
    return null;
  }
  if (row.revokedAt) {
    return null;
  }
  if (row.expiresAt && row.expiresAt <= new Date()) {
    return null;
  }
  return row;
}
