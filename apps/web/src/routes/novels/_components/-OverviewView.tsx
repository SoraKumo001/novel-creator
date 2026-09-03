import { Button } from "@/components/Button.js";
import { Card, CardHeader } from "@/components/Card.js";
import { CharacterHeatmapModal } from "@/components/CharacterHeatmapModal.js";
import { CharacterVoiceCheckerModal } from "@/components/CharacterVoiceCheckerModal.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { Input } from "@/components/Input.js";
import { MarkdownText } from "@/components/MarkdownText.js";
import { Modal } from "@/components/Modal.js";
import { MultiPersonaReviewModal } from "@/components/MultiPersonaReviewModal.js";
import { StoryArcChartModal } from "@/components/StoryArcChartModal.js";
import { StyleGuideModal } from "@/components/StyleGuideModal.js";
import { Textarea } from "@/components/Textarea.js";
import type {
  AnalysisHistoryEntry,
  AnalysisProgress,
  ChapterWithSections,
  CharacterVoiceCheckResult,
  MultiPersonaReviewResult,
  NovelDetail,
  StoryArcResult,
} from "@/lib/types.js";
import { TrashIcon } from "./-Icons.js";

export interface OverviewModalBundle {
  arc: {
    isOpen: boolean;
    close: () => void;
    result: StoryArcResult | null;
    error: string | null;
  };
  arcHistory: { isHistoryView: boolean; viewedAt: string | null; key: number };
  deleteConfirm: { isOpen: boolean; open: () => void; close: () => void };
  heatmap: { isOpen: boolean; open: () => void; close: () => void };
  infoEdit: { isOpen: boolean; open: () => void; close: () => void };
  persona: {
    isOpen: boolean;
    close: () => void;
    result: MultiPersonaReviewResult | null;
    error: string | null;
  };
  personaHistory: {
    isHistoryView: boolean;
    viewedAt: string | null;
    key: number;
  };
  styleGuide: { isOpen: boolean; open: () => void; close: () => void };
  voice: {
    isOpen: boolean;
    close: () => void;
    result: CharacterVoiceCheckResult | null;
    error: string | null;
  };
  voiceHistory: {
    isHistoryView: boolean;
    viewedAt: string | null;
    key: number;
  };
}

export interface OverviewViewProps {
  chapters: ChapterWithSections[];
  deleting: boolean;
  description: string;
  formError: string | null;
  isEditingTarget: boolean;
  modals: OverviewModalBundle;
  novel: NovelDetail;
  onCancelAnalysis: () => void;
  onDelete: () => void;
  onDescriptionChange: (value: string) => void;
  onEditTarget: () => void;
  onOpenInfoEdit: () => void;
  onOpenStyleGuide: () => void;
  onRunPersonaReview: () => void;
  onRunStoryArc: () => void;
  onRunVoiceCheck: () => void;
  onSaveInfo: () => void;
  onSaveStyleGuide: (guide: string) => Promise<void>;
  onSaveTargetWords: (val: number) => void;
  onSelectArcHistory: (entry: AnalysisHistoryEntry) => void;
  onSelectPersonaHistory: (entry: AnalysisHistoryEntry) => void;
  onSelectVoiceHistory: (entry: AnalysisHistoryEntry) => void;
  onTitleChange: (value: string) => void;
  progress: AnalysisProgress | null;
  running: string | null;
  targetWordCount: number;
  title: string;
  totalSections: number;
  updating: boolean;
}

