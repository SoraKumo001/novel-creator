import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { PresetChipGroup } from "./PresetChipGroup";
import { EMBEDDING_PRESETS, LLM_PRESETS } from "./presets";

const meta = {
  component: PresetChipGroup,
  tags: ["autodocs"],
} satisfies Meta<typeof PresetChipGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LLM: Story = {
  args: {
    onSelect: fn(),
    presets: LLM_PRESETS,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole("button", { name: "GPT-4o" });
    await userEvent.click(chip);
    await expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: "GPT-4o", modelId: "gpt-4o" })
    );
  },
};

export const Embedding: Story = {
  args: {
    onSelect: fn(),
    presets: EMBEDDING_PRESETS,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole("button", {
      name: "OpenAI 3-Small (1536次元)",
    });
    await userEvent.click(chip);
    await expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: "text-embedding-3-small" })
    );
  },
};

export const ClosedByDefault: Story = {
  args: {
    onSelect: fn(),
    presets: LLM_PRESETS,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("プリセットから素早く入力")
    ).toBeInTheDocument();
  },
};
