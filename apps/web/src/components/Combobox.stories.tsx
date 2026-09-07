import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Combobox } from "./Combobox";

const modelOptions = ["gpt-4o", "gpt-4o-mini", "o1-preview"];

const meta = {
  component: Combobox,
  tags: ["autodocs"],
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: "",
    onChange: fn(),
    options: modelOptions,
    placeholder: "モデルIDを入力",
  },
};

export const WithValue: Story = {
  args: {
    value: "gpt-4o",
    onChange: fn(),
    options: modelOptions,
    placeholder: "モデルIDを入力",
  },
};

export const WithHint: Story = {
  args: {
    value: "",
    onChange: fn(),
    options: modelOptions,
    placeholder: "モデルIDを入力",
    hint: "一覧から選択または直接入力できます",
  },
};

export const Disabled: Story = {
  args: {
    value: "gpt-4o",
    onChange: fn(),
    options: modelOptions,
    placeholder: "モデルIDを入力",
    disabled: true,
  },
};

export const WithError: Story = {
  args: {
    value: "",
    onChange: fn(),
    options: modelOptions,
    placeholder: "モデルIDを入力",
    error: "モデルIDを入力してください",
  },
};

export const WithoutOptions: Story = {
  args: {
    value: "",
    onChange: fn(),
    options: [],
    placeholder: "モデルIDを入力",
  },
};

function ControlledCombobox(props: ComponentProps<typeof Combobox>) {
  const [value, setValue] = useState(props.value);
  return (
    <Combobox
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange(next);
      }}
    />
  );
}

export const TypeDirectly: Story = {
  args: {
    value: "",
    onChange: fn(),
    options: modelOptions,
    placeholder: "モデルIDを入力",
  },
  render: (args) => <ControlledCombobox {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("モデルIDを入力");
    await userEvent.type(input, "claude-sonnet-4");
    await expect((input as HTMLInputElement).value).toBe("claude-sonnet-4");
    await expect(args.onChange).toHaveBeenCalled();
  },
};

export const SelectFromList: Story = {
  args: {
    value: "",
    onChange: fn(),
    options: modelOptions,
    placeholder: "モデルIDを入力",
  },
  render: (args) => <ControlledCombobox {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "候補一覧を開く" })
    );
    await userEvent.click(canvas.getByRole("option", { name: "o1-preview" }));
    const input = canvas.getByPlaceholderText("モデルIDを入力");
    await expect((input as HTMLInputElement).value).toBe("o1-preview");
    await expect(canvas.queryByRole("listbox")).toBeNull();
    await expect(args.onChange).toHaveBeenCalledWith("o1-preview");
  },
};

export const TypeKeepsFullList: Story = {
  args: {
    value: "",
    onChange: fn(),
    options: modelOptions,
    placeholder: "モデルIDを入力",
  },
  render: (args) => <ControlledCombobox {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("モデルIDを入力");
    await userEvent.type(input, "gpt");
    await userEvent.click(
      canvas.getByRole("button", { name: "候補一覧を開く" })
    );
    await expect(canvas.getAllByRole("option")).toHaveLength(
      modelOptions.length
    );
  },
};
