import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Card, CardHeader } from './Card';

const meta = {
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <CardHeader title="Card Title" subtitle="A short subtitle describing the card." />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This is the main content of the card.
        </p>
      </>
    ),
  },
};

export const WithFooter: Story = {
  args: {
    children: (
      <>
        <CardHeader title="Card Title" />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This card has a footer section below the content.
        </p>
        <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Footer content
        </div>
      </>
    ),
  },
};

export const Clickable: Story = {
  args: {
    onClick: fn(),
    children: (
      <>
        <CardHeader title="小説タイトル" subtitle="3章・12節" />
        <p className="line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          遠い王国の王子が、失われた聖剣を探す旅に出る物語。森の魔女、山の巨人、そして王国の陰謀と立ち向かう。
        </p>
      </>
    ),
  },
};

export const WithAction: Story = {
  args: {
    children: (
      <>
        <CardHeader
          title="人物: 王子アレン"
          subtitle="主人公"
          action={
            <div className="flex gap-1">
              <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700">
                編集
              </button>
              <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700">
                削除
              </button>
            </div>
          }
        />
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          18歳。王国の第一王子。聖剣「光輝」の継承者。
        </p>
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-900/30 dark:text-indigo-300">
            勇敢
          </span>
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-900/30 dark:text-indigo-300">
            正義感
          </span>
        </div>
      </>
    ),
  },
};
