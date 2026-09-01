import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "./Textarea";

const meta = {
  component: Textarea,
  tags: ["autodocs"],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Description",
    placeholder: "Write a description...",
  },
};

export const WithPlaceholder: Story = {
  args: {
    placeholder: "Type something here...",
  },
};

export const WithError: Story = {
  args: {
    label: "本文",
    placeholder: "本文を入力...",
    error: "100文字以上入力してください",
  },
};

export const LongRows: Story = {
  args: {
    label: "あらすじ",
    placeholder: "小説のあらすじを入力...",
    rows: 10,
  },
};
