import { chatMessages, novels } from "@novel-creator/db";
import { creativeChatSystemPrompt } from "@novel-creator/llm";
import { asc, eq } from "drizzle-orm";
import { appLogger } from "../../middleware/logger.js";
import { searchContext } from "../../rag.js";
import { type ServiceContext, ValidationError } from "../types.js";

/**
 * 会話履歴（サーバー DB 正史・ユーザーメッセージ挿入後）と小説情報・RAG 検索結果から
 * LLM へ渡すプロンプトを構築する。
 * 失敗時は警告を warnings に格納して空コンテキストで継続する（呼び出し元が UI 警告可能）。
 */
type NovelInfo = {
  title: string;
  description?: string | null;
  styleGuide?: string | null;
};

type RagContext = {
  settings: string[];
  characters: string[];
};

export type ChatContextResult = {
  prompt: string;
  warnings: string[];
};

/** 履歴の最大件数（直近 N 件のみ使用） */
export const CHAT_HISTORY_LIMIT = 50;
/** 履歴全体の最大文字数（超過分は古い方からカット） */
export const CHAT_HISTORY_CHAR_LIMIT = 12_000;

export async function buildChatContextPrompt(
  ctx: ServiceContext,
  sessionId: string,
  effectiveNovelId: string | null | undefined,
  userText: string,
  sessionNovelId?: string | null
): Promise<ChatContextResult> {
  if (
    effectiveNovelId &&
    sessionNovelId &&
    effectiveNovelId !== sessionNovelId
  ) {
    throw new ValidationError("novelId does not match session");
  }

  const warnings: string[] = [];

  const historyTask: Promise<(typeof chatMessages.$inferSelect)[]> = ctx.db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
    .limit(CHAT_HISTORY_LIMIT)
    .catch((err: unknown): (typeof chatMessages.$inferSelect)[] => {
      appLogger.warn("[Chat Context] failed to load history", err);
      warnings.push("history_unavailable");
      return [];
    });

  const novelTask: Promise<NovelInfo | undefined> = effectiveNovelId
    ? ctx.db
        .select({
          description: novels.description,
          styleGuide: novels.styleGuide,
          title: novels.title,
        })
        .from(novels)
        .where(eq(novels.id, effectiveNovelId))
        .then(
          (
            rows: {
              title: string;
              description: string | null;
              styleGuide: string | null;
            }[]
          ): NovelInfo | undefined => {
            const novel = rows[0];
            if (!novel) {
              warnings.push("novel_not_found");
              return undefined;
            }
            return {
              description: novel.description,
              styleGuide: novel.styleGuide,
              title: novel.title,
            };
          }
        )
        .catch((err: unknown): undefined => {
          appLogger.warn("[Chat Context] failed to load novel", err);
          warnings.push("novel_unavailable");
          return undefined;
        })
    : Promise.resolve(undefined);

  const ragTask: Promise<RagContext> = effectiveNovelId
    ? searchContext(
        ctx.vectorStore,
        ctx.embedding,
        effectiveNovelId,
        { query: userText },
        ctx.env
      )
        .then(
          (ragContext: RagContext): RagContext => ({
            characters: ragContext.characters,
            settings: ragContext.settings,
          })
        )
        .catch((err: unknown): RagContext => {
          appLogger.warn("[Chat Context] RAG search failed", err);
          warnings.push("rag_unavailable");
          return { characters: [], settings: [] };
        })
    : Promise.resolve({ characters: [], settings: [] });

  const [history, novelInfo, ragContext] = await Promise.all([
    historyTask,
    novelTask,
    ragTask,
  ]);

  const contextSettings: string[] = ragContext.settings;
  const contextCharacters: string[] = ragContext.characters;

  const systemPrompt = creativeChatSystemPrompt({
    characters: contextCharacters,
    novel: novelInfo,
    settings: contextSettings,
  });

  const historyLines = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map(
      (m) => `${m.role === "user" ? "ユーザー" : "アシスタント"}: ${m.content}`
    );
  const cappedHistory = capHistoryChars(historyLines, CHAT_HISTORY_CHAR_LIMIT);

  return {
    prompt: [systemPrompt, ...cappedHistory].join("\n\n"),
    warnings,
  };
}

/**
 * 履歴行の合計文字数が上限を超える場合、古い行からカットする。
 */
function capHistoryChars(lines: string[], maxChars: number): string[] {
  let total = 0;
  const kept: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] as string;
    if (total + line.length > maxChars && kept.length > 0) {
      break;
    }
    kept.unshift(line);
    total += line.length;
    if (total >= maxChars) {
      break;
    }
  }
  return kept;
}
