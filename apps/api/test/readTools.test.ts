import { describe, expect, it, vi } from 'vitest';
import { createReadTools } from '../src/core/tools/readTools.js';
import type { ServiceContext } from '../src/core/types.js';

describe('readTools', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockCtx: ServiceContext = {
    db: mockDb as never,
    llm: {} as never,
    embedding: {} as never,
    vectorStore: {} as never,
    env: {} as never,
  };

  it('createReadTools は 8 つの読み取りツールを返す', () => {
    const tools = createReadTools(mockCtx, 'test-novel-id');
    expect(tools.getNovelInfo).toBeDefined();
    expect(tools.getCharacters).toBeDefined();
    expect(tools.getSettings).toBeDefined();
    expect(tools.getPlotAndChapters).toBeDefined();
    expect(tools.getSectionContent).toBeDefined();
    expect(tools.getForeshadowings).toBeDefined();
    expect(tools.getTimelines).toBeDefined();
    expect(tools.searchNovelKnowledge).toBeDefined();
  });

  it('novelId が未指定の場合にエラーを返す', async () => {
    const tools = createReadTools(mockCtx, null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (tools.getNovelInfo as any).execute({ novelId: undefined });
    expect(res).toEqual({ error: '対象の小説が指定されていません。' });
  });
});
