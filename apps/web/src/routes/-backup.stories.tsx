import type { Meta, StoryObj } from '@storybook/react-vite';
import { BackupPage } from './backup.js';

const meta = {
  component: BackupPage,
  tags: ['autodocs'],
} satisfies Meta<typeof BackupPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
