import { Button } from './Button.js';
import { Modal } from './Modal.js';
import type { CharacterVoiceCheckResult } from '@/lib/types.js';

interface CharacterVoiceCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: CharacterVoiceCheckResult | null;
  isLoading: boolean;
  onApplyFix?: (original: string, suggestion: string) => void;
}

const ISSUE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  firstPerson: { label: '一人称の矛盾', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
  secondPerson: {
    label: '二人称の矛盾',
    color: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  },
  speechPattern: {
    label: '口調・語尾のズレ',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  },
  toneShift: {
    label: '感情・トーン急変',
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  },
  outOfCharacter: {
    label: 'キャラブレ・不自然',
    color: 'bg-red-500/10 text-red-600 border-red-500/30',
  },
};

export function CharacterVoiceCheckerModal({
  isOpen,
  onClose,
  result,
  isLoading,
  onApplyFix,
}: CharacterVoiceCheckerModalProps) {
  if (isLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="キャラクター口調チェック中..." size="lg">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-center">
            <p className="font-semibold text-foreground">登録キャラクター設定と本文を照合中...</p>
            <p className="text-xs text-muted-foreground mt-1">
              一人称・二人称・語尾・口調のブレを精査しています
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  if (!result) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🎭 キャラクター口調・一貫性チェック結果"
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      <div className="space-y-4">
        {/* 総括ヘッダー */}
        <div className="rounded-xl border border-border bg-surface-raised p-4 text-xs space-y-1.5">
          <div className="font-bold text-foreground text-sm flex items-center gap-2">
            <span>📋 全体総括</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                result.issues.length === 0
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-amber-500/10 text-amber-600'
              }`}
            >
              指摘件数: {result.issues.length} 件
            </span>
          </div>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {result.summary}
          </p>
        </div>

        {/* 指摘一覧 */}
        <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
          {result.issues.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground italic">
              🎉
              キャラクターの口調や一人称の矛盾は見つかりませんでした。設定通り完璧に執筆されています！
            </div>
          ) : (
            result.issues.map((issue, idx) => {
              const typeConfig = ISSUE_TYPE_LABELS[issue.issueType] ?? {
                label: issue.issueType,
                color: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
              };

              return (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-surface p-3.5 text-xs space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">
                        👤 {issue.characterName}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeConfig.color}`}
                      >
                        {typeConfig.label}
                      </span>
                    </div>

                    {onApplyFix && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onApplyFix(issue.dialogue, issue.suggestion)}
                      >
                        本文に反映
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="rounded bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 p-2 text-rose-700 dark:text-rose-300">
                      <span className="font-semibold mr-1">該当箇所:</span>
                      {issue.dialogue}
                    </div>
                    <div className="rounded bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-2 text-emerald-700 dark:text-emerald-300 font-medium">
                      <span className="font-semibold mr-1">修正案:</span>
                      👉 {issue.suggestion}
                    </div>
                  </div>

                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    💡 <span className="font-semibold">理由:</span> {issue.reason}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
