import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  component: ConfirmDialog,
  tags: ['autodocs'],
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    title: '小説を削除',
    message: 'この小説と全ての章・節・本文を削除します。この操作は取り消せません。',
  },
};

export const Loading: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    title: '保存中',
    message: '削除処理を実行しています...',
    confirmLabel: '削除中',
    isLoading: true,
  },
};

export const CustomLabels: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    title: '変更を破棄',
    message: '未保存の編集内容が失われます。よろしいですか？',
    confirmLabel: '破棄',
    cancelLabel: 'キャンセル',
  },
};
