import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ConnectionTestResult } from "./ConnectionTestResult";

const meta = {
  component: ConnectionTestResult,
  tags: ["autodocs"],
} satisfies Meta<typeof ConnectionTestResult>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    latencyMs: 320,
    message: "応答あり。モデル一覧の取得に成功しました。",
    success: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/✓ 接続成功/)).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: {
    latencyMs: 1200,
    message: "接続できませんでした。Base URL を確認してください。",
    success: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/✗ 接続失敗/)).toBeInTheDocument();
  },
};
