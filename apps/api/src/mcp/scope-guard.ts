import type { DomainServices } from "../core/services.js";
import { type McpAuth, NotFoundError } from "../core/types.js";

/**
 * MCP スコープガード。
 *
 * novelId 付きで発行された MCP キー（スコープキー）は、その小説のみに
 * アクセスできる。全体キー（novelId が null）および認証なしの内部利用は
 * すべて許可する。
 *
 * 不一致時は NotFoundError("Novel", id) を投げ、error-handler の 404 変換に載せる。
 * 403 ではなく 404 にすることで、他小説の存在を推測できないようにする。
 */
export function assertNovelScope(
  auth: McpAuth | undefined,
  requestedNovelId: string
): void {
  if (!auth || auth.novelId === null) {
    return;
  }
  const requested = String(requestedNovelId);
  if (auth.novelId !== requested) {
    throw new NotFoundError("Novel", requested);
  }
}

/**
 * 章 ID から所属小説を解決してスコープを検証する。
 * 全体キー・認証なしの場合は DB 参照なしで許可する。
 */
export async function assertChapterScope(
  services: DomainServices,
  auth: McpAuth | undefined,
  chapterId: string
): Promise<void> {
  if (!auth || auth.novelId === null) {
    return;
  }
  const { chapter } = await services.chapter.getChapterWithSections(chapterId);
  assertNovelScope(auth, chapter.novelId);
}

/**
 * 節 ID から所属小説を解決してスコープを検証する。
 * 全体キー・認証なしの場合は DB 参照なしで許可する。
 */
export async function assertSectionScope(
  services: DomainServices,
  auth: McpAuth | undefined,
  sectionId: string
): Promise<void> {
  if (!auth || auth.novelId === null) {
    return;
  }
  const sectionWithContent =
    await services.section.getSectionWithContent(sectionId);
  const { chapter } = await services.chapter.getChapterWithSections(
    sectionWithContent.section.chapterId
  );
  assertNovelScope(auth, chapter.novelId);
}

/**
 * 登場人物 ID から所属小説を解決してスコープを検証する。
 */
export async function assertCharacterScope(
  services: DomainServices,
  auth: McpAuth | undefined,
  characterId: string
): Promise<void> {
  if (!auth || auth.novelId === null) {
    return;
  }
  const character = await services.character.getCharacter(characterId);
  assertNovelScope(auth, character.novelId);
}

/**
 * 設定 ID から所属小説を解決してスコープを検証する。
 */
export async function assertSettingScope(
  services: DomainServices,
  auth: McpAuth | undefined,
  settingId: string
): Promise<void> {
  if (!auth || auth.novelId === null) {
    return;
  }
  const setting = await services.setting.getSetting(settingId);
  assertNovelScope(auth, setting.novelId);
}

/**
 * 伏線 ID から所属小説を解決してスコープを検証する。
 */
export async function assertForeshadowingScope(
  services: DomainServices,
  auth: McpAuth | undefined,
  foreshadowingId: string
): Promise<void> {
  if (!auth || auth.novelId === null) {
    return;
  }
  const item = await services.foreshadowing.getForeshadowing(foreshadowingId);
  assertNovelScope(auth, item.novelId);
}

/**
 * 履歴 ID から所属小説を解決してスコープを検証する。
 */
export async function assertHistoryScope(
  services: DomainServices,
  auth: McpAuth | undefined,
  historyId: string
): Promise<void> {
  if (!auth || auth.novelId === null) {
    return;
  }
  const history = await services.history.getHistory(historyId);
  assertNovelScope(auth, history.novelId);
}
