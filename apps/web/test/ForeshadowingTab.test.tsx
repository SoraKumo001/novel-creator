import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForeshadowingTab } from '../src/routes/novels/_components/-ForeshadowingTab.js';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useToast.js', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/context/ChatContext.js', () => ({
  useChatUI: () => ({
    openChat: vi.fn(),
  }),
}));

const mockForeshadowings = [
  {
    id: 'f-1',
    novelId: 'novel-1',
    category: '主要伏線 / 主人公の謎',
    title: '黒ずくめの男の正体',
    description: '実は王国の近衛隊長',
    status: 'unresolved' as const,
    placedSectionId: null,
    resolvedSectionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

vi.mock('@/hooks/useForeshadowings.js', () => ({
  useForeshadowings: () => ({
    foreshadowings: mockForeshadowings,
    loading: false,
    deleteForeshadowing: vi.fn(),
    updateForeshadowing: vi.fn(),
    deleting: false,
    fetchForeshadowingsMarkdown: vi.fn().mockResolvedValue(''),
    saveForeshadowingsMarkdown: vi.fn().mockResolvedValue({ created: 0, updated: 0, deleted: 0 }),
    editForeshadowingSection: vi.fn().mockResolvedValue(''),
    editForeshadowingDocument: vi.fn().mockResolvedValue(''),
    savingMarkdown: false,
    editingSection: false,
    editingDocument: false,
  }),
}));

vi.mock('@/hooks/useChapters.js', () => ({
  useChapters: () => ({
    chapters: [],
  }),
}));

describe('ForeshadowingTab', () => {
  const mockNovel = {
    id: 'novel-1',
    title: 'テスト小説',
    description: 'あらすじ',
    status: 'draft' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('伏線一覧が表示され、カテゴリ階層ツリーとカードが表示されること', () => {
    render(<ForeshadowingTab novel={mockNovel} onRefresh={vi.fn()} />);

    expect(screen.getAllByText('主要伏線').length).toBeGreaterThan(0);
    expect(screen.getAllByText('主人公の謎').length).toBeGreaterThan(0);
    expect(screen.getAllByText('黒ずくめの男の正体').length).toBeGreaterThan(0);
    expect(screen.getByText('実は王国の近衛隊長')).toBeInTheDocument();
    expect(screen.getByText('未回収')).toBeInTheDocument();
  });

  it('編集ボタンをクリックするとエディタページへ遷移すること', () => {
    render(<ForeshadowingTab novel={mockNovel} onRefresh={vi.fn()} />);

    const editButton = screen.getByTitle('編集');
    fireEvent.click(editButton);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/novels/$novelId/foreshadowings/$foreshadowingId',
      params: { novelId: 'novel-1', foreshadowingId: 'f-1' },
    });
  });

  it('新規作成ボタンをクリックすると新規作成エディタページへ遷移すること', () => {
    render(<ForeshadowingTab novel={mockNovel} onRefresh={vi.fn()} />);

    const newButton = screen.getByRole('button', { name: /新規作成/i });
    fireEvent.click(newButton);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/novels/$novelId/foreshadowings/new',
      params: { novelId: 'novel-1' },
    });
  });
});
