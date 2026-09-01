import { describe, expect, it } from 'vitest';
import { createProposeTools } from '../src/core/tools/proposeTools.js';
import type { ServiceContext } from '../src/core/types.js';

function createDummyCtx(): ServiceContext {
  return {
    db: {} as never,
    llm: {} as never,
    embedding: {} as never,
    vectorStore: {} as never,
    env: {} as never,
  };
}

describe('proposeTools', () => {
  const NOVEL_ID = 'novel-uuid-123';

  it('createProposeTools は全 6 つの提案ツールを返す', () => {
    const tools = createProposeTools(createDummyCtx(), NOVEL_ID);
    expect(tools.proposeCreateCharacter).toBeDefined();
    expect(tools.proposeCreateSetting).toBeDefined();
    expect(tools.proposeAddForeshadowing).toBeDefined();
    expect(tools.proposeAddTimelineEvent).toBeDefined();
    expect(tools.proposeUpdatePlot).toBeDefined();
    expect(tools.proposeUpdateStoryOutline).toBeDefined();
  });

  describe('proposeUpdateStoryOutline', () => {
    it('セクション名・本文・モード・理由を指定して提案ペイロードを生成できること', async () => {
      const tools = createProposeTools(createDummyCtx(), NOVEL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.proposeUpdateStoryOutline as any).execute({
        sectionName: '結（結末・エンディング）',
        content: '主人公が勝利する結末。',
        mode: 'replace',
        reason: '王道エンド',
      });

      expect(res).toEqual({
        type: 'proposal',
        proposalType: 'story_outline',
        novelId: NOVEL_ID,
        data: {
          sectionName: '結（結末・エンディング）',
          content: '主人公が勝利する結末。',
          mode: 'replace',
          reason: '王道エンド',
        },
        summary: 'ストーリー構想「結（結末・エンディング）」の更新提案（王道エンド）',
      });
    });

    it('小説IDが未解決の場合はエラーを返すこと', async () => {
      const tools = createProposeTools(createDummyCtx(), null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.proposeUpdateStoryOutline as any).execute({
        sectionName: '全体あらすじ',
        content: 'あらすじテキスト',
      });

      expect(res).toEqual({ error: '対象の小説が指定されていません。' });
    });
  });
});
