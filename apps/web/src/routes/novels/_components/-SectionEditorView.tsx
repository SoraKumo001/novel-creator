import { AIProgressIndicator } from "@/components/AIProgressIndicator.js";
import { CharacterVoiceCheckerModal } from "@/components/CharacterVoiceCheckerModal.js";
import { CustomPromptManagerModal } from "@/components/CustomPromptManagerModal.js";
import { HistoryDiffModal } from "@/components/HistoryDiffModal.js";
import { InlineAIAssistant } from "@/components/InlineAIAssistant.js";
import { Loading } from "@/components/Loading.js";
import { MultiPersonaReviewModal } from "@/components/MultiPersonaReviewModal.js";
import { ProofreadModal } from "@/components/ProofreadModal.js";
import { StyleGuideModal } from "@/components/StyleGuideModal.js";
import { VerticalPreviewModal } from "@/components/VerticalPreviewModal.js";
import type {
  AnalysisHistoryEntry,
  AnalysisProgress,
  CharacterVoiceCheckResult,
  ExtractResult,
  InlineAssistAction,
  MultiPersonaReviewResult,
  ProofreadResult,
  Section,
} from "@/lib/types.js";
import { EditorToolbar } from "./-EditorToolbar.js";
import { ExtractResultModal } from "./-ExtractResultModal.js";
import { GenerateContentPanel } from "./-GenerateContentPanel.js";
import { MonacoEditor } from "./-MonacoEditor.js";

export interface SectionEditorModalStates {
  customPrompts: { isOpen: boolean; open: () => void; close: () => void };
  extractResult: {
    isOpen: boolean;
    close: () => void;
    result: ExtractResult | null;
  };
  history: { isOpen: boolean; open: () => void; close: () => void };
  personaHistory: {
    isHistoryView: boolean;
    viewedAt: string | null;
    historyKey: number;
  };
  personaReview: {
    isOpen: boolean;
    close: () => void;
    result: MultiPersonaReviewResult | null;
    error: string | null;
  };
  proofread: {
    isOpen: boolean;
    close: () => void;
    result: ProofreadResult | null;
  };
  proofreading: boolean;
  styleGuide: { isOpen: boolean; open: () => void; close: () => void };
  verticalPreview: { isOpen: boolean; open: () => void; close: () => void };
  voiceChecker: {
    isOpen: boolean;
    close: () => void;
    result: CharacterVoiceCheckResult | null;
    error: string | null;
  };
  voiceHistory: {
    isHistoryView: boolean;
    viewedAt: string | null;
    historyKey: number;
  };
}

export interface SectionEditorViewProps {
  activeVariantIndex: number;
  analysisProgress: AnalysisProgress | null;
  analysisRunning: string | null;
  extracting: boolean;
  generatedChars: number;
  generateStartedAt: number | null;
  generatingContent: boolean;
  inlineAssisting: boolean;
  inlineVariants: string[];
  isDirty: boolean;
  isInlineActive: boolean;
  isZenMode: boolean;
  loading: boolean;
  localBody: string;
  modals: SectionEditorModalStates;
  novelId: string;
  novelStyleGuide?: string | null;
  onActivateInline: () => void;
  onApplyInlineInsertAfter: (generated: string) => void;
  onApplyInlineReplace: (generated: string) => void;
  onApplyPolishedBody: (polished: string) => void;
  onApplyVoiceFix: (orig: string, sugg: string) => void;
  onCancelAnalysis: () => void;
  onCancelGeneration: () => void;
  onCancelInline: () => void;
  onCancelProofread: () => void;
  onExecuteInlineAssist: (
    action: InlineAssistAction,
    customInstruction?: string,
    customPromptId?: string | null,
    variantCount?: number
  ) => Promise<void>;
  onExtract: () => void;
  onGenerate: () => void;
  onHistoryRestore: (restored: string) => void;
  onLocalBodyChange: (value: string) => void;
  onModelChange: (id: string | null) => void;
  onOpenChat: (useSelected: boolean) => void;
  onOpenCustomPrompts: () => void;
  onOpenHistory: () => void;
  onOpenPersonaReview: () => void;
  onOpenProofread: () => void;
  onOpenStyleGuide: () => void;
  onOpenVerticalPreview: () => void;
  onOpenVoiceChecker: () => void;
  onSave: () => void;
  onSaveStyleGuide: (newGuide: string) => Promise<void>;
  onSelectInlineVariant: (index: number) => void;
  onSelectionChange: (text: string) => void;
  onSelectPersonaHistory: (entry: AnalysisHistoryEntry) => void;
  onSelectVoiceHistory: (entry: AnalysisHistoryEntry) => void;
  onTargetWordsChange: (val: number) => void;
  onToggleZenMode: () => void;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  progressPercent: number;
  saving: boolean;
  section: Section;
  selectedModelConfigId: string | null;
  selectedText: string;
  streamError: string | null;
  targetWords: number;
  updatingNovel: boolean;
  wordCount: number;
}

