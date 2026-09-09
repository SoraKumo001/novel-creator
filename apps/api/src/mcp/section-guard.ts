import type { DomainServices } from "../core/services.js";
import type { McpAuth } from "../core/types.js";
import { NotFoundError } from "../core/types.js";
import { assertNovelScope } from "./scope-guard.js";

/**
 * 節が指定小説に属することを検証する共通ガード。
 *
 * section → chapter の2段引きで照合する。chapter の novelId が指定 novelId と
 * 一致しない場合、NotFoundError("Section", sectionId) を投げる
 * （error-handler の404変換に載る）。
 * auth を渡すと、先にスコープキーと指定 novelId の整合性を検証する。
 */
export async function assertSectionBelongsToNovel(
  services: DomainServices,
  novelId: string,
  sectionId: string,
  auth?: McpAuth
) {
  if (auth) {
    assertNovelScope(auth, novelId);
  }
  const sectionWithContent =
    await services.section.getSectionWithContent(sectionId);
  const { chapter } = await services.chapter.getChapterWithSections(
    sectionWithContent.section.chapterId
  );
  if (chapter.novelId !== String(novelId)) {
    throw new NotFoundError("Section", sectionId);
  }
  return sectionWithContent;
}
