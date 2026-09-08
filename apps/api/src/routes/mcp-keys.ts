import { zValidator } from "@hono/zod-validator";
import type { McpApiKey } from "@novel-creator/db";
import { Hono } from "hono";
import type { AppContext } from "../context.js";
import {
  createMcpKey,
  listMcpKeys,
  revokeMcpKey,
} from "../core/mcp-key.service.js";
import {
  decryptApiKey,
  getSecretEncryptionKeyValue,
  maskApiKeyForDisplay,
} from "../lib/secret-crypto.js";
import { requireAdmin } from "../middleware/auth.js";
import { createMcpKeySchema, idParamSchema } from "../schemas/index.js";

/** 生キー・暗号文・ハッシュを除外した公開形（マスクなし）。 */
function stripSecretFields(row: McpApiKey) {
  const { encryptedKey: _encrypted, keyHash: _hash, ...rest } = row;
  return rest;
}

// MCP API キーの発行・管理は admin 限定とする。
const mcpKeysRouter = new Hono<AppContext>()
  .use(requireAdmin)
  // GET /api/mcp-keys - 発行済みキー一覧（生キー・暗号文・ハッシュは返さない）
  .get("/", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        401
      );
    }
    const rows = await listMcpKeys(c.get("db"), user.id);
    const secretKeyValue = await getSecretEncryptionKeyValue(c.get("env"));
    const keys = await Promise.all(
      rows.map(async (row) => {
        const apiKey = await decryptApiKey(row.encryptedKey, secretKeyValue);
        const { apiKeyMasked } = maskApiKeyForDisplay(apiKey);
        return { ...stripSecretFields(row), masked: apiKeyMasked };
      })
    );
    return c.json({ keys });
  })
  // POST /api/mcp-keys - キー新規発行（plainKey はこの初回応答でのみ返す）
  .post("/", zValidator("json", createMcpKeySchema), async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        401
      );
    }
    const body = c.req.valid("json");
    const { plainKey, record } = await createMcpKey(
      c.get("db"),
      {
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        name: body.name,
        novelId: body.novelId ?? null,
        userId: user.id,
      },
      c.get("env")
    );
    const { apiKeyMasked } = maskApiKeyForDisplay(plainKey);
    return c.json(
      {
        ...stripSecretFields(record),
        masked: apiKeyMasked,
        plainKey,
      },
      201
    );
  })
  // DELETE /api/mcp-keys/:id - キー失効（revokedAt を設定する）
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    await revokeMcpKey(c.get("db"), id);
    return c.json({ success: true });
  });

export default mcpKeysRouter;
