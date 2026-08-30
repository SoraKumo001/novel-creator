import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/Button.js';
import { Card, CardHeader } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { HistoryDiffModal } from '@/components/HistoryDiffModal.js';
import { Loading } from '@/components/Loading.js';
import { Textarea } from '@/components/Textarea.js';
import type { LlmInstruction } from '@/lib/types.js';
import { PromptHistoryList } from './-PromptHistoryList.js';

interface EntityEditorShellProps {
  novelId: string;
  // ヘッダー
  backLabel: string;
  backTab:
    'overview' | 'settings' | 'characters' | 'plot' | 'editor' | 'timeline' | 'foreshadowing';
  title: string;
  isEdit: boolean;
  entityId?: string;
  // 保存
  onSave: () => void;
  saveLoading: boolean;
  saveDisabled: boolean;
  // エラー / ローディング
  error: string | null;
  loading: boolean;
  loadingMessage: string;
  // AIパネル
  instruction: string;
  onInstructionChange: (value: string) => void;
  instructionPlaceholder: string;
  onGenerate: () => void;
  generateLoading: boolean;
  generateDisabled: boolean;
  generateLabel: string;
  /**
   * 「AIと相談(チャット)」ボタンのハンドラ。
   * 未指定時はボタン自体を非表示にする（後方互換）。
   */
  onChatConsult?: () => void;
  // プロンプト履歴
  instructions: LlmInstruction[];
  onApplyHistory: (text: string) => void;
  onRequestDeleteInstruction: (id: string) => void;
  deleteInstructionId: string | null;
  onCloseDeleteInstruction: () => void;
  onConfirmDeleteInstruction: () => void;
  deletingInstruction: boolean;
  // 履歴差分モーダル
  historyOpen: boolean;
  onOpenHistory: () => void;
  onCloseHistory: () => void;
  entityType: string;
  currentContent: string;
  historyTitle: string;
  onRestoreSuccess: (restored: string) => void;
  // 左カラム（フォーム）
  children: ReactNode;
}

export function EntityEditorShell({
  novelId,
  backLabel,
  backTab,
  title,
  isEdit,
  entityId,
  onSave,
  saveLoading,
  saveDisabled,
  error,
  loading,
  loadingMessage,
  instruction,
  onInstructionChange,
  instructionPlaceholder,
  onGenerate,
  generateLoading,
  generateDisabled,
  generateLabel,
  onChatConsult,
  instructions,
  onApplyHistory,
  onRequestDeleteInstruction,
  deleteInstructionId,
  onCloseDeleteInstruction,
  onConfirmDeleteInstruction,
  deletingInstruction,
  historyOpen,
  onOpenHistory,
  onCloseHistory,
  entityType,
  currentContent,
  historyTitle,
  onRestoreSuccess,
  children,
}: EntityEditorShellProps) {
  const navigate = useNavigate();

  if (loading) return <Loading message={loadingMessage} />;

  return (
    <div className="flex h-full w-full flex-col space-y-4">
      {/* ナビゲーション & ヘッダー */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              navigate({
                to: '/novels/$novelId',
                params: { novelId },
                search: { tab: backTab },
              })
            }
            leftIcon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
            }
          >
            {backLabel}
          </Button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          {isEdit && entityId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenHistory}
              title="編集履歴と差分を確認・復元"
            >
              🕒 履歴
            </Button>
          )}
          <Button
            variant="primary"
            onClick={onSave}
            isLoading={saveLoading}
            disabled={saveDisabled}
            title="保存 (Ctrl+S)"
          >
            保存する
          </Button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 2カラム 画面領域フル活用レイアウト */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-12 overflow-hidden pb-4">
        {/* 左カラム: 基本情報 + Monaco エディタ (7/12) */}
        <div className="flex min-h-0 flex-col space-y-4 lg:col-span-7 xl:col-span-8">
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CardHeader title="基本情報" />
            <div className="flex min-h-0 flex-1 flex-col space-y-4 p-1">{children}</div>
          </Card>
        </div>

        {/* 右カラム: LLMで作成・編集 & 履歴 (5/12) */}
        <div className="flex flex-col space-y-4 lg:col-span-5 xl:col-span-4 overflow-y-auto pr-1">
          <Card>
            <CardHeader title="AIで作成・編集" />
            <div className="space-y-4">
              <Textarea
                label="AIへの指示"
                value={instruction}
                onChange={(e) => onInstructionChange(e.target.value)}
                placeholder={instructionPlaceholder}
                rows={4}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={onGenerate}
                  isLoading={generateLoading}
                  disabled={generateDisabled}
                  leftIcon={<SparklesIcon />}
                  className="w-full"
                >
                  {generateLabel}
                </Button>
              </div>

              {onChatConsult && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onChatConsult}
                  leftIcon={
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                      />
                    </svg>
                  }
                  className="w-full"
                  title="編集中の内容をチャット入力欄にセットしてAIに相談する"
                >
                  AIと相談（チャット）
                </Button>
              )}

              <PromptHistoryList
                instructions={instructions}
                onApply={onApplyHistory}
                onRequestDelete={onRequestDeleteInstruction}
              />
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteInstructionId}
        onClose={onCloseDeleteInstruction}
        onConfirm={onConfirmDeleteInstruction}
        title="履歴を削除しますか？"
        message="この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deletingInstruction}
      />

      {isEdit && entityId && (
        <HistoryDiffModal
          isOpen={historyOpen}
          onClose={onCloseHistory}
          novelId={novelId}
          entityType={entityType}
          entityId={entityId}
          currentContent={currentContent}
          title={historyTitle}
          onRestoreSuccess={onRestoreSuccess}
        />
      )}
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}
