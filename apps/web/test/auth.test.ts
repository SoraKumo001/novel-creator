import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAuthSession,
  fetchAuthStatus,
  normalizeAuthSession,
  normalizeAuthUser,
  signInWithEmail,
} from "../src/lib/services/auth.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("auth service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizeAuthUser は user 形状を正規化すること", () => {
    expect(
      normalizeAuthUser({ id: "u1", email: "a@example.com", role: "admin" })
    ).toEqual({
      id: "u1",
      email: "a@example.com",
      name: null,
      role: "admin",
      disabled: null,
    });
    expect(normalizeAuthUser(null)).toBeNull();
    expect(normalizeAuthUser({ email: "a@example.com" })).toBeNull();
  });

  it("normalizeAuthSession は複数形状を受け付けること", () => {
    const user = { id: "u1", email: "a@example.com", role: "user" };
    expect(normalizeAuthSession({ user }).user?.id).toBe("u1");
    expect(normalizeAuthSession({ session: { user } }).user?.id).toBe("u1");
    expect(normalizeAuthSession(user).user?.id).toBe("u1");
    expect(normalizeAuthSession(null).user).toBeNull();
  });

  it("fetchAuthStatus は credentials:include で取得すること", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ initialized: true }));
    vi.stubGlobal("fetch", fetchMock);
    const status = await fetchAuthStatus();
    expect(status).toEqual({ initialized: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("include");
  });

  it("fetchAuthSession は 401 を未ログインとして扱うこと", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 }))
    );
    const session = await fetchAuthSession();
    expect(session.user).toBeNull();
  });

  it("signInWithEmail は email/password を POST すること", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/sign-in/email")) {
        return jsonResponse({
          user: { id: "u1", email: "a@example.com", role: "user" },
        });
      }
      return jsonResponse({ user: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    const session = await signInWithEmail("a@example.com", "secret123");
    expect(session.user?.email).toBe("a@example.com");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "a@example.com",
      password: "secret123",
    });
  });
});
