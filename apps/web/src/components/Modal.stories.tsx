import type { Meta, StoryObj } from '@storybook/react-vite';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';

const meta = {
  component: Modal,
  tags: ['autodocs'],
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    title: 'Modal Title',
    children: <p className="text-sm text-foreground-secondary">This is the modal body content.</p>,
  },
};

export const WithForm: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    title: 'Edit Profile',
    children: (
      <div className="space-y-4">
        <Input label="Name" placeholder="Enter your name" />
        <Input label="Email" placeholder="Enter your email" />
      </div>
    ),
    footer: (
      <>
        <Button variant="secondary" onClick={() => {}}>
          Cancel
        </Button>
        <Button onClick={() => {}}>Save</Button>
      </>
    ),
  },
};

export const Small: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    title: 'Confirm Action',
    size: 'sm',
    children: (
      <p className="text-sm text-foreground-secondary">この操作は元に戻せません。続行しますか？</p>
    ),
    footer: (
      <>
        <Button variant="secondary" onClick={() => {}}>
          キャンセル
        </Button>
        <Button variant="danger" onClick={() => {}}>
          実行
        </Button>
      </>
    ),
  },
};

export const Large: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    title: '整合性更新結果',
    size: 'lg',
    children: (
      <div className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">抽出された時系列</h4>
          <ul className="space-y-1 text-sm text-foreground-secondary">
            <li className="rounded bg-surface-muted px-3 py-2">
              <span className="mr-2 text-xs text-muted">第1章</span>
              王子が城を出発する
            </li>
            <li className="rounded bg-surface-muted px-3 py-2">
              <span className="mr-2 text-xs text-muted">第2章</span>
              森で魔女と出会う
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">抽出された設定</h4>
          <ul className="grid gap-2 sm:grid-cols-2">
            <li className="rounded bg-surface-muted px-3 py-2">
              <span className="text-xs font-bold uppercase text-primary">地理</span>
              <div className="font-medium text-foreground">王国</div>
              <div className="text-sm text-foreground-secondary">大陸中央に位置する</div>
            </li>
          </ul>
        </div>
      </div>
    ),
    footer: (
      <Button variant="secondary" onClick={() => {}}>
        閉じる
      </Button>
    ),
  },
};
