import { apiFetch } from "@/lib/api-client.js";
import { parseResponseError } from "@/lib/errors.js";
import type {
  AddNovelMemberInput,
  AdminUser,
  AuthSession,
  AuthStatus,
  AuthUser,
  CreateUserInput,
  NovelMember,
  NovelMemberDisplayRole,
  NovelMemberRole,
  UpdateUserInput,
} from "@/lib/types.js";

/** better-auth 標準の picked user 形式など複数形状を AuthUser に正規化する */
export function normalizeAuthUser(raw: unknown): AuthUser | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || typeof obj.email !== "string") {
    return null;
  }
  const role = obj.role === "admin" ? "admin" : "user";
  return {
    id: obj.id,
    email: obj.email,
    name: typeof obj.name === "string" ? obj.name : null,
    role,
    disabled: typeof obj.disabled === "boolean" ? obj.disabled : null,
  };
}

/** GET /api/auth/session の複数レスポンス形状を AuthSession に正規化する */
export function normalizeAuthSession(raw: unknown): AuthSession {
  if (!raw || typeof raw !== "object") {
    return { user: null };
  }
  const obj = raw as Record<string, unknown>;
  if ("user" in obj) {
    return { user: normalizeAuthUser(obj.user) };
  }
  const session = obj.session as Record<string, unknown> | undefined;
  if (session && typeof session === "object" && "user" in session) {
    return { user: normalizeAuthUser(session.user) };
  }
  const maybeUser = normalizeAuthUser(obj);
  return { user: maybeUser };
}

async function postJson(path: string, body: unknown, actionName: string) {
  const res = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    throw await parseResponseError(res, actionName);
  }
  try {
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await apiFetch("/auth/status", { method: "GET" });
  if (!res.ok) {
    throw await parseResponseError(res, "初期化状態の取得");
  }
  const data = (await res.json()) as { initialized?: unknown };
  return { initialized: data.initialized === true };
}

export async function fetchAuthSession(): Promise<AuthSession> {
  const res = await apiFetch("/auth/get-session", { method: "GET" });
  if (!res.ok) {
    if (res.status === 401) {
      return { user: null };
    }
    throw await parseResponseError(res, "セッションの取得");
  }
  return normalizeAuthSession((await res.json()) as unknown);
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthSession> {
  const raw = await postJson(
    "/auth/sign-in/email",
    { email, password },
    "ログイン"
  );
  const session = normalizeAuthSession(raw);
  if (!session.user) {
    const refreshed = await fetchAuthSession();
    if (!refreshed.user) {
      throw new Error("ログインに失敗しました");
    }
    return refreshed;
  }
  return session;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string
): Promise<AuthSession> {
  const raw = await postJson(
    "/auth/sign-up/email",
    { email, password, name },
    "新規登録"
  );
  const session = normalizeAuthSession(raw);
  if (!session.user) {
    const refreshed = await fetchAuthSession();
    if (!refreshed.user) {
      throw new Error("新規登録に失敗しました");
    }
    return refreshed;
  }
  return session;
}

export async function signOut(): Promise<void> {
  await postJson("/auth/sign-out", {}, "ログアウト");
}

export async function setupInitialAdmin(
  email: string,
  password: string,
  name: string
): Promise<AuthSession> {
  const raw = await postJson(
    "/auth/setup",
    { email, password, name },
    "初期管理者の作成"
  );
  const session = normalizeAuthSession(raw);
  if (!session.user) {
    const refreshed = await fetchAuthSession();
    if (!refreshed.user) {
      throw new Error("初期管理者の作成に失敗しました");
    }
    return refreshed;
  }
  return session;
}

function normalizeAdminUser(raw: unknown): AdminUser {
  const user = normalizeAuthUser(raw);
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    id: user?.id ?? "",
    email: user?.email ?? "",
    name: user?.name ?? null,
    role: user?.role ?? "user",
    disabled: user?.disabled ?? null,
    createdAt:
      typeof obj.createdAt === "string" ? (obj.createdAt as string) : null,
  };
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const res = await apiFetch("/users", { method: "GET" });
  if (!res.ok) {
    throw await parseResponseError(res, "ユーザー一覧の取得");
  }
  const data = (await res.json()) as unknown;
  const list = Array.isArray(data) ? data : (data as { users?: unknown }).users;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizeAdminUser);
}

export async function createUserByAdmin(
  input: CreateUserInput
): Promise<AdminUser> {
  const raw = await postJson(
    "/users",
    {
      email: input.email,
      password: input.password,
      name: input.name,
      role: input.role ?? "user",
    },
    "ユーザーの作成"
  );
  const created =
    (raw as { user?: unknown } | null)?.user !== undefined
      ? (raw as { user: unknown }).user
      : raw;
  return normalizeAdminUser(created);
}

export async function updateUserByAdmin(
  id: string,
  input: UpdateUserInput
): Promise<AdminUser> {
  const res = await apiFetch(`/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw await parseResponseError(res, "ユーザーの更新");
  }
  const raw = (await res.json()) as unknown;
  const updated =
    (raw as { user?: unknown } | null)?.user !== undefined
      ? (raw as { user: unknown }).user
      : raw;
  return normalizeAdminUser(updated);
}

function normalizeNovelMember(raw: unknown): NovelMember {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const roleRaw = obj.role;
  const role: NovelMemberRole =
    roleRaw === "owner" ||
    roleRaw === "admin" ||
    roleRaw === "editor" ||
    roleRaw === "viewer"
      ? roleRaw
      : "viewer";
  return {
    userId: typeof obj.userId === "string" ? obj.userId : "",
    email: typeof obj.email === "string" ? obj.email : null,
    role,
  };
}

export async function fetchNovelMembers(
  novelId: string
): Promise<NovelMember[]> {
  const res = await apiFetch(`/novels/${encodeURIComponent(novelId)}/members`, {
    method: "GET",
  });
  if (!res.ok) {
    throw await parseResponseError(res, "メンバーの取得");
  }
  const data = (await res.json()) as unknown;
  const list = Array.isArray(data)
    ? data
    : (data as { members?: unknown }).members;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizeNovelMember);
}

export async function addNovelMember(
  novelId: string,
  input: AddNovelMemberInput
): Promise<NovelMember> {
  const res = await apiFetch(`/novels/${encodeURIComponent(novelId)}/members`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw await parseResponseError(res, "メンバーの追加");
  }
  const raw = (await res.json()) as unknown;
  const member =
    (raw as { member?: unknown } | null)?.member !== undefined
      ? (raw as { member: unknown }).member
      : raw;
  return normalizeNovelMember(member);
}

export async function updateNovelMemberRole(
  novelId: string,
  userId: string,
  role: NovelMemberDisplayRole
): Promise<NovelMember> {
  const res = await apiFetch(
    `/novels/${encodeURIComponent(novelId)}/members/${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify({ role }) }
  );
  if (!res.ok) {
    throw await parseResponseError(res, "メンバー権限の変更");
  }
  const raw = (await res.json()) as unknown;
  const member =
    (raw as { member?: unknown } | null)?.member !== undefined
      ? (raw as { member: unknown }).member
      : raw;
  return normalizeNovelMember(member);
}

export async function removeNovelMember(
  novelId: string,
  userId: string
): Promise<void> {
  const res = await apiFetch(
    `/novels/${encodeURIComponent(novelId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw await parseResponseError(res, "メンバーの削除");
  }
}
