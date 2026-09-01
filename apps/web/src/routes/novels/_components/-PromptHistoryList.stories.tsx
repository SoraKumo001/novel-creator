import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { LlmInstruction } from "@/lib/types.js";
import { PromptHistoryList } from "./-PromptHistoryList.js";

function makeInstruction(
  overrides: Partial<LlmInstruction> = {}
): LlmInstruction {
  return {
    id: "inst-1",
    novelId: "novel-1",
    entityType: "character",
    instruction: "主人公の性格をより魅力的にしてください。",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const meta = {
  component: PromptHistoryList,
  tags: ["autodocs"],
} satisfies Meta<typeof PromptHistoryList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    instructions: [
      makeInstruction(),
      makeInstruction({
        id: "inst-2",
        instruction: "世界観の設定を整理してください。",
      }),
      makeInstruction({
        id: "inst-3",
        instruction: "伏線を回収する場面を追加してください。",
      }),
    ],
    onApply: fn(),
    onRequestDelete: fn(),
  },
};

export const Empty: Story = {
  args: {
    instructions: [],
    onApply: fn(),
    onRequestDelete: fn(),
  },
};
