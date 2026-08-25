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
    children: (
      <p className="text-sm text-slate-600 dark:text-slate-300">This is the modal body content.</p>
    ),
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
