import { useState } from 'react';
import { Button } from './Button.js';
import { Modal } from './Modal.js';
import type { MultiPersonaReviewResult, ReaderPersonaType } from '@/lib/types.js';

interface MultiPersonaReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: MultiPersonaReviewResult | null;
  isLoading: boolean;
}

const PERSONA_CONFIG: Record<
  ReaderPersonaType,
  { icon: string; title: string; color: string; badge: string }
> = {
  editor: {
    icon: '👔',
    title: '商業文芸・ラノベ編集者',
    color: 'border-blue-500/30 bg-blue-500/5',
    badge: 'bg-blue-500/10 text-blue-600',
  },
  casual: {
    icon: '🍿',
    title: '一般エンタメ読者',
    color: 'border-emerald-500/30 bg-emerald-500/5',
    badge: 'bg-emerald-500/10 text-emerald-600',
  },
  lore: {
    icon: '🔍',
    title: '世界観・設定考察派ファン',
    color: 'border-purple-500/30 bg-purple-500/5',
    badge: 'bg-purple-500/10 text-purple-600',
  },
  critic: {
    icon: '🖋️',
    title: '辛口文芸評論家',
    color: 'border-rose-500/30 bg-rose-500/5',
    badge: 'bg-rose-500/10 text-rose-600',
  },
};

export function MultiPersonaReviewModal({
  isOpen,
  onClose,
  result,
  isLoading,
}: MultiPersonaReviewModalProps) {
  const [selectedPersona, setSelectedPersona] = useState<ReaderPersonaType>('editor');

  if (isLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="模擬読者レビューを生成中..." size="lg">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-center">
            <p className="font-semibold text-foreground">4名のペルソナが作品を精読・査読中...</p>
            <p className="text-xs text-muted-foreground mt-1">
              編集者・一般読者・設定考察派・辛口評論家の視点でレビューを執筆しています
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  if (!result) return null;

  const currentReview =
    result.reviews.find((r) => r.persona === selectedPersona) ?? result.reviews[0];
  const personaConfig = PERSONA_CONFIG[currentReview?.persona ?? 'editor'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="👥 複数ペルソナによる模擬読者・編集部レビュー"
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      <div className="space-y-4">
        {/* 全体読後感 */}
        <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-1.5 text-xs">
          <div className="font-bold text-foreground text-sm">📋 査読チーム総合インプレッション</div>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {result.overallImpression}
          </p>
        </div>

        {/* ペルソナ選択タブ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {result.reviews.map((rev) => {
            const config = PERSONA_CONFIG[rev.persona];
            const isSelected = rev.persona === selectedPersona;
            return (
              <button
                key={rev.persona}
                type="button"
                onClick={() => setSelectedPersona(rev.persona)}
                className={`flex flex-col items-start p-3 rounded-xl border transition text-left cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border bg-surface hover:bg-surface-raised'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-lg">{config.icon}</span>
                  <span className="text-amber-500 text-xs font-bold">
                    {'★'.repeat(rev.rating)}
                    {'☆'.repeat(5 - rev.rating)}
                  </span>
                </div>
                <div className="font-bold text-foreground text-xs mt-1 truncate w-full">
                  {rev.personaName}
                </div>
              </button>
            );
          })}
        </div>

        {/* 選択されたペルソナの詳細レビューカード */}
        {currentReview && (
          <div
            className={`rounded-xl border p-5 space-y-4 transition animate-in fade-in duration-200 ${personaConfig.color}`}
          >
            {/* ヘッダー & キャッチコピー */}
            <div className="space-y-1.5 border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{personaConfig.icon}</span>
                  <span className="font-bold text-foreground text-sm">
                    {currentReview.personaName} の講評
                  </span>
                </div>
                <span className="text-amber-500 text-sm font-black">
                  {'★'.repeat(currentReview.rating)}
                  {'☆'.repeat(5 - currentReview.rating)} ({currentReview.rating} / 5 点)
                </span>
              </div>
              <div className="font-semibold text-foreground text-xs italic bg-surface/80 p-2 rounded-lg border border-border/50">
                &ldquo;{currentReview.catchphrase}&rdquo;
              </div>
            </div>

            {/* 良かった点 & 気になった点 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
                <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span>✨ 良かった点・魅力</span>
                </div>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-[11px]">
                  {currentReview.praise}
                </p>
              </div>

              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 space-y-1">
                <div className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <span>💬 改善が望まれる点・懸念</span>
                </div>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-[11px]">
                  {currentReview.criticism}
                </p>
              </div>
            </div>

            {/* アドバイス */}
            <div className="rounded-lg bg-surface border border-border p-3 text-xs space-y-1">
              <div className="font-bold text-primary flex items-center gap-1">
                <span>💡 このペルソナからのリライト助言:</span>
              </div>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap text-[11px]">
                {currentReview.advice}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
