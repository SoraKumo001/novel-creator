import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ProviderBadge } from "./ProviderBadge";

const meta = {
  component: ProviderBadge,
  tags: ["autodocs"],
} satisfies Meta<typeof ProviderBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenAI: Story = {
  args: { provider: "openai" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("OpenAI")).toBeInTheDocument();
  },
};

export const Anthropic: Story = {
  args: { provider: "anthropic" },
};

export const Google: Story = {
  args: { provider: "google" },
};

export const Ollama: Story = {
  args: { provider: "ollama" },
};

export const Custom: Story = {
  args: { provider: "custom_openai" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Custom")).toBeInTheDocument();
  },
};

export const AllProviders: Story = {
  args: { provider: "openai" },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ProviderBadge provider="openai" />
      <ProviderBadge provider="anthropic" />
      <ProviderBadge provider="google" />
      <ProviderBadge provider="ollama" />
      <ProviderBadge provider="custom_openai" />
    </div>
  ),
};
