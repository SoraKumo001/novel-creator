import { chatMessages, novels } from "@novel-creator/db";
import { creativeChatSystemPrompt } from "@novel-creator/llm";
import { eq } from "drizzle-orm";
import { searchContext } from "../../rag.js";
import type { ServiceContext } from "../types.js";

/**
 * 会話履歴（サーバー DB 正史・ユーザーメッセージ挿入後）と小説情報・RAG 検索結果から
 * LLM へ渡すプロンプトを構築する。
 * RAG 検索・小説取得失敗時は空コンテキストで継続する。
 */
export async function buildChatContextPrompt(
  ctx: ServiceContext,
  sessionId: string,
  effectiveNovelId: string | null | undefined,
  userText: string
): Promise<string> {
  const history = await ctx.db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);

  let contextSettings: string[] = [];
  let contextCharacters: string[] = [];
  let novelInfo:
    | {
        title: string;
        description?: string | null;
        styleGuide?: string | null;
      }
    | undefined;

  if (effectiveNovelId) {
    try {
      const [novel] = await ctx.db
        .select({
          description: novels.description,
          styleGuide: novels.styleGuide,
          title: novels.title,
        })
        .from(novels)
        .where(eq(novels.id, effectiveNovelId));
      if (novel) {
        novelInfo = {
          description: novel.description,
          styleGuide: novel.styleGuide,
          title: novel.title,
        };
      }

      const ragContext = await searchContext(
        ctx.vectorStore,
        ctx.embedding,
        effectiveNovelId,
        { query: userText },
        ctx.env
      );
      contextSettings = ragContext.settings;
      contextCharacters = ragContext.characters;
    } catch {
      // RAG 検索・小説取得失敗時は空コンテキストで継続
    }
  }

  const systemPrompt = creativeChatSystemPrompt({
    characters: contextCharacters,
    novel: novelInfo,
    settings: contextSettings,
  });

  return [
    systemPrompt,
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map(
        (m) =>
          `${m.role === "user" ? "ユーザー" : "アシスタント"}: ${m.content}`
      ),
  ].join("\n\n");
}
