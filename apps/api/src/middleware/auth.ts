import {
  analysisResults,
  chapters,
  characters,
  chatMessages,
  chatSessions,
  contents,
  customPrompts,
  type Database,
  editHistories,
  foreshadowings,
  llmInstructions,
  novelMembers,
  sections,
  settings,
  timelines,
} from "@novel-creator/db";
import { and, eq } from "drizzle-orm";
import type { Context, Next } from "hono";

import type { AppContext, AuthSession, AuthUser } from "../context.js";
import { createAuth, isAuthConfigured } from "../lib/auth.js";

/** 小説への解決が可能なリソース種別。 */
export type NovelResource =
  | "novel"
  | "chapter"
  | "section"
  | "content"
  | "character"
  | "setting"
  | "timeline"
  | "foreshadowing"
  | "llmInstruction"
  | "analysisResult"
  | "history"
  | "customPrompt"
  | "chatSession"
  | "chatMessage";

/**
 * リソース ID から所有小説 ID を再解決する。
 * A: novel_id を直接持つテーブルは単一 SELECT で取得する。
 * B: 2-3 hop の JOIN で解決する (sections→chapters→novels,
 *    contents→sections→chapters, chat_messages→chat_sessions)。
 * C: query/body の novelId はヒント扱いとし、呼び出し元で本関数の
 *    再解決結果と突合する（不一致は 400 で拒否する）。
 * 存在しない行・novel_id が null の行は null を返す。
 */
export async function resolveNovelId(
  db: Database,
  resource: NovelResource,
  id: string
): Promise<string | null> {
  switch (resource) {
    case "novel": {
      return id;
    }
    case "chapter":
    case "character":
    case "setting":
    case "timeline":
    case "foreshadowing":
    case "llmInstruction":
    case "analysisResult":
    case "history": {
      const table = {
        analysisResult: analysisResults,
        chapter: chapters,
        character: characters,
        foreshadowing: foreshadowings,
        history: editHistories,
        llmInstruction: llmInstructions,
        setting: settings,
        timeline: timelines,
      }[resource];
      const [row] = await db
        .select({ novelId: table.novelId })
        .from(table)
        .where(eq(table.id, id));
      return row?.novelId ?? null;
    }
    case "customPrompt": {
      const [row] = await db
        .select({ novelId: customPrompts.novelId })
        .from(customPrompts)
        .where(eq(customPrompts.id, id));
      return row?.novelId ?? null;
    }
    case "chatSession": {
      const [row] = await db
        .select({ novelId: chatSessions.novelId })
        .from(chatSessions)
        .where(eq(chatSessions.id, id));
      return row?.novelId ?? null;
    }
    case "section": {
      const [row] = await db
        .select({ novelId: chapters.novelId })
        .from(sections)
        .innerJoin(chapters, eq(sections.chapterId, chapters.id))
        .where(eq(sections.id, id));
      return row?.novelId ?? null;
    }
    case "content": {
      const [row] = await db
        .select({ novelId: chapters.novelId })
        .from(contents)
        .innerJoin(sections, eq(contents.sectionId, sections.id))
        .innerJoin(chapters, eq(sections.chapterId, chapters.id))
        .where(eq(contents.id, id));
      return row?.novelId ?? null;
    }
    case "chatMessage": {
      const [row] = await db
        .select({ novelId: chatSessions.novelId })
        .from(chatMessages)
        .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
        .where(eq(chatMessages.id, id));
      return row?.novelId ?? null;
    }
    default: {
      return null;
    }
  }
}

function unauthorized(c: Context<AppContext>) {
  return c.json(
    { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
    401
  );
}

function forbidden(c: Context<AppContext>, message = "Forbidden") {
  return c.json({ error: { code: "FORBIDDEN", message } }, 403);
}

/**
 * セッションを読み込んでコンテキストに格納する。
 * BETTER_AUTH_SECRET 未設定（開発・テスト）では素通りして false を返す。
 * セッションなしの場合は 401 応答を返す。
 */
async function loadSession(
  c: Context<AppContext>
): Promise<{ response?: Response; user?: AuthUser } | null> {
  const env = c.get("env");
  if (!isAuthConfigured(env)) {
    return null;
  }
  const existing = c.get("user");
  if (existing) {
    return { user: existing };
  }
  const auth = createAuth(env, c.get("db"));
  const data = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!data) {
    return { response: unauthorized(c) };
  }
  const authUser: AuthUser = {
    email: data.user.email,
    emailVerified: data.user.emailVerified,
    id: data.user.id,
    image: data.user.image ?? null,
    name: data.user.name,
    role: (data.user as { role?: string | null }).role ?? null,
  };
  const authSession: AuthSession = {
    expiresAt: data.session.expiresAt,
    id: data.session.id,
    token: data.session.token,
    userId: data.session.userId,
  };
  c.set("user", authUser);
  c.set("session", authSession);
  return { user: authUser };
}

/** ログイン済みを要求する。未ログインは 401。 */
export async function requireAuth(c: Context<AppContext>, next: Next) {
  const loaded = await loadSession(c);
  if (loaded?.response) {
    return loaded.response;
  }
  await next();
}

/** 管理者権限を要求する。非 admin は 403。 */
export async function requireAdmin(c: Context<AppContext>, next: Next) {
  const loaded = await loadSession(c);
  if (loaded?.response) {
    return loaded.response;
  }
  if (loaded?.user && loaded.user.role !== "admin") {
    return forbidden(c, "Admin only");
  }
  await next();
}

/**
 * 所有小説へのアクセスを要求する（初版は owner-or-admin の二値判定）。
 * novelId が null の行（全体共有・未所属）は admin のみ許可する。
 * 認証未設定時・ユーザー未格納時（ルーター単体テスト）は素通りする。
 * 違反時は 403 応答を返す。許可時は null を返す。
 */
export async function assertNovelAccess(
  c: Context<AppContext>,
  novelId: string | null | undefined
): Promise<Response | null> {
  const env = c.get("env");
  if (!isAuthConfigured(env)) {
    return null;
  }
  const current = c.get("user");
  if (!current) {
    return null;
  }
  if (current.role === "admin") {
    return null;
  }
  if (!novelId) {
    return forbidden(c, "Novel membership required");
  }
  const [member] = await c
    .get("db")
    .select({ id: novelMembers.id })
    .from(novelMembers)
    .where(
      and(
        eq(novelMembers.novelId, novelId),
        eq(novelMembers.userId, current.id)
      )
    );
  if (!member) {
    return forbidden(c, "Novel membership required");
  }
  return null;
}

/**
 * リソース ID から小説を再解決して所有チェックするミドルウェア工場。
 */
export function requireNovelAccess(
  resource: NovelResource,
  idFrom: (c: Context<AppContext>) => string | undefined
) {
  return async (c: Context<AppContext>, next: Next) => {
    const loaded = await loadSession(c);
    if (loaded?.response) {
      return loaded.response;
    }
    if (!loaded?.user) {
      await next();
      return;
    }
    if (loaded.user.role === "admin") {
      await next();
      return;
    }
    const id = idFrom(c);
    if (!id) {
      await next();
      return;
    }
    const novelId = await resolveNovelId(c.get("db"), resource, id);
    const denied = await assertNovelAccess(c, novelId);
    if (denied) {
      return denied;
    }
    await next();
  };
}
