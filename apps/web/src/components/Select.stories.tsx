import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Select } from "./Select";

const providerOptions = (
  <>
    <option value="openai">OpenAI 互換</option>
    <option value="anthropic">Anthropic</option>
    <option value="google">Google</option>
  </>
);

const meta = {
  component: Select,
  tags: ["autodocs"],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "プロバイダ種別",
    defaultValue: "openai",
    onChange: fn(),
    children: providerOptions,
  },
};

export const WithValue: Story = {
  args: {
    label: "プロバイダ種別",
    value: "anthropic",
    onChange: fn(),
    children: providerOptions,
  },
};

export const Disabled: Story = {
  args: {
    label: "プロバイダ種別",
    value: "openai",
    disabled: true,
    onChange: fn(),
    children: providerOptions,
  },
};

export const WithError: Story = {
  args: {
    label: "プロバイダ種別",
    defaultValue: "",
    onChange: fn(),
    error: "プロバイダを選んでください",
    children: (
      <>
        <option value="">選択してください</option>
        {providerOptions}
      </>
    ),
  },
};

export const SelectOption: Story = {
  args: {
    label: "プロバイダ種別",
    defaultValue: "openai",
    onChange: fn(),
    children: providerOptions,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByLabelText("プロバイダ種別");
    await userEvent.selectOptions(select, "google");
    await expect(args.onChange).toHaveBeenCalled();
    await expect((select as HTMLSelectElement).value).toBe("google");
  },
};
