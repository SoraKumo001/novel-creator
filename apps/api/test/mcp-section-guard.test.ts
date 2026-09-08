import { describe, expect, it, vi } from "vitest";

import type { DomainServices } from "../src/core/services.js";
import { NotFoundError } from "../src/core/types.js";
import { assertSectionBelongsToNovel } from "../src/mcp/section-guard.js";

// ---- Services モック ----
// DB 不要。section / chapter ドメインの 2 段引きのみをスタブする。

const NOVEL_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_NOVEL_ID = "22222222-2222-4222-8222-222222222222";
const SECTION_ID = "33333333-3333-4333-8333-333333333333";
const CHAPTER_ID = "44444444-4444-4444-8444-444444444444";

function createMockServices(novelIdOfChapter: string) {
  return {
    chapter: {
      getChapterWithSections: vi.fn().mockResolvedValue({
        chapter: { id: CHAPTER_ID, novelId: novelIdOfChapter },
        sections: [],
      }),
    },
    section: {
      getSectionWithContent: vi.fn().mockResolvedValue({
        content: null,
        section: { chapterId: CHAPTER_ID, id: SECTION_ID },
      }),
    },
  } as unknown as DomainServices;
}

describe("assertSectionBelongsToNovel", () => {
  it("節が指定小説に属する場合は節データを返すこと", async () => {
    const services = createMockServices(NOVEL_ID);

    const result = await assertSectionBelongsToNovel(
      services,
      NOVEL_ID,
      SECTION_ID
    );

    expect(result.section.id).toBe(SECTION_ID);
    expect(
      services.section.getSectionWithContent as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith(SECTION_ID);
    expect(
      services.chapter.getChapterWithSections as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith(CHAPTER_ID);
  });

  it("節が別小説に属する場合は NotFoundError を投げること", async () => {
    const services = createMockServices(OTHER_NOVEL_ID);

    await expect(
      assertSectionBelongsToNovel(services, NOVEL_ID, SECTION_ID)
    ).rejects.toThrow(NotFoundError);
    await expect(
      assertSectionBelongsToNovel(services, NOVEL_ID, SECTION_ID)
    ).rejects.toThrow(SECTION_ID);
  });

  it("節自体が存在しない場合は元の NotFoundError を素通しすること", async () => {
    const services = {
      chapter: {
        getChapterWithSections: vi.fn(),
      },
      section: {
        getSectionWithContent: vi
          .fn()
          .mockRejectedValue(new NotFoundError("Section not found")),
      },
    } as unknown as DomainServices;

    await expect(
      assertSectionBelongsToNovel(services, NOVEL_ID, SECTION_ID)
    ).rejects.toThrow(NotFoundError);
    expect(
      services.chapter.getChapterWithSections as ReturnType<typeof vi.fn>
    ).not.toHaveBeenCalled();
  });
});
