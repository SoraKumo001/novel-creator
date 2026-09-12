import { apiFetch } from "../api-client.js";
import { parseResponseError } from "../errors.js";

/**
 * MCP APIキー RPC契約（APIレーン実装前提・モック分離用）。
 * Hono RPC 型 (`apiClient["mcp-keys"]`) が app.ts 登録後に連動するまでの間、
 * fetch 直叩きで動作するよう薄いラッパに留める。
 * モック時はこのモジュールの3関数を差し替えればよい。
 */

export interface McpKey {
  createdAt: string;
  expiresAt?: string | null;
  id: string;
  masked: string;
  name: string;
  novelId: string;
  novelTitle?: string | null;
  prefix: string;
  revokedAt?: string | null;
}

export interface CreateMcpKeyInput {
  expiresAt?: string | null;
  name: string;
  novelId: string;
}

export interface CreateMcpKeyResult {
  id: string;
  masked: string;
  plainKey: string;
  prefix: string;
}

interface ListMcpKeysResponse {
  keys: McpKey[];
}

export async function fetchMcpKeys(novelId?: string | null): Promise<McpKey[]> {
  const query = novelId ? `?novelId=${encodeURIComponent(novelId)}` : "";
  const res = await apiFetch(`/mcp-keys${query}`, { method: "GET" });
  if (!res.ok) {
    throw await parseResponseError(res, "MCP APIキー一覧の取得");
  }
  const data = (await res.json()) as ListMcpKeysResponse;
  return data.keys;
}

export async function createMcpKey(
  input: CreateMcpKeyInput
): Promise<CreateMcpKeyResult> {
  const res = await apiFetch("/mcp-keys", {
    body: JSON.stringify({
      expiresAt: input.expiresAt ?? null,
      name: input.name,
      novelId: input.novelId,
    }),
    method: "POST",
  });
  if (!res.ok) {
    throw await parseResponseError(res, "MCP APIキーの発行");
  }
  const data = (await res.json()) as CreateMcpKeyResult;
  return data;
}

export async function revokeMcpKey(id: string): Promise<void> {
  const res = await apiFetch(`/mcp-keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw await parseResponseError(res, "MCP APIキーの失効");
  }
}
