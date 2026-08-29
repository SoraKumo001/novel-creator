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

export const Calling: Story = {
  args: {
    parts: [
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'call-1',
          toolName: 'getCharacters',
          args: { name: 'エリス' },
          state: 'call',
        },
      },
    ],
    isStreaming: true,
  },
};

export const ResultCompleted: Story = {
  args: {
    parts: [
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'call-1',
          toolName: 'getCharacters',
          args: { name: 'エリス' },
          result: {
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
          state: 'result',
        },
      },
    ],
  },
};

export const MultipleTools: Story = {
  args: {
    parts: [
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'call-1',
          toolName: 'getSettings',
          args: { category: '世界観' },
          result: {
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
          state: 'result',
        },
      },
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'call-2',
          toolName: 'searchNovelKnowledge',
          args: { query: '魔法帝国の起源' },
          result: {
            settings: ['1000年前の大崩壊により浮上した帝国'],
            characters: [],
          },
          state: 'result',
        },
      },
    ],
  },
};
