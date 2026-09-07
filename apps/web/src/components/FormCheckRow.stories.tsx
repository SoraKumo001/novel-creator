import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FormCheckRow } from "./FormCheckRow";

const meta = {
  component: FormCheckRow,
  tags: ["autodocs"],
} satisfies Meta<typeof FormCheckRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    checked: false,
    id: "isDefaultCheck",
    label: "デフォルトモデルに設定する",
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox", {
      name: "デフォルトモデルに設定する",
    });
    await userEvent.click(checkbox);
    await expect(args.onChange).toHaveBeenCalledWith(true);
  },
};

export const Checked: Story = {
  args: {
    checked: true,
    id: "isDefaultCheck",
    label: "デフォルトモデルに設定する",
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("checkbox", { name: "デフォルトモデルに設定する" })
    ).toBeChecked();
  },
};

export const WithHint: Story = {
  args: {
    checked: false,
    hint: "オンにすると新規作成時の初期値になります",
    id: "withHintCheck",
    label: "デフォルトに設定する",
    onChange: fn(),
  },
};
