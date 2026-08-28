import { useState } from 'react';
import { Button } from './Button.js';
import { Modal } from './Modal.js';
import type { ProofreadResult } from '@/lib/types.js';

interface ProofreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ProofreadResult | null;
  isLoading: boolean;
  onApplyPolishedBody?: (newBody: string) => void;
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  viewpoint: {
    label: '視点ブレ',
    bg: 'bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/30',
  },
  typo: {
    label: '誤字・表記揺れ',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
  },
  grammar: {
    label: '文法・助詞',
    bg: 'bg-orange-500/10',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/30',
  },
  pacing: {
    label: 'リズム・テンポ',
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
  },
  consistency: {
    label: '設定整合性',
    bg: 'bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/30',
  },
  other: {
    label: 'その他',
    bg: 'bg-slate-500/10',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/30',
  },
};

export function ProofreadModal({
  isOpen,
  onClose,
  result,
  isLoading,
  onApplyPolishedBody,
}: ProofreadModalProps) {
  const [activeTab, setActiveTab] = useState<'issues' | 'polished'>('issues');

  if (isLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="AI校正・推敲中..." size="lg">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-center">
            <p className="font-semibold text-foreground">プロ編集者の視点で文章を精読中...</p>
            <p className="text-xs text-muted-foreground mt-1">
              視点ブレ・誤字脱字・リズム・設定の整合性を総合的にチェックしています
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
      title="AI 校正・推敲レビュー結果"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
          {onApplyPolishedBody && (
            <Button
              variant="primary"
              onClick={() => {
                onApplyPolishedBody(result.polishedBody);
                onClose();
              }}
            >
              ✍️ 推敲後テキストを本文に反映する
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* スコア & 総評ヘッダー */}
        <div className="rounded-xl border border-border bg-surface-raised p-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex flex-col items-center justify-center bg-surface border border-border rounded-xl p-3 min-w-24 text-center shrink-0">
            <span className="text-[10px] text-muted-foreground font-semibold">総合スコア</span>
            <span
              className={`text-3xl font-black ${
                result.score >= 80
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : result.score >= 60
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {result.score}
            </span>
            <span className="text-[10px] text-muted-foreground">/ 100点</span>
          </div>

          <div className="flex-1 space-y-1.5 min-w-0 text-sm">
            <div className="font-bold text-foreground">編集者・査読者総評</div>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {result.critique}
            </p>
            {result.advice && (
              <div className="mt-2 rounded-md bg-primary/5 border border-primary/20 p-2 text-xs text-primary leading-relaxed">
                💡 <span className="font-semibold">改善のヒント:</span> {result.advice}
              </div>
            )}
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('issues')}
            className={`border-b-2 px-4 py-2 text-xs font-semibold transition cursor-pointer ${
              activeTab === 'issues'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            🔍 指摘事項・改善ポイント ({result.issues.length} 件)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('polished')}
            className={`border-b-2 px-4 py-2 text-xs font-semibold transition cursor-pointer ${
              activeTab === 'polished'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            ✨ 推敲後テキスト案
          </button>
        </div>

        {/* タブコンテンツ */}
        {activeTab === 'issues' ? (
          <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {result.issues.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground italic">
                気になる問題点は検出されませんでした。素晴らしい文章です！
              </div>
            ) : (
              result.issues.map((issue, idx) => {
                const config = TYPE_CONFIG[issue.type] ?? TYPE_CONFIG.other;
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-surface p-3 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.bg} ${config.text} ${config.border}`}
                      >
                        {config.label}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="rounded bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 p-2 text-rose-700 dark:text-rose-300 line-through decoration-rose-500/60">
                        {issue.originalText}
                      </div>
                      <div className="rounded bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-2 text-emerald-700 dark:text-emerald-300 font-medium">
                        👉 {issue.suggestion}
                      </div>
                    </div>

                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      💬 {issue.reason}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>推敲後テキスト ({result.polishedBody.length.toLocaleString()} 文字)</span>
            </div>
            <textarea
              readOnly
              value={result.polishedBody}
              rows={12}
              className="w-full font-mono text-xs rounded-lg border border-border bg-surface-raised p-3 text-foreground focus:outline-none leading-relaxed select-all"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
