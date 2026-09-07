import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "@/components/Button.js";
import { ConfigCard } from "./ConfigCard";

const meta = {
  component: ConfigCard,
  tags: ["autodocs"],
} satisfies Meta<typeof ConfigCard>;

export default meta;
type Story = StoryObj<typeof meta>;

function CardActions() {
  return (
    <>
      <Button variant="secondary" size="sm" onClick={fn()}>
        接続テスト
      </Button>
      <Button variant="secondary" size="sm" onClick={fn()}>
        編集
      </Button>
      <Button variant="danger" size="sm" onClick={fn()}>
        削除
      </Button>
    </>
  );
}

export const LLM: Story = {
  args: {
    actions: <CardActions />,
    apiKeyDisplay: "登録済み",
    baseUrl: "https://openrouter.ai/api/v1",
    description: "執筆用のメインモデル",
    isDefault: true,
    modelId: "claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet (執筆用)",
    provider: "anthropic",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Claude 3.7 Sonnet (執筆用)")
    ).toBeInTheDocument();
    await expect(canvas.getByText("Anthropic")).toBeInTheDocument();
  },
};

export const Embedding: Story = {
  args: {
    actions: <CardActions />,
    apiKeyDisplay: "環境変数をフォールバック利用",
    baseUrl: null,
    description: null,
    dimensionsLabel: "1536 次元",
    isDefault: false,
    modelId: "text-embedding-3-small",
    name: "OpenAI text-embedding-3-small (1536d)",
    provider: "openai",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1536 次元")).toBeInTheDocument();
  },
};

export const ActionsClickable: Story = {
  args: {
    actions: <CardActions />,
    apiKeyDisplay: "登録済み",
    isDefault: false,
    modelId: "llama3.2",
    name: "Ollama ローカル",
    provider: "ollama",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "編集" }));
    await expect(
      canvas.getByRole("button", { name: "削除" })
    ).toBeInTheDocument();
  },
};
