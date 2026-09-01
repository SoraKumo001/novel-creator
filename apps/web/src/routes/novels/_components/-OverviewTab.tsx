import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Button } from '@/components/Button.js';
import { Card, CardHeader } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { Input } from '@/components/Input.js';
import { Modal } from '@/components/Modal.js';
import { Textarea } from '@/components/Textarea.js';
import { CharacterHeatmapModal } from '@/components/CharacterHeatmapModal.js';
import { CharacterVoiceCheckerModal } from '@/components/CharacterVoiceCheckerModal.js';
import { MarkdownText } from '@/components/MarkdownText.js';
import { MultiPersonaReviewModal } from '@/components/MultiPersonaReviewModal.js';
import { StoryArcChartModal } from '@/components/StoryArcChartModal.js';
import { StyleGuideModal } from '@/components/StyleGuideModal.js';
import { useChapters } from '@/hooks/useChapters.js';
import { useAnalysis } from '@/hooks/useAnalysis.js';
import { useNovel } from '@/hooks/useNovel.js';
import {
  useHistoryViewState,
  useModalResultState,
  useModalState,
} from '@/hooks/useModalResultState.js';
import { toErrorMessage } from '@/lib/errors.js';
import type {
  AnalysisHistoryEntry,
  CharacterVoiceCheckResult,
  MultiPersonaReviewResult,
  StoryArcResult,
} from '@/lib/types.js';
import { TrashIcon } from './-Icons.js';

