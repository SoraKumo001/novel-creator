import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToolActivity } from './ToolActivity.js';

const meta = {
  title: 'Chat/ToolActivity',
  component: ToolActivity,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-md p-4 bg-background border border-border rounded-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ToolActivity>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 実行前: 引数JSONのストリーミング中 */
export const InputStreaming: Story = {
  args: {
    parts: [
      {
        type: 'tool-getCharacters',
        toolCallId: 'call-1',
        state: 'input-streaming',
        input: { nam: 'エリ' },
      },
    ],
    isStreaming: true,
  },
};

/** 実行前: 引数の解析が完了し実行中 */
export const InputAvailable: Story = {
  args: {
    parts: [
      {
        type: 'tool-getCharacters',
        toolCallId: 'call-1',
        state: 'input-available',
        input: { name: 'エリス' },
      },
    ],
    isStreaming: true,
  },
};

/** 完了: 結果が利用可能（JSONプレビューはクリックで展開） */
export const OutputAvailable: Story = {
  args: {
    parts: [
      {
        type: 'tool-getCharacters',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { name: 'エリス' },
        output: {
          count: 1,
          characters: [
            {
              id: 'char-1',
              name: 'エリス・シルフィード',
              category: 'ヒロイン',
              description: '風の魔法を操る王女',
              traits: ['金髪碧眼', '誇り高い', '魔法の天才'],
            },
          ],
        },
      },
    ],
  },
};

/** エラー: ツール実行に失敗 */
export const OutputError: Story = {
  args: {
    parts: [
      {
        type: 'tool-getSectionContent',
        toolCallId: 'call-1',
        state: 'output-error',
        input: { sectionId: 'missing-section' },
        errorText: '指定された節が見つかりませんでした',
      },
    ],
  },
};

/** 複数ツールの連続呼び出し */
export const MultipleTools: Story = {
  args: {
    parts: [
      {
        type: 'tool-getSettings',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { category: '世界観' },
        output: {
          count: 2,
          settings: [
            {
              id: 's1',
              name: '魔導帝国アルカディア',
              category: '世界観',
              description: '空中都市群',
            },
            { id: 's2', name: 'マナ鉱石', category: '世界観', description: '浮力の源となる鉱石' },
          ],
        },
      },
      {
        type: 'tool-searchNovelKnowledge',
        toolCallId: 'call-2',
        state: 'input-available',
        input: { query: '魔法帝国の起源' },
      },
    ],
  },
};

/** 動的ツール（dynamic-tool パーツ） */
export const DynamicTool: Story = {
  args: {
    parts: [
      {
        type: 'dynamic-tool',
        toolName: 'getTimelines',
        toolCallId: 'call-1',
        state: 'output-available',
        input: {},
        output: { count: 4, timelines: [{ year: 1020, event: '大崩壊' }] },
      },
    ],
  },
};
