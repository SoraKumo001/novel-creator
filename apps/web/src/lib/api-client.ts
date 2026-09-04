import type { ApiType } from "@novel-creator/api";
import { hc } from "hono/client";

export const API_BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3000";

/**
 * Cookieセッション (better-auth) のための fetch。
 * クロスオリジンでも Cookie を送受信できるよう credentials:include を付与する。
 * CORS 側も credentials 前提 (Access-Control-Allow-Credentials) で運用する。
 */
function credentialsFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, { ...init, credentials: "include" });
}

export const apiClient = hc<ApiType>(`${API_BASE_URL}/api`, {
  fetch: credentialsFetch,
});

/**
 * hono RPC 型に未登録のエンドポイント（認証系など契約先行のAPI）用の fetch。
 * 常に credentials:include で Cookie セッションを送受信する。
 */
export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body !== undefined && headers["Content-Type"] === undefined) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${API_BASE_URL}/api${normalized}`, {
    ...init,
    credentials: "include",
    headers,
  });
}
