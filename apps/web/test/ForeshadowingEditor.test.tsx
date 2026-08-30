import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForeshadowingEditor } from '../src/routes/novels/_components/-ForeshadowingEditor.js';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};
vi.mock('@/hooks/useToast.js', () => ({
  useToast: () => mockToast,
}));

vi.mock('@/hooks/useChat.js', () => ({
  useChat: () => ({
    openChat: vi.fn(),
  }),
}));

vi.mock('../src/components/HistoryDiffModal.js', () => ({
  HistoryDiffModal: () => null,
}));

const mockCreateForeshadowing = vi.fn().mockResolvedValue({ id: 'new-f-1' });
const mockUpdateForeshadowing = vi.fn().mockResolvedValue({ id: 'f-1' });
const mockGenerateDraft = vi.fn().mockResolvedValue({
  category: '主要伏線 / 主人公の謎',
  title: '生成された伏線名',
  description: 'AI生成された詳細メモ',
  status: 'unresolved',
});

vi.mock('@/hooks/useForeshadowings.js', () => ({
  useForeshadowings: () => ({
    foreshadowings: [
      {
        id: 'f-1',
        novelId: 'novel-1',
        category: '主要伏線',
        title: '既存の伏線',
        description: '既存の詳細メモ',
        status: 'unresolved' as const,
        placedSectionId: null,
        resolvedSectionId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    loading: false,
    error: null,
    createForeshadowing: mockCreateForeshadowing,
    updateForeshadowing: mockUpdateForeshadowing,
    generateDraft: mockGenerateDraft,
    creating: false,
    updating: false,
    generatingDraft: false,
  }),
}));

vi.mock('@/hooks/useLlmInstructions.js', () => ({
  useLlmInstructions: () => ({
    instructions: [],
    saveInstruction: vi.fn(),
    deleteInstruction: vi.fn(),
    deleting: false,
  }),
}));

vi.mock('@/hooks/useChapters.js', () => ({
  useChapters: () => ({
    chapters: [],
  }),
}));

vi.mock('../src/routes/novels/_components/-MonacoEditor.js', () => ({
  MonacoEditor: ({ value, onChange }: { value: string; onChange: (val: string) => void }) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe('ForeshadowingEditor', () => {
  it('新規作成時にフォームを入力して保存できること', async () => {
    render(<ForeshadowingEditor novelId="novel-1" />);

    fireEvent.change(screen.getByPlaceholderText(/例: 主要伏線 \/ 主人公の出自/i), {
      target: { value: '主要伏線 / 主人公の謎' },
    });
    fireEvent.change(screen.getByPlaceholderText(/例: 主人公のペンダントの秘密/i), {
      target: { value: '新しい伏線' },
    });
    fireEvent.change(screen.getByTestId('monaco-editor'), {
      target: { value: '詳細なメモ内容' },
    });

    const saveButton = screen.getByRole('button', { name: /保存/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockCreateForeshadowing).toHaveBeenCalledWith({
        category: '主要伏線 / 主人公の謎',
        title: '新しい伏線',
        description: '詳細なメモ内容',
        status: 'unresolved',
        placedSectionId: null,
        resolvedSectionId: null,
      });
    });
  });

  it('編集時に既存データがフォームに初期セットされていること', () => {
    render(<ForeshadowingEditor novelId="novel-1" foreshadowingId="f-1" />);

    expect(screen.getByDisplayValue('主要伏線')).toBeInTheDocument();
    expect(screen.getByDisplayValue('既存の伏線')).toBeInTheDocument();
    expect(screen.getByDisplayValue('既存の詳細メモ')).toBeInTheDocument();
  });
});
