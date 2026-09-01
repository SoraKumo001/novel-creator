import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Card, CardHeader } from "./Card";

const meta = {
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <CardHeader
          title="Card Title"
          subtitle="A short subtitle describing the card."
        />
        <p className="text-foreground-secondary text-sm">
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
        <p className="text-foreground-secondary text-sm">
          This card has a footer section below the content.
        </p>
        <div className="mt-4 border-border-subtle border-t pt-4 text-muted text-sm">
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
        <p className="line-clamp-3 text-foreground-secondary text-sm leading-relaxed">
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
              <button className="rounded p-1.5 text-muted hover:bg-surface-hover hover:text-foreground">
                編集
              </button>
              <button className="rounded p-1.5 text-muted hover:bg-surface-hover hover:text-foreground">
                削除
              </button>
            </div>
          }
        />
        <p className="mb-3 text-foreground-secondary text-sm">
          18歳。王国の第一王子。聖剣「光輝」の継承者。
        </p>
        <div className="flex flex-wrap gap-1.5 border-border-subtle border-t pt-2">
          <span className="inline-flex items-center rounded-full bg-primary-subtle px-2.5 py-0.5 font-medium text-primary-subtle-fg text-xs">
            勇敢
          </span>
          <span className="inline-flex items-center rounded-full bg-primary-subtle px-2.5 py-0.5 font-medium text-primary-subtle-fg text-xs">
            正義感
          </span>
        </div>
      </>
    ),
  },
};
