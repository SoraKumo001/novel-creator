import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';

const meta = {
  component: Input,
  tags: ['autodocs'],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Name',
    placeholder: 'Enter your name',
  },
};

export const WithPlaceholder: Story = {
  args: {
    placeholder: 'Search...',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    placeholder: 'Cannot edit',
    disabled: true,
  },
};

export const WithError: Story = {
  args: {
    label: 'Email',
    placeholder: 'email@example.com',
    error: '有効なメールアドレスを入力してください',
  },
};

export const WithValue: Story = {
  args: {
    label: 'タイトル',
    value: '失われた聖剣の物語',
  },
};
