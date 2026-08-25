import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tag } from './Tag';

const meta = {
  component: Tag,
  tags: ['autodocs'],
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Fantasy',
  },
};

export const Multiple: Story = {
  args: {
    children: 'Fantasy',
  },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Tag>Fantasy</Tag>
      <Tag>Adventure</Tag>
      <Tag>Romance</Tag>
    </div>
  ),
};
