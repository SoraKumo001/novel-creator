import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { ToastProvider } from './Toast';
import { useToast } from '@/hooks/useToast.js';

function ToastDemo({
  type,
  message,
  children,
}: {
  type: 'success' | 'error' | 'loading';
  message: string;
  children?: ReactNode;
}) {
  const toast = useToast();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      <button
        onClick={() => toast[type](message)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        {children ?? `${type} トーストを表示`}
      </button>
    </div>
  );
}

const meta = {
  component: ToastProvider,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    children: <ToastDemo type="success" message="保存しました" />,
  },
};

export const Error: Story = {
  args: {
    children: <ToastDemo type="error" message="保存に失敗しました" />,
  },
};

export const Loading: Story = {
  args: {
    children: <ToastDemo type="loading" message="生成中..." />,
  },
};
