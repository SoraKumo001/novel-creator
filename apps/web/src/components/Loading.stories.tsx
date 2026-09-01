import type { Meta, StoryObj } from "@storybook/react-vite";
import { Loading } from "./Loading";

const meta = {
  component: Loading,
  tags: ["autodocs"],
} satisfies Meta<typeof Loading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithLabel: Story = {
  args: {
    message: "Loading...",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
  },
};

export const FullScreen: Story = {
  args: {
    fullScreen: true,
    message: "生成中...",
  },
};