export function OverviewView(props: OverviewViewProps) {
  const { novel, modals } = props;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="章数 / 節数"
          value={`${novel.chapters.length} 章 / ${props.totalSections} 節`}
        />
        <StatCard label="登場人物" value={`${novel.characters.length} 人`} />
        <StatCard label="世界観設定" value={`${novel.settings.length} 件`} />
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between font-semibold text-muted-foreground text-xs">
              <span>目標文字数</span>
              {props.isEditingTarget ? (
                <input
                  type="number"
                  autoFocus
                  defaultValue={props.targetWordCount}
                  onBlur={(e) =>
                    props.onSaveTargetWords(Number.parseInt(e.target.value, 10))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      props.onSaveTargetWords(
                        Number.parseInt(e.currentTarget.value, 10)
                      );
                    }
                  }}
                  className="w-20 rounded border border-primary bg-background px-1 py-0.5 text-foreground text-xs"
                />
              ) : (
                <button
                  type="button"
                  onClick={props.onEditTarget}
                  className="cursor-pointer text-[11px] text-primary hover:underline"
                >
                  変更
                </button>
              )}
            </div>
            <div className="mt-1 font-bold text-2xl text-foreground">
              {props.targetWordCount.toLocaleString()} 字
            </div>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            読了目安: 約 {Math.ceil(props.targetWordCount / 400)} 分
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="基本情報"
          action={
            <Button variant="secondary" onClick={props.onOpenInfoEdit}>
              編集
            </Button>
          }
        />
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">タイトル</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {novel.title}
            </dd>
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
                "未設定"
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="space-y-4">
        <CardHeader
          title="⚡ ストーリー分析 & 創作レビュー・インテリジェンス"
          action={
            <span className="font-normal text-muted-foreground text-xs">
              作品全体の構造やキャラ・読後感をAIが総合診断
            </span>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AnalysisButton
            emoji="📈"
            title="感情アーク & テンション"
            description="全章節の盛り上がり度・緊張感の起伏をグラフで可視化・診断"
            onClick={props.onRunStoryArc}
          />
          <AnalysisButton
            emoji="🎭"
            title="キャラクター口調チェッカー"
            description="一人称・二人称・語尾のブレやキャラ崩壊を一括検出"
            onClick={props.onRunVoiceCheck}
          />
          <AnalysisButton
            emoji="👥"
            title="模擬読者・編集部レビュー"
            description="商業編集者や考察派ファン等4名のペルソナが作品を査読"
            onClick={props.onRunPersonaReview}
          />
          <AnalysisButton
            emoji="📊"
            title="人物出現頻度ヒートマップ"
            description="誰がどの章に出ているかをマトリックス表示し出番偏りを防止"
            onClick={modals.heatmap.open}
          />
        </div>
      </Card>

      <Card className="space-y-3">
        <CardHeader
          title="📝 執筆スタイル & 文体ガイドライン"
          action={
            <Button variant="secondary" onClick={props.onOpenStyleGuide}>
              {novel.styleGuide?.trim() ? "スタイルを編集" : "スタイルを設定"}
            </Button>
          }
        />
        {novel.styleGuide?.trim() ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-semibold text-primary text-xs">
                設定済み（{novel.styleGuide.length.toLocaleString()}文字）
              </span>
              <span className="text-muted-foreground text-xs">
                本文生成・推敲・校正プロンプトへ自動適用中
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-raised p-3 text-xs">
              <MarkdownText
                content={novel.styleGuide}
                className="line-clamp-6"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-border border-dashed bg-surface-raised p-4 sm:flex-row sm:items-center">
            <div className="space-y-1 text-xs">
              <div className="font-bold text-foreground">
                執筆スタイル・作法が未設定です
              </div>
              <p className="text-muted-foreground">
                一人称/三人称視点、視点人物、自称、文体トーン、表記作法などを定義すると、AIの本文生成・推敲・校正の品質と一貫性が大幅に向上します。
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              className="shrink-0"
              onClick={props.onOpenStyleGuide}
            >
              テンプレートから設定
            </Button>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={modals.deleteConfirm.open}
          leftIcon={<TrashIcon />}
        >
          この小説を削除
        </Button>
      </div>

      <Modal
        isOpen={modals.infoEdit.isOpen}
        onClose={modals.infoEdit.close}
        title="小説情報を編集"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={modals.infoEdit.close}
              disabled={props.updating}
            >
              キャンセル
            </Button>
            <Button onClick={props.onSaveInfo} isLoading={props.updating}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="タイトル"
            value={props.title}
            onChange={(e) => props.onTitleChange(e.target.value)}
          />
          <Textarea
            label="説明"
            value={props.description}
            onChange={(e) => props.onDescriptionChange(e.target.value)}
            rows={5}
          />
          {props.formError && (
            <p className="text-rose-500 text-sm">{props.formError}</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={modals.deleteConfirm.isOpen}
        onClose={modals.deleteConfirm.close}
        onConfirm={props.onDelete}
        title="小説を削除しますか？"
        message="この小説と、紐づく章・節・本文・設定・人物・タイムラインがすべて削除されます。この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={props.deleting}
      />

      <StoryArcChartModal
        isOpen={modals.arc.isOpen}
        onClose={modals.arc.close}
        result={modals.arc.result}
        progress={props.progress}
        running={props.running === "story-arc"}
        error={modals.arc.error}
        isHistoryView={modals.arcHistory.isHistoryView}
        viewedAt={modals.arcHistory.viewedAt}
        novelId={novel.id}
        historyRefreshKey={modals.arcHistory.key}
        onSelectHistory={props.onSelectArcHistory}
        onRerun={props.onRunStoryArc}
        onCancel={props.onCancelAnalysis}
      />

      <CharacterVoiceCheckerModal
        isOpen={modals.voice.isOpen}
        onClose={modals.voice.close}
        result={modals.voice.result}
        progress={props.progress}
        running={props.running === "check-voice"}
        error={modals.voice.error}
        isHistoryView={modals.voiceHistory.isHistoryView}
        viewedAt={modals.voiceHistory.viewedAt}
        novelId={novel.id}
        historyRefreshKey={modals.voiceHistory.key}
        onSelectHistory={props.onSelectVoiceHistory}
        onRerun={props.onRunVoiceCheck}
        onCancel={props.onCancelAnalysis}
      />

      <MultiPersonaReviewModal
        isOpen={modals.persona.isOpen}
        onClose={modals.persona.close}
        result={modals.persona.result}
        progress={props.progress}
        running={props.running === "persona-review"}
        error={modals.persona.error}
        isHistoryView={modals.personaHistory.isHistoryView}
        viewedAt={modals.personaHistory.viewedAt}
        novelId={novel.id}
        historyRefreshKey={modals.personaHistory.key}
        onSelectHistory={props.onSelectPersonaHistory}
        onRerun={props.onRunPersonaReview}
        onCancel={props.onCancelAnalysis}
      />

      <CharacterHeatmapModal
        isOpen={modals.heatmap.isOpen}
        onClose={modals.heatmap.close}
        characters={novel.characters}
        chapters={props.chapters}
      />

      <StyleGuideModal
        isOpen={modals.styleGuide.isOpen}
        onClose={modals.styleGuide.close}
        novelId={novel.id}
        initialStyleGuide={novel.styleGuide}
        onSave={props.onSaveStyleGuide}
        saving={props.updating}
      />
    </div>
  );
}

function AnalysisButton({
  emoji,
  title,
  description,
  onClick,
}: {
  emoji: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex cursor-pointer flex-col items-start rounded-xl border border-border bg-surface-raised p-3.5 text-left transition hover:border-primary hover:bg-primary/5"
    >
      <span className="mb-1 text-2xl">{emoji}</span>
      <div className="font-bold text-foreground text-sm group-hover:text-primary">
        {title}
      </div>
      <div className="mt-1 text-muted-foreground text-xs leading-relaxed">
        {description}
      </div>
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <div className="text-slate-500 text-sm dark:text-slate-400">{label}</div>
      <div className="mt-1 font-bold text-2xl text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </Card>
  );
}
