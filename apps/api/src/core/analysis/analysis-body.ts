import { fetchNovelStructureWithContents } from "../novel-structure.js";
import type { ServiceContext } from "../types.js";

/**
 * 小説全体の本文を章→節の順に結合して返す。
 * 各節の本文には「【章タイトル / 節タイトル】」のヘッダーを付ける。
 * 章・節・本文は共通ヘルパでバルク取得する（N+1 解消）。
 */
export async function assembleWholeNovelBody(
  ctx: ServiceContext,
  novelId: string
): Promise<string> {
  const structure = await fetchNovelStructureWithContents(ctx.db, [novelId]);

  const parts: string[] = [];
  for (const { chapter, sections: sectionNodes } of structure.get(novelId) ??
    []) {
    for (const { section, body } of sectionNodes) {
      if (body) {
        parts.push(
          `【${chapter.title} / ${section.title ?? `節 ${section.order}`}】\n${body}`
        );
      }
    }
  }

  return parts.join("\n\n");
}
