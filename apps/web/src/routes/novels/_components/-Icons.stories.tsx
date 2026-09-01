import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from "./-Icons.js";

const meta = {
  component: IconButton,
  tags: ["autodocs"],
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "編集",
    onClick: fn(),
    icon: <PencilIcon />,
  },
};

export const Disabled: Story = {
  args: {
    label: "削除",
    onClick: fn(),
    icon: <TrashIcon />,
    disabled: true,
  },
};

export const AllIcons: Story = {
  args: {
    label: "dummy",
    onClick: fn(),
    icon: <PlusIcon />,
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <span className="flex items-center gap-1.5 text-slate-600 text-sm dark:text-slate-300">
        <PlusIcon /> 追加
      </span>
      <span className="flex items-center gap-1.5 text-slate-600 text-sm dark:text-slate-300">
        <PencilIcon /> 編集
      </span>
      <span className="flex items-center gap-1.5 text-slate-600 text-sm dark:text-slate-300">
        <TrashIcon /> 削除
      </span>
      <span className="flex items-center gap-1.5 text-slate-600 text-sm dark:text-slate-300">
        <SparklesIcon /> AI生成
      </span>
      <span className="flex items-center gap-1.5 text-slate-600 text-sm dark:text-slate-300">
        <ChevronDownIcon /> 開く
      </span>
      <span className="flex items-center gap-1.5 text-slate-600 text-sm dark:text-slate-300">
        <ChevronUpIcon /> 閉じる
      </span>
    </div>
  ),
};
