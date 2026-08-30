import { useState } from 'react';
import { Button } from './Button.js';
import { MarkdownText } from '@/components/MarkdownText.js';
import { Modal } from './Modal.js';
import type { SettingImpactResult } from '@/lib/types.js';

interface ImpactAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'character' | 'setting';
  targetName: string;
  beforeValue: string;
  onAnalyze: (input: {
    changeTarget: 'character' | 'setting';
    targetName: string;
    beforeValue: string;
    afterValue: string;
  }) => Promise<SettingImpactResult>;
}

const IMPACT_BADGES = {
  low: { label: '影響度: 小', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  medium: { label: '影響度: 中', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  high: {
    label: '影響度: 大（大規模修正）',
    color: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  },
};

const TARGET_TYPE_ICONS: Record<string, string> = {
  plot: '🗺️ プロット',
  section: '📄 節・本文',
  timeline: '⏳ 年表・時系列',
  foreshadowing: '🗝️ 伏線',
};

export function ImpactAnalysisModal({
  isOpen,
  onClose,
  targetType,
  targetName,
  beforeValue,
  onAnalyze,
}: ImpactAnalysisModalProps) {
  const [afterValue, setAfterValue] = useState(beforeValue);
  const [result, setResult] = useState<SettingImpactResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleRunAnalysis = async () => {
    if (!afterValue.trim()) return;
    setAnalyzing(true);
    try {
      const res = await onAnalyze({
        changeTarget: targetType,
        targetName,
        beforeValue,
        afterValue,
      });
      setResult(res);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚡ 設定変更の影響範囲シミュレーター"
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
          {!result && (
            <Button
              variant="primary"
              onClick={() => void handleRunAnalysis()}
              isLoading={analyzing}
              disabled={afterValue === beforeValue}
            >
              🔍 影響範囲をシミュレーション分析
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* 入力フォーム（変更前 vs 変更後） */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              変更前（現在の設定）: {targetName}
            </label>
            <textarea
              readOnly
              value={beforeValue}
              rows={4}
              className="w-full rounded-lg border border-border bg-surface-raised p-2.5 text-xs text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">変更後（新しい設定案）:</label>
            <textarea
              value={afterValue}
              onChange={(e) => setAfterValue(e.target.value)}
              rows={4}
              placeholder="新しい設定内容を入力してください..."
              className="w-full rounded-lg border border-primary p-2.5 text-xs text-foreground bg-surface focus:outline-none font-medium"
            />
          </div>
        </div>

        {/* 分析結果 */}
        {analyzing && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">
              全プロット・章節・年表・伏線との整合性を検証中...
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* 総括カード */}
            <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground text-sm">📋 影響分析サマリー</span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    IMPACT_BADGES[result.impactLevel]?.color ?? ''
                  }`}
                >
                  {IMPACT_BADGES[result.impactLevel]?.label}
                </span>
              </div>
              <MarkdownText
                compact
                content={result.summary}
                className="text-xs text-muted-foreground"
              />
            </div>

            {/* 影響箇所リスト */}
            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
              <div className="text-xs font-semibold text-foreground">
                影響を受ける箇所 ({result.affectedItems.length} 件):
              </div>
              {result.affectedItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic">
                  既存のプロットや章節への悪影響は見つかりませんでした。安全に変更できます。
                </div>
              ) : (
                result.affectedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-surface p-3 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">
                        {TARGET_TYPE_ICONS[item.targetType] ?? item.targetType}: {item.targetTitle}
                      </span>
                    </div>
                    <p className="text-rose-600 dark:text-rose-400 text-[11px] leading-relaxed">
                      ⚠️ <span className="font-semibold">矛盾点:</span> {item.issue}
                    </p>
                    <div className="rounded bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-2 text-emerald-700 dark:text-emerald-300 text-[11px] leading-relaxed">
                      👉 <span className="font-semibold">推奨される修正:</span> {item.suggestedFix}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