export function OverviewTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const { updateNovel, updating, deleteNovel, deleting } = useNovel(novel.id);
  const { chapters } = useChapters(novel.id);
  const {
    running,
    progress,
    runStoryArc,
    runVoiceCheck,
    runPersonaReview,
    cancel: cancelAnalysis,
  } = useAnalysis();
  const navigate = useNavigate();

  // モーダル用ステート
  const infoEditModal = useModalState();
  const deleteConfirmModal = useModalState();
  const heatmapModal = useModalState();
  const styleGuideModal = useModalState();

  // 分析モーダル用ステート
  const arcModal = useModalResultState<StoryArcResult>();
  const arcHistory = useHistoryViewState();
  const voiceModal = useModalResultState<CharacterVoiceCheckResult>();
  const voiceHistory = useHistoryViewState();
  const personaModal = useModalResultState<MultiPersonaReviewResult>();
  const personaHistory = useHistoryViewState();

  const [title, setTitle] = useState(novel.title);
  const [description, setDescription] = useState(novel.description ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSaveStyleGuide = async (newStyleGuide: string) => {
    await updateNovel(novel.id, { styleGuide: newStyleGuide });
    await onRefresh();
  };

  // 目標文字数管理
  const [targetWordCount, setTargetWordCount] = useState<number>(() => {
    const saved = localStorage.getItem(`novel-creator:target-words-total:${novel.id}`);
    return saved ? parseInt(saved, 10) : 100000;
  });
  const [isEditingTarget, setIsEditingTarget] = useState(false);

  // 節の総数
  const totalSections = useMemo(() => {
    return chapters.reduce((acc, ch) => acc + ch.sections.length, 0);
  }, [chapters]);

  // ストーリーアーク分析実行
  const handleRunStoryArc = async () => {
    arcModal.open();
    arcModal.setResult(null);
    arcModal.setError(null);
    arcHistory.resetHistoryView();
    try {
      const res = await runStoryArc(novel.id);
      arcModal.setResult(res);
      arcHistory.bumpHistoryKey();
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return; // キャンセルは静かに無視
      arcModal.setError(toErrorMessage(e)); // モーダルは開いたまま再試行を促す
    }
  };

  // 全体口調チェック実行
  const handleRunVoiceCheck = async () => {
    voiceModal.open();
    voiceModal.setResult(null);
    voiceModal.setError(null);
    voiceHistory.resetHistoryView();
    try {
      const res = await runVoiceCheck(novel.id, {});
      voiceModal.setResult(res);
      voiceHistory.bumpHistoryKey();
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      voiceModal.setError(toErrorMessage(e));
    }
  };

  // 全体模擬読者レビュー実行
  const handleRunPersonaReview = async () => {
    personaModal.open();
    personaModal.setResult(null);
    personaModal.setError(null);
    personaHistory.resetHistoryView();
    try {
      const res = await runPersonaReview(novel.id, {});
      personaModal.setResult(res);
      personaHistory.bumpHistoryKey();
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      personaModal.setError(toErrorMessage(e));
    }
  };

  // 履歴から結果を読み込む
  const handleSelectArcHistory = (entry: AnalysisHistoryEntry) => {
    if (entry.analysisType !== 'story-arc') return;
    arcModal.setResult(entry.result as StoryArcResult);
    arcModal.setError(null);
    arcHistory.showHistory(entry.createdAt);
  };
  const handleSelectVoiceHistory = (entry: AnalysisHistoryEntry) => {
    if (entry.analysisType !== 'check-voice') return;
    voiceModal.setResult(entry.result as CharacterVoiceCheckResult);
    voiceModal.setError(null);
    voiceHistory.showHistory(entry.createdAt);
  };
  const handleSelectPersonaHistory = (entry: AnalysisHistoryEntry) => {
    if (entry.analysisType !== 'persona-review') return;
    personaModal.setResult(entry.result as MultiPersonaReviewResult);
    personaModal.setError(null);
    personaHistory.showHistory(entry.createdAt);
  };

  const handleSaveTargetWords = (val: number) => {
    const clamped = Math.max(1000, Math.min(1000000, isNaN(val) ? 100000 : val));
    setTargetWordCount(clamped);
    localStorage.setItem(`novel-creator:target-words-total:${novel.id}`, String(clamped));
    setIsEditingTarget(false);
  };

  async function handleDelete() {
    try {
      await deleteNovel(novel.id);
      navigate({ to: '/novels' });
    } catch (e) {
      setFormError(toErrorMessage(e));
    }
  }

  async function handleSave() {
    setFormError(null);
    if (!title.trim()) {
      setFormError('タイトルを入力してください');
      return;
    }
    try {
      await updateNovel(novel.id, { title: title.trim(), description: description.trim() });
      infoEditModal.close();
      await onRefresh();
    } catch (e) {
      setFormError(toErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      {/* 統計 & 執筆進捗カード */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="章数 / 節数" value={`${novel.chapters.length} 章 / ${totalSections} 節`} />
        <StatCard label="登場人物" value={`${novel.characters.length} 人`} />
        <StatCard label="世界観設定" value={`${novel.settings.length} 件`} />
        <Card className="flex flex-col justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-semibold flex items-center justify-between">
              <span>目標文字数</span>
              {isEditingTarget ? (
                <input
                  type="number"
                  autoFocus
                  defaultValue={targetWordCount}
                  onBlur={(e) => handleSaveTargetWords(parseInt(e.target.value, 10))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveTargetWords(parseInt(e.currentTarget.value, 10));
                    }
                  }}
                  className="w-20 rounded border border-primary px-1 py-0.5 text-xs text-foreground bg-background"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingTarget(true)}
                  className="text-primary hover:underline text-[11px] cursor-pointer"
                >
                  変更
                </button>
              )}
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {targetWordCount.toLocaleString()} 字
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">
            読了目安: 約 {Math.ceil(targetWordCount / 400)} 分
          </div>
        </Card>
      </div>

      {/* 高度な創作・分析AIスイート */}
      <Card className="space-y-4">
        <CardHeader
          title="⚡ ストーリー分析 & 創作レビュー・インテリジェンス"
          action={
            <span className="text-xs text-muted-foreground font-normal">
              作品全体の構造やキャラ・読後感をAIが総合診断
            </span>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => void handleRunStoryArc()}
            className="flex flex-col items-start p-3.5 rounded-xl border border-border bg-surface-raised hover:border-primary hover:bg-primary/5 transition text-left cursor-pointer group"
          >
            <span className="text-2xl mb-1">📈</span>
            <div className="font-bold text-sm text-foreground group-hover:text-primary">
              感情アーク & テンション
            </div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
              全章節の盛り上がり度・緊張感の起伏をグラフで可視化・診断
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleRunVoiceCheck()}
            className="flex flex-col items-start p-3.5 rounded-xl border border-border bg-surface-raised hover:border-primary hover:bg-primary/5 transition text-left cursor-pointer group"
          >
            <span className="text-2xl mb-1">🎭</span>
            <div className="font-bold text-sm text-foreground group-hover:text-primary">
              キャラクター口調チェッカー
            </div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
              一人称・二人称・語尾のブレやキャラ崩壊を一括検出
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleRunPersonaReview()}
            className="flex flex-col items-start p-3.5 rounded-xl border border-border bg-surface-raised hover:border-primary hover:bg-primary/5 transition text-left cursor-pointer group"
          >
            <span className="text-2xl mb-1">👥</span>
            <div className="font-bold text-sm text-foreground group-hover:text-primary">
              模擬読者・編集部レビュー
            </div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
              商業編集者や考察派ファン等4名のペルソナが作品を査読
            </div>
          </button>

          <button
            type="button"
            onClick={heatmapModal.open}
            className="flex flex-col items-start p-3.5 rounded-xl border border-border bg-surface-raised hover:border-primary hover:bg-primary/5 transition text-left cursor-pointer group"
          >
            <span className="text-2xl mb-1">📊</span>
            <div className="font-bold text-sm text-foreground group-hover:text-primary">
              人物出現頻度ヒートマップ
            </div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
              誰がどの章に出ているかをマトリックス表示し出番偏りを防止
            </div>
          </button>
        </div>
      </Card>

      {/* ストーリー構想 & あらすじ・結末相談 */}
      <Card className="space-y-3">
        <CardHeader
          title="🗺️ ストーリー構想・あらすじ・結末（共創ワークスペース）"
          action={
            <Button
              variant="secondary"
              onClick={() =>
                navigate({
                  to: '/novels/$novelId',
                  params: { novelId: novel.id },
                  search: { tab: 'plot' },
                })
              }
            >
              {novel.storyOutline?.trim() ? '構想・相談を開く' : '構想・相談を始める'}
            </Button>
          }
        />
        {novel.storyOutline?.trim() ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary border border-primary/20"></span>
              <span className="text-xs text-muted-foreground">
                AIチャット相談・セクション推敲・章立て展開と連動中
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-raised p-3 text-xs">
              <MarkdownText content={novel.storyOutline} className="line-clamp-6" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-surface-raised p-4">
            <div className="space-y-1 text-xs">
              <div className="font-bold text-foreground">ストーリー構想・あらすじが未作成です</div>
              <p className="text-muted-foreground">
                全体のあらすじ、序盤・中盤の展開、今後の展開候補、結末などをMarkdownで自由に記述しながら、AIと相談・反復推敲を重ねて骨格を固めることができます。
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              className="shrink-0"
              onClick={() =>
                navigate({
                  to: '/novels/$novelId',
                  params: { novelId: novel.id },
                  search: { tab: 'plot' },
                })
              }
            >
              構想・相談を始める
            </Button>
          </div>
        )}
      </Card>

      {/* 執筆スタイル・文体ガイドライン */}
      <Card className="space-y-3">
        <CardHeader
          title="📝 執筆スタイル & 文体ガイドライン"
          action={
            <Button variant="secondary" onClick={styleGuideModal.open}>
              {novel.styleGuide?.trim() ? 'スタイルを編集' : 'スタイルを設定'}
            </Button>
          }
        />
        {novel.styleGuide?.trim() ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                設定済み（{novel.styleGuide.length.toLocaleString()}文字）
              </span>
              <span className="text-xs text-muted-foreground">
                本文生成・推敲・校正プロンプトへ自動適用中
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-raised p-3 text-xs">
              <MarkdownText content={novel.styleGuide} className="line-clamp-6" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-surface-raised p-4">
            <div className="space-y-1 text-xs">
              <div className="font-bold text-foreground">執筆スタイル・作法が未設定です</div>
              <p className="text-muted-foreground">
                一人称/三人称視点、視点人物、自称、文体トーン、表記作法などを定義すると、AIの本文生成・推敲・校正の品質と一貫性が大幅に向上します。
              </p>
            </div>
            <Button variant="primary" size="sm" className="shrink-0" onClick={styleGuideModal.open}>
              テンプレートから設定
            </Button>
          </div>
        )}
      </Card>

      {/* 基本情報 */}
      <Card>
        <CardHeader
          title="基本情報"
          action={
            <Button variant="secondary" onClick={infoEditModal.open}>
              編集
            </Button>
          }
        />
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">タイトル</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{novel.title}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">説明</dt>
            <dd className="text-slate-700 dark:text-slate-300">
              {novel.description ? (
                <MarkdownText
                  content={novel.description}
                  className="text-slate-700 dark:text-slate-300"
                />
              ) : (
                '未設定'
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={deleteConfirmModal.open} leftIcon={<TrashIcon />}>
          この小説を削除
        </Button>
      </div>

      {/* モーダル群 */}
      <Modal
        isOpen={infoEditModal.isOpen}
        onClose={infoEditModal.close}
        title="小説情報を編集"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={infoEditModal.close} disabled={updating}>
              キャンセル
            </Button>
            <Button onClick={handleSave} isLoading={updating}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="タイトル" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            label="説明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
          {formError && <p className="text-sm text-rose-500">{formError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmModal.isOpen}
        onClose={deleteConfirmModal.close}
        onConfirm={handleDelete}
        title="小説を削除しますか？"
        message="この小説と、紐づく章・節・本文・設定・人物・タイムラインがすべて削除されます。この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deleting}
      />

      <StoryArcChartModal
        isOpen={arcModal.isOpen}
        onClose={arcModal.close}
        result={arcModal.result}
        progress={progress}
        running={running === 'story-arc'}
        error={arcModal.error}
        isHistoryView={arcHistory.isHistoryView}
        viewedAt={arcHistory.viewedAt}
        novelId={novel.id}
        historyRefreshKey={arcHistory.historyKey}
        onSelectHistory={handleSelectArcHistory}
        onRerun={() => void handleRunStoryArc()}
        onCancel={cancelAnalysis}
      />

      <CharacterVoiceCheckerModal
        isOpen={voiceModal.isOpen}
        onClose={voiceModal.close}
        result={voiceModal.result}
        progress={progress}
        running={running === 'check-voice'}
        error={voiceModal.error}
        isHistoryView={voiceHistory.isHistoryView}
        viewedAt={voiceHistory.viewedAt}
        novelId={novel.id}
        historyRefreshKey={voiceHistory.historyKey}
        onSelectHistory={handleSelectVoiceHistory}
        onRerun={() => void handleRunVoiceCheck()}
        onCancel={cancelAnalysis}
      />

      <MultiPersonaReviewModal
        isOpen={personaModal.isOpen}
        onClose={personaModal.close}
        result={personaModal.result}
        progress={progress}
        running={running === 'persona-review'}
        error={personaModal.error}
        isHistoryView={personaHistory.isHistoryView}
        viewedAt={personaHistory.viewedAt}
        novelId={novel.id}
        historyRefreshKey={personaHistory.historyKey}
        onSelectHistory={handleSelectPersonaHistory}
        onRerun={() => void handleRunPersonaReview()}
        onCancel={cancelAnalysis}
      />

      <CharacterHeatmapModal
        isOpen={heatmapModal.isOpen}
        onClose={heatmapModal.close}
        characters={novel.characters}
        chapters={chapters}
      />

      <StyleGuideModal
        isOpen={styleGuideModal.isOpen}
        onClose={styleGuideModal.close}
        novelId={novel.id}
        initialStyleGuide={novel.styleGuide}
        onSave={handleSaveStyleGuide}
        saving={updating}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </Card>
  );
}
