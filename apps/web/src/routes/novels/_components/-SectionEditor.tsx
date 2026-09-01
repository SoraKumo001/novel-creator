import { useCallback, useEffect, useRef, useState } from "react";
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
import { useChatUI } from "@/context/ChatContext.js";

import { useAnalysis } from "@/hooks/useAnalysis.js";
import { useContent } from "@/hooks/useContent.js";
import { useGenerate } from "@/hooks/useGenerate.js";
import {
  useHistoryViewState,
  useModalResultState,
  useModalState,
} from "@/hooks/useModalResultState.js";
import { useNovel } from "@/hooks/useNovel.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { proofreadSectionContent } from "@/lib/services/index.js";
import { countWords } from "@/lib/sse.js";
import type {
  AnalysisHistoryEntry,
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

interface SectionEditorProps {
  isZenMode: boolean;
  novelId: string;
  onRefresh: () => Promise<void>;
  onToggleZenMode: () => void;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  section: Section;
}

export function SectionEditor({
  novelId,
  section,
  onRefresh,
  onUpdateTitle,
  isZenMode,
  onToggleZenMode,
}: SectionEditorProps) {
  const { content, loading, saving, updateContent } = useContent(section.id);
  const {
    generateContent,
    generatingContent,
    inlineAssist,
    inlineAssisting,
    extract,
    extracting,
    startedAt: generateStartedAt,
    generatedChars,
    cancelGeneration,
    streamError,
    resetStreamError,
  } = useGenerate();

  const {
    running,
    progress,
    runVoiceCheck,
    runPersonaReview,
    cancel: cancelAnalysis,
  } = useAnalysis();

  const { novel, updateNovel, updating: updatingNovel } = useNovel(novelId);

  const [localBody, setLocalBody] = useState("");
  const [savedBody, setSavedBody] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [targetWords, setTargetWords] = useState(() => {
    const saved = localStorage.getItem(
      `novel-creator:target-words:${section.id}`
    );
    return saved ? Number.parseInt(saved, 10) : 2000;
  });

  // モーダル用ステート
  const styleGuideModal = useModalState();
  const extractResultModal = useModalResultState<ExtractResult>();
  const historyModal = useModalState();
  const verticalPreviewModal = useModalState();
  const proofreadModal = useModalResultState<ProofreadResult>();
  const [proofreading, setProofreading] = useState(false);
  const voiceCheckerModal = useModalResultState<CharacterVoiceCheckResult>();
  const voiceHistory = useHistoryViewState();
  const personaReviewModal = useModalResultState<MultiPersonaReviewResult>();
  const personaHistory = useHistoryViewState();
  const customPromptManagerModal = useModalState();

  const handleSaveStyleGuide = async (newGuide: string) => {
    await updateNovel(novelId, { styleGuide: newGuide });
    await onRefresh();
  };

  // インラインAI支援用ステート
  const [selectedText, setSelectedText] = useState("");
  const [inlineVariants, setInlineVariants] = useState<string[]>([""]);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [isInlineActive, setIsInlineActive] = useState(false);

  const toast = useToast();

  useEffect(() => {
    if (content) {
      setLocalBody(content.body);
      setSavedBody(content.body);
      setWordCount(content.wordCount ?? countWords(content.body));
    }
  }, [content]);

  useEffect(() => {
    setWordCount(countWords(localBody));
  }, [localBody]);

  const isDirty = localBody !== savedBody;

  const handleSave = useCallback(async () => {
    if (!isDirty && !saving) {
      return;
    }
    try {
      await updateContent(localBody);
      setSavedBody(localBody);
      await onRefresh();
      toast.success("本文を保存しました");
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  }, [isDirty, localBody, onRefresh, saving, toast, updateContent]);

  // Ctrl+S / Cmd+S ショートカットで保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  const handleTargetWordsChange = (val: number) => {
    const clamped = Math.max(
      100,
      Math.min(50_000, Number.isNaN(val) ? 2000 : val)
    );
    setTargetWords(clamped);
    localStorage.setItem(
      `novel-creator:target-words:${section.id}`,
      String(clamped)
    );
  };

  const [selectedModelConfigId, setSelectedModelConfigId] = useState<
    string | null
  >(() => localStorage.getItem("novel-creator:editor-model") || null);

  const handleModelChange = (id: string | null) => {
    setSelectedModelConfigId(id);
    if (id) {
      localStorage.setItem("novel-creator:editor-model", id);
    } else {
      localStorage.removeItem("novel-creator:editor-model");
    }
  };

  async function handleGenerate() {
    resetStreamError();
    let accumulated = localBody;
    await generateContent(
      section.id,
      (chunk) => {
        accumulated += chunk;
        setLocalBody(accumulated);
      },
      selectedModelConfigId
    );
    await updateContent(accumulated);
    setSavedBody(accumulated);
  }

  async function handleExtract() {
    if (!localBody.trim()) {
      return;
    }
    const result = await extract(section.id);
    extractResultModal.setResult(result);
    extractResultModal.open();
  }

  const proofreadAbortControllerRef = useRef<AbortController | null>(null);

  // 校正モーダル
  const handleOpenProofread = async () => {
    if (!localBody.trim()) {
      toast.error("校正する本文がありません");
      return;
    }
    proofreadModal.open();
    setProofreading(true);
    const controller = new AbortController();
    proofreadAbortControllerRef.current = controller;
    try {
      const res = await proofreadSectionContent(
        section.id,
        localBody,
        selectedModelConfigId,
        controller.signal
      );
      proofreadModal.setResult(res);
    } catch (e) {
      if ((e as Error)?.name === "AbortError" || controller.signal.aborted) {
        return;
      }
      toast.error(toErrorMessage(e));
      proofreadModal.close();
    } finally {
      setProofreading(false);
      proofreadAbortControllerRef.current = null;
    }
  };

  const handleCancelProofread = () => {
    if (proofreadAbortControllerRef.current) {
      proofreadAbortControllerRef.current.abort();
      proofreadAbortControllerRef.current = null;
    }
    setProofreading(false);
    proofreadModal.close();
  };

  // 口調チェッカーモーダル
  const handleOpenVoiceChecker = async () => {
    if (!localBody.trim()) {
      toast.error("チェックする本文がありません");
      return;
    }
    voiceCheckerModal.open();
    voiceCheckerModal.setResult(null);
    voiceCheckerModal.setError(null);
    voiceHistory.resetHistoryView();
    try {
      const res = await runVoiceCheck(novelId, {
        body: localBody,
        modelConfigId: selectedModelConfigId,
      });
      voiceCheckerModal.setResult(res);
      voiceHistory.bumpHistoryKey();
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        return;
      }
      voiceCheckerModal.setError(toErrorMessage(e));
    }
  };

  // 模擬読者レビューモーダル
  const handleOpenPersonaReview = async () => {
    if (!localBody.trim()) {
      toast.error("レビュー対象の本文がありません");
      return;
    }
    personaReviewModal.open();
    personaReviewModal.setResult(null);
    personaReviewModal.setError(null);
    personaHistory.resetHistoryView();
    try {
      const res = await runPersonaReview(novelId, {
        sectionId: section.id,
        body: localBody,
        modelConfigId: selectedModelConfigId,
      });
      personaReviewModal.setResult(res);
      personaHistory.bumpHistoryKey();
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        return;
      }
      personaReviewModal.setError(toErrorMessage(e));
    }
  };

  // 履歴から結果を読み込む
  const handleSelectVoiceHistory = (entry: AnalysisHistoryEntry) => {
    if (entry.analysisType !== "check-voice") {
      return;
    }
    voiceCheckerModal.setResult(entry.result as CharacterVoiceCheckResult);
    voiceCheckerModal.setError(null);
    voiceHistory.showHistory(entry.createdAt);
  };
  const handleSelectPersonaHistory = (entry: AnalysisHistoryEntry) => {
    if (entry.analysisType !== "persona-review") {
      return;
    }
    personaReviewModal.setResult(entry.result as MultiPersonaReviewResult);
    personaReviewModal.setError(null);
    personaHistory.showHistory(entry.createdAt);
  };

  const { openChat } = useChatUI();

  // チャット相談起動
  const handleOpenChat = useCallback(
    (useSelected = false) => {
      if (useSelected && selectedText.trim()) {
        openChat(novelId, {
          entityType: "selection",
          title: `第${section.order}節「${section.title || "（無題）"}」（選択テキスト）`,
          selectedText: selectedText.trim(),
        });
        return;
      }

      openChat(novelId, {
        entityType: "section",
        title: `第${section.order}節「${section.title || "（無題）"}」`,
        summary: localBody.slice(0, 800) + (localBody.length > 800 ? "…" : ""),
      });
    },
    [localBody, novelId, openChat, section.order, section.title, selectedText]
  );

  // 選択テキスト変更
  const handleSelectionChange = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      setSelectedText(trimmed);
    }
  };

  // インラインAIアシスト実行
  const handleExecuteInlineAssist = async (
    action: InlineAssistAction,
    customInstruction?: string,
    customPromptId?: string | null,
    variantCount: number = 1
  ) => {
    if (!selectedText) {
      return;
    }
    const count = Math.max(1, Math.min(3, variantCount));
    const initialVariants = Array.from({ length: count }, () => "");
    setInlineVariants(initialVariants);
    setActiveVariantIndex(0);
    const accVariants = [...initialVariants];

    try {
      await inlineAssist(
        section.id,
        {
          selectedText,
          action,
          customInstruction,
          customPromptId,
          modelConfigId: selectedModelConfigId,
          variantCount: count,
        },
        (chunk, variantIndex) => {
          const idx =
            typeof variantIndex === "number" &&
            variantIndex >= 0 &&
            variantIndex < count
              ? variantIndex
              : 0;
          accVariants[idx] = (accVariants[idx] || "") + chunk;
          setInlineVariants([...accVariants]);
        }
      );
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  };

  // インラインAI置換
  const handleApplyInlineReplace = (generated: string) => {
    if (!selectedText || !generated) {
      return;
    }
    const newBody = localBody.replace(selectedText, generated);
    setLocalBody(newBody);
    setIsInlineActive(false);
    setSelectedText("");
    setInlineVariants([""]);
    setActiveVariantIndex(0);
    toast.success("選択範囲を書き換えました");
  };

  // インラインAI挿入
  const handleApplyInlineInsertAfter = (generated: string) => {
    if (!selectedText || !generated) {
      return;
    }
    const idx = localBody.indexOf(selectedText);
    if (idx !== -1) {
      const insertPos = idx + selectedText.length;
      const newBody =
        localBody.slice(0, insertPos) +
        "\n" +
        generated +
        localBody.slice(insertPos);
      setLocalBody(newBody);
      setIsInlineActive(false);
      setSelectedText("");
      setInlineVariants([""]);
      setActiveVariantIndex(0);
      toast.success("直後にテキストを挿入しました");
    }
  };

  // 口調修正反映
  const handleApplyVoiceFix = (orig: string, sugg: string) => {
    if (localBody.includes(orig)) {
      const updated = localBody.replace(orig, sugg);
      setLocalBody(updated);
      toast.success("セリフを修正しました");
    } else {
      toast.error("本文中に該当箇所が見つかりませんでした");
    }
  };

  // 進捗率
  const progressPercent = Math.min(
    100,
    Math.round((wordCount / targetWords) * 100)
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <EditorToolbar
        section={section}
        onUpdateTitle={onUpdateTitle}
        wordCount={wordCount}
        isDirty={isDirty}
        saving={saving}
        targetWords={targetWords}
        onTargetWordsChange={handleTargetWordsChange}
        extracting={extracting}
        canExtract={!!localBody.trim()}
        onExtract={() => void handleExtract()}
        generatingContent={generatingContent}
        onGenerate={() => void handleGenerate()}
        modelConfigId={selectedModelConfigId}
        onModelConfigIdChange={handleModelChange}
        isZenMode={isZenMode}
        onToggleZenMode={onToggleZenMode}
        onOpenHistory={historyModal.open}
        onOpenVerticalPreview={verticalPreviewModal.open}
        onOpenVoiceChecker={() => void handleOpenVoiceChecker()}
        onOpenPersonaReview={() => void handleOpenPersonaReview()}
        onOpenProofread={() => void handleOpenProofread()}
        onOpenChat={() => handleOpenChat(false)}
        onOpenStyleGuide={styleGuideModal.open}
        onOpenCustomPrompts={customPromptManagerModal.open}
        onSave={() => void handleSave()}
      />

      {/* 目標達成度プログレスバー */}
      <div className="h-1 w-full shrink-0 bg-border">
        <div
          className={`h-full transition-all duration-300 ${
            progressPercent >= 100 ? "bg-emerald-500" : "bg-primary"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {extracting && (
        <div className="shrink-0 border-border border-b bg-surface px-4 py-2">
          <AIProgressIndicator
            variant="inline"
            stage="AIが本文から設定・時系列を自動抽出中..."
            startedAt={generateStartedAt ?? Date.now()}
            onCancel={cancelGeneration}
            cancelLabel="抽出を中止"
          />
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading ? (
          <Loading message="本文を読み込み中..." />
        ) : (
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <MonacoEditor
              value={localBody}
              onChange={setLocalBody}
              onSelectionChange={handleSelectionChange}
            />

            {/* 選択テキストがある場合のインラインAI・チャット相談トリガーバー */}
            {selectedText && !isInlineActive && (
              <div className="fade-in slide-in-from-top-1 absolute top-4 right-8 z-30 flex animate-in items-center gap-2 duration-150">
                <button
                  type="button"
                  onClick={() => setIsInlineActive(true)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/20 bg-primary px-3.5 py-1.5 font-bold text-primary-foreground text-xs shadow-lg transition hover:brightness-110"
                >
                  <span>✨ 選択範囲をAI推敲 ({selectedText.length}文字)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenChat(true)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3.5 py-1.5 font-bold text-foreground text-xs shadow-lg transition hover:border-primary/50 hover:bg-surface-hover"
                >
                  <span>💬 チャットで相談</span>
                </button>
              </div>
            )}

            {/* インラインAIアシスタントパネル */}
            {isInlineActive && (
              <div className="absolute top-4 right-8 z-40 w-[30rem] max-w-[calc(100%-4rem)]">
                <InlineAIAssistant
                  selectedText={selectedText}
                  novelId={novelId}
                  onApplyReplace={handleApplyInlineReplace}
                  onApplyInsertAfter={handleApplyInlineInsertAfter}
                  onCancel={() => {
                    if (inlineAssisting) {
                      cancelGeneration();
                    }
                    setIsInlineActive(false);
                    setInlineVariants([""]);
                    setActiveVariantIndex(0);
                  }}
                  onExecuteAssist={handleExecuteInlineAssist}
                  onOpenPromptManager={customPromptManagerModal.open}
                  isLoading={inlineAssisting}
                  startedAt={inlineAssisting ? generateStartedAt : null}
                  variants={inlineVariants}
                  activeVariantIndex={activeVariantIndex}
                  onSelectVariantIndex={setActiveVariantIndex}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <GenerateContentPanel
        generatingContent={generatingContent}
        streamError={streamError}
        startedAt={generateStartedAt}
        generatedChars={generatedChars}
        onCancel={cancelGeneration}
      />

      <ExtractResultModal
        isOpen={extractResultModal.isOpen}
        onClose={extractResultModal.close}
        result={extractResultModal.result}
      />
      <HistoryDiffModal
        isOpen={historyModal.isOpen}
        onClose={historyModal.close}
        novelId={novelId}
        entityType="content"
        entityId={section.id}
        currentContent={localBody}
        title={`${section.title || `節 ${section.order}`} の本文`}
        onRestoreSuccess={(restored) => {
          setLocalBody(restored);
          setSavedBody(restored);
          toast.success("過去のバージョンから本文を復元しました");
          void onRefresh();
        }}
      />
      <VerticalPreviewModal
        isOpen={verticalPreviewModal.isOpen}
        onClose={verticalPreviewModal.close}
        title={section.title || `節 ${section.order}`}
        body={localBody}
      />
      <ProofreadModal
        isOpen={proofreadModal.isOpen}
        onClose={proofreadModal.close}
        result={proofreadModal.result}
        isLoading={proofreading}
        onCancel={handleCancelProofread}
        onApplyPolishedBody={(polished) => {
          setLocalBody(polished);
          toast.success("推敲後の文章を本文に反映しました");
        }}
      />
      <CharacterVoiceCheckerModal
        isOpen={voiceCheckerModal.isOpen}
        onClose={voiceCheckerModal.close}
        result={voiceCheckerModal.result}
        progress={progress}
        running={running === "check-voice"}
        error={voiceCheckerModal.error}
        isHistoryView={voiceHistory.isHistoryView}
        viewedAt={voiceHistory.viewedAt}
        novelId={novelId}
        historyRefreshKey={voiceHistory.historyKey}
        onSelectHistory={handleSelectVoiceHistory}
        onRerun={() => void handleOpenVoiceChecker()}
        onCancel={cancelAnalysis}
        onApplyFix={handleApplyVoiceFix}
      />
      <MultiPersonaReviewModal
        isOpen={personaReviewModal.isOpen}
        onClose={personaReviewModal.close}
        result={personaReviewModal.result}
        progress={progress}
        running={running === "persona-review"}
        error={personaReviewModal.error}
        isHistoryView={personaHistory.isHistoryView}
        viewedAt={personaHistory.viewedAt}
        novelId={novelId}
        historyRefreshKey={personaHistory.historyKey}
        onSelectHistory={handleSelectPersonaHistory}
        onRerun={() => void handleOpenPersonaReview()}
        onCancel={cancelAnalysis}
      />
      <StyleGuideModal
        isOpen={styleGuideModal.isOpen}
        onClose={styleGuideModal.close}
        novelId={novelId}
        initialStyleGuide={novel?.styleGuide}
        onSave={handleSaveStyleGuide}
        saving={updatingNovel}
      />
      <CustomPromptManagerModal
        open={customPromptManagerModal.isOpen}
        onClose={customPromptManagerModal.close}
        novelId={novelId}
      />
    </div>
  );
}