/** SectionEditor の描画部分（振る舞い維持のため DOM・props 受け渡しのみ） */
export function SectionEditorView(props: SectionEditorViewProps) {
  const { section, modals } = props;
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <EditorToolbar
        section={section}
        onUpdateTitle={props.onUpdateTitle}
        wordCount={props.wordCount}
        isDirty={props.isDirty}
        saving={props.saving}
        targetWords={props.targetWords}
        onTargetWordsChange={props.onTargetWordsChange}
        extracting={props.extracting}
        canExtract={!!props.localBody.trim()}
        onExtract={props.onExtract}
        generatingContent={props.generatingContent}
        onGenerate={props.onGenerate}
        modelConfigId={props.selectedModelConfigId}
        onModelConfigIdChange={props.onModelChange}
        isZenMode={props.isZenMode}
        onToggleZenMode={props.onToggleZenMode}
        onOpenHistory={props.onOpenHistory}
        onOpenVerticalPreview={props.onOpenVerticalPreview}
        onOpenVoiceChecker={props.onOpenVoiceChecker}
        onOpenPersonaReview={props.onOpenPersonaReview}
        onOpenProofread={props.onOpenProofread}
        onOpenChat={() => props.onOpenChat(false)}
        onOpenStyleGuide={props.onOpenStyleGuide}
        onOpenCustomPrompts={props.onOpenCustomPrompts}
        onSave={props.onSave}
      />

      <div className="h-1 w-full shrink-0 bg-border">
        <div
          className={`h-full transition-all duration-300 ${
            props.progressPercent >= 100 ? "bg-emerald-500" : "bg-primary"
          }`}
          style={{ width: `${props.progressPercent}%` }}
        />
      </div>

      {props.extracting && (
        <div className="shrink-0 border-border border-b bg-surface px-4 py-2">
          <AIProgressIndicator
            variant="inline"
            stage="AIが本文から設定・時系列を自動抽出中..."
            startedAt={props.generateStartedAt ?? Date.now()}
            onCancel={props.onCancelGeneration}
            cancelLabel="抽出を中止"
          />
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {props.loading ? (
          <Loading message="本文を読み込み中..." />
        ) : (
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <MonacoEditor
              value={props.localBody}
              onChange={props.onLocalBodyChange}
              onSelectionChange={props.onSelectionChange}
            />
            {props.selectedText && !props.isInlineActive && (
              <div className="fade-in slide-in-from-top-1 absolute top-4 right-8 z-30 flex animate-in items-center gap-2 duration-150">
                <button
                  type="button"
                  onClick={props.onActivateInline}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/20 bg-primary px-3.5 py-1.5 font-bold text-primary-foreground text-xs shadow-lg transition hover:brightness-110"
                >
                  <span>
                    ✨ 選択範囲をAI推敲 ({props.selectedText.length}文字)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => props.onOpenChat(true)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3.5 py-1.5 font-bold text-foreground text-xs shadow-lg transition hover:border-primary/50 hover:bg-surface-hover"
                >
                  <span>💬 チャットで相談</span>
                </button>
              </div>
            )}
            {props.isInlineActive && (
              <div className="absolute top-4 right-8 z-40 w-[30rem] max-w-[calc(100%-4rem)]">
                <InlineAIAssistant
                  selectedText={props.selectedText}
                  novelId={props.novelId}
                  onApplyReplace={props.onApplyInlineReplace}
                  onApplyInsertAfter={props.onApplyInlineInsertAfter}
                  onCancel={props.onCancelInline}
                  onExecuteAssist={props.onExecuteInlineAssist}
                  onOpenPromptManager={props.onOpenCustomPrompts}
                  isLoading={props.inlineAssisting}
                  startedAt={
                    props.inlineAssisting ? props.generateStartedAt : null
                  }
                  variants={props.inlineVariants}
                  activeVariantIndex={props.activeVariantIndex}
                  onSelectVariantIndex={props.onSelectInlineVariant}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <GenerateContentPanel
        generatingContent={props.generatingContent}
        streamError={props.streamError}
        startedAt={props.generateStartedAt}
        generatedChars={props.generatedChars}
        onCancel={props.onCancelGeneration}
      />

      <ExtractResultModal
        isOpen={modals.extractResult.isOpen}
        onClose={modals.extractResult.close}
        result={modals.extractResult.result}
      />
      <HistoryDiffModal
        isOpen={modals.history.isOpen}
        onClose={modals.history.close}
        novelId={props.novelId}
        entityType="content"
        entityId={section.id}
        currentContent={props.localBody}
        title={`${section.title || `節 ${section.order}`} の本文`}
        onRestoreSuccess={props.onHistoryRestore}
      />
      <VerticalPreviewModal
        isOpen={modals.verticalPreview.isOpen}
        onClose={modals.verticalPreview.close}
        title={section.title || `節 ${section.order}`}
        body={props.localBody}
      />
      <ProofreadModal
        isOpen={modals.proofread.isOpen}
        onClose={modals.proofread.close}
        result={modals.proofread.result}
        isLoading={modals.proofreading}
        onCancel={props.onCancelProofread}
        onApplyPolishedBody={props.onApplyPolishedBody}
      />
      <CharacterVoiceCheckerModal
        isOpen={modals.voiceChecker.isOpen}
        onClose={modals.voiceChecker.close}
        result={modals.voiceChecker.result}
        progress={props.analysisProgress}
        running={props.analysisRunning === "check-voice"}
        error={modals.voiceChecker.error}
        isHistoryView={modals.voiceHistory.isHistoryView}
        viewedAt={modals.voiceHistory.viewedAt}
        novelId={props.novelId}
        historyRefreshKey={modals.voiceHistory.historyKey}
        onSelectHistory={props.onSelectVoiceHistory}
        onRerun={props.onOpenVoiceChecker}
        onCancel={props.onCancelAnalysis}
        onApplyFix={props.onApplyVoiceFix}
      />
      <MultiPersonaReviewModal
        isOpen={modals.personaReview.isOpen}
        onClose={modals.personaReview.close}
        result={modals.personaReview.result}
        progress={props.analysisProgress}
        running={props.analysisRunning === "persona-review"}
        error={modals.personaReview.error}
        isHistoryView={modals.personaHistory.isHistoryView}
        viewedAt={modals.personaHistory.viewedAt}
        novelId={props.novelId}
        historyRefreshKey={modals.personaHistory.historyKey}
        onSelectHistory={props.onSelectPersonaHistory}
        onRerun={props.onOpenPersonaReview}
        onCancel={props.onCancelAnalysis}
      />
      <StyleGuideModal
        isOpen={modals.styleGuide.isOpen}
        onClose={modals.styleGuide.close}
        novelId={props.novelId}
        initialStyleGuide={props.novelStyleGuide}
        onSave={props.onSaveStyleGuide}
        saving={props.updatingNovel}
      />
      <CustomPromptManagerModal
        open={modals.customPrompts.isOpen}
        onClose={modals.customPrompts.close}
        novelId={props.novelId}
      />
    </div>
  );
}
