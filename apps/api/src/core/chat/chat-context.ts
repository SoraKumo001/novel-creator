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
type NovelInfo = {
  title: string;
  description?: string | null;
  styleGuide?: string | null;
};

type RagContext = {
  settings: string[];
  characters: string[];
};

export async function buildChatContextPrompt(
  ctx: ServiceContext,
  sessionId: string,
  effectiveNovelId: string | null | undefined,
  userText: string
): Promise<string> {
  const historyTask: Promise<(typeof chatMessages.$inferSelect)[]> = ctx.db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt)
    .catch((): (typeof chatMessages.$inferSelect)[] => []);

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
              return undefined;
            }
            return {
              description: novel.description,
              styleGuide: novel.styleGuide,
              title: novel.title,
            };
          }
        )
        .catch((): undefined => undefined)
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
        .catch((): RagContext => ({ characters: [], settings: [] }))
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
