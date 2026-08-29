import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolActivity, extractToolInvocations } from '../src/components/chat/ToolActivity.js';

describe('ToolActivity', () => {
  it('parts が空または undefined のときは null をレンダリングする', () => {
    const { container } = render(<ToolActivity parts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('tool-invocation parts からツール情報を正しく抽出する', () => {
    const parts = [
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'call-1',
          toolName: 'getCharacters',
          args: { name: 'アリス' },
          state: 'call',
        },
      },
    ];
    const extracted = extractToolInvocations(parts);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].toolName).toBe('getCharacters');
    expect(extracted[0].state).toBe('call');
  });

  it('実行中（call）のステータスを表示する', () => {
    const parts = [
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'call-1',
          toolName: 'getCharacters',
          args: { name: 'アリス' },
          state: 'call',
        },
      },
    ];

    render(<ToolActivity parts={parts} isStreaming={true} />);
    expect(screen.getByText('登場人物の参照')).toBeInTheDocument();
    expect(screen.getByText('参照中...')).toBeInTheDocument();
  });

  it('完了（result）のステータスと結果サマリーを表示し、クリックで引数・結果を展開する', () => {
    const parts = [
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'call-1',
          toolName: 'getCharacters',
          args: { name: 'アリス' },
          result: { count: 3, characters: [] },
          state: 'result',
        },
      },
    ];

    render(<ToolActivity parts={parts} />);
    expect(screen.getByText('登場人物の参照')).toBeInTheDocument();
    expect(screen.getByText('3 件取得')).toBeInTheDocument();

    // 最初はアコーディオンが閉じている
    expect(screen.queryByText('入力パラメータ:')).not.toBeInTheDocument();

    // クリックで展開
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('入力パラメータ:')).toBeInTheDocument();
    expect(screen.getByText('実行結果:')).toBeInTheDocument();
  });
});
