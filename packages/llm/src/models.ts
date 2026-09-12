/**
 * OpenAI 互換エンドポイント (`GET {baseUrl}/models`) からモデル一覧を取得する。
 * openai / ollama / custom_openai 向け。Anthropic / Google は対象外。
 */
export async function listModels(
  baseUrl: string,
  apiKey?: string | null
): Promise<string[]> {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  const url = `${normalized}/models`;
  const headers: Record<string, string> = {};
  if (apiKey?.trim()) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  }
  const res = await fetch(url, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`モデル一覧の取得に失敗しました (${res.status})`);
  }
  const data: unknown = await res.json();
  if (typeof data !== "object" || data === null || !("data" in data)) {
    throw new Error("モデル一覧の形式が不正です");
  }
  const entries: unknown = (data as { data: unknown }).data;
  if (!Array.isArray(entries)) {
    throw new Error("モデル一覧の形式が不正です");
  }
  const ids: string[] = [];
  for (const entry of entries) {
    if (typeof entry === "object" && entry !== null && "id" in entry) {
      const id: unknown = (entry as { id: unknown }).id;
      if (typeof id === "string" && id.length > 0) {
        ids.push(id);
      }
    }
  }
  return ids;
}
