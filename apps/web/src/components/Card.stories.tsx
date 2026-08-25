import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, CardHeader } from './Card';

const meta = {
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <CardHeader title="Card Title" subtitle="A short subtitle describing the card." />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This is the main content of the card.
        </p>
      </>
    ),
  },
};

export const WithFooter: Story = {
  args: {
    children: (
      <>
        <CardHeader title="Card Title" />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This card has a footer section below the content.
        </p>
        <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Footer content
        </div>
      </>
    ),
  },
};
