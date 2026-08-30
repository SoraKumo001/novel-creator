import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimelineTab } from '../src/routes/novels/_components/-TimelineTab.js';

const mockCreateTimeline = vi.fn().mockResolvedValue({ id: 't-new' });
const mockUpdateTimeline = vi.fn().mockResolvedValue({ id: 't-1' });
const mockDeleteTimeline = vi.fn().mockResolvedValue(undefined);

const mockTimelines = [
  {
    id: 't-1',
    novelId: 'novel-1',
    event: '主人公が故郷の村を出発する。',
    order: 1,
    timestamp: '第1日目 朝',
    sectionId: 'sec-1',
    createdAt: new Date().toISOString(),
  },
];

vi.mock('@/hooks/useTimelines.js', () => ({
  useTimelines: () => ({
    timelines: mockTimelines,
    loading: false,
    createTimeline: mockCreateTimeline,
    updateTimeline: mockUpdateTimeline,
    deleteTimeline: mockDeleteTimeline,
    creating: false,
    updating: false,
    deleting: false,
  }),
}));

describe('TimelineTab', () => {
  const mockNovel = {
    id: 'novel-1',
    title: 'テスト小説',
    description: 'あらすじ',
    status: 'draft' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chapters: [
      {
        id: 'ch-1',
        title: 'プロローグ章',
        order: 1,
        sections: [
          {
            id: 'sec-1',
            chapterId: 'ch-1',
            title: '旅立ちの朝',
            order: 1,
          },
        ],
      },
    ],
  };

  it('タイムライン一覧が表示され、関連付けられた節名が表示されること', () => {
    render(<TimelineTab novel={mockNovel as never} onRefresh={vi.fn()} />);

    expect(screen.getByText('第1日目 朝')).toBeInTheDocument();
    expect(screen.getByText('主人公が故郷の村を出発する。')).toBeInTheDocument();
    expect(screen.getByText(/プロローグ章 > 旅立ちの朝/)).toBeInTheDocument();
  });

  it('編集ボタンをクリックすると編集モーダルが開き、既存の値がセットされて更新できること', async () => {
    const mockRefresh = vi.fn();
    render(<TimelineTab novel={mockNovel as never} onRefresh={mockRefresh} />);

    const editButton = screen.getByTitle('編集');
    fireEvent.click(editButton);

    // モーダルが「イベントを編集」タイトルで開く
    expect(screen.getByText('イベントを編集')).toBeInTheDocument();
    expect(screen.getByDisplayValue('主人公が故郷の村を出発する。')).toBeInTheDocument();
    expect(screen.getByDisplayValue('第1日目 朝')).toBeInTheDocument();

    // 内容を変更して更新
    fireEvent.change(screen.getByDisplayValue('主人公が故郷の村を出発する。'), {
      target: { value: '主人公が故郷の村を出発し、隣町へ向かう。' },
    });

    const updateButton = screen.getByRole('button', { name: '更新' });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockUpdateTimeline).toHaveBeenCalledWith('t-1', {
        event: '主人公が故郷の村を出発し、隣町へ向かう。',
        order: 1,
        timestamp: '第1日目 朝',
        sectionId: 'sec-1',
      });
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('イベント追加ボタンをクリックすると新規追加モーダルが開き、登録できること', async () => {
    const mockRefresh = vi.fn();
    render(<TimelineTab novel={mockNovel as never} onRefresh={mockRefresh} />);

    const addButton = screen.getByRole('button', { name: /イベント追加/i });
    fireEvent.click(addButton);

    expect(screen.getByText('イベントを追加')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/王都の市場/i), {
      target: { value: '隣町に到着しギルドに立ち寄る。' },
    });
    fireEvent.change(screen.getByPlaceholderText(/第一章冒頭/i), {
      target: { value: '第1日目 夕方' },
    });

    const submitButton = screen.getByRole('button', { name: '追加' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateTimeline).toHaveBeenCalledWith({
        event: '隣町に到着しギルドに立ち寄る。',
        order: 1,
        timestamp: '第1日目 夕方',
        sectionId: undefined,
      });
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
