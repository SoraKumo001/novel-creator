import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./EmptyState";

const meta = {
  component: EmptyState,
  tags: ["autodocs"],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "No novels yet",
    description: "Create your first novel to get started.",
  },
};

export const WithAction: Story = {
  args: {
    title: "No novels yet",
    description: "Create your first novel to get started.",
    actionLabel: "Create Novel",
    onAction: () => {},
  },
};
