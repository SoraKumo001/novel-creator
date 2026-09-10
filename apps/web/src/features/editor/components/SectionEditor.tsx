import { useCallback, useEffect, useRef, useState } from "react";
import { useChatUI } from "@/context/ChatContext.js";
import { useAnalysis } from "@/hooks/useAnalysis.js";
import { useAnalysisRunner } from "@/hooks/useAnalysisRunner.js";
import { useChapters } from "@/hooks/useChapters.js";
import { useContent } from "@/hooks/useContent.js";
import { useGenerate } from "@/hooks/useGenerate.js";
import {
  useHistoryViewState,
  useModalResultState,
  useModalState,
} from "@/hooks/useModalResultState.js";
import type { NovelMutations } from "@/hooks/useNovel.js";
import { useStyleGuideModal } from "@/hooks/useStyleGuideModal.js";
import { useTargetWords } from "@/hooks/useTargetWords.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { countWords } from "@/lib/sse.js";
import type {
  CharacterVoiceCheckResult,
  ExtractResult,
  MultiPersonaReviewResult,
  ProofreadResult,
  Section,
} from "@/lib/types.js";
import { useSectionInlineAssist } from "../hooks/useSectionInlineAssist.js";
import { useSectionProofread } from "../hooks/useSectionProofread.js";
import { SectionEditorView } from "./SectionEditorView.js";

interface SectionEditorProps {
  isZenMode: boolean;
  novelId: string;
  novelMutations: NovelMutations;
  novelStyleGuide?: string | null;
  onRefresh: () => Promise<void>;
  onToggleZenMode: () => void;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  section: Section;
}

export function SectionEditor({
  novelId,
  section,
  novelMutations,
  novelStyleGuide,
  onRefresh,
  onUpdateTitle,
  isZenMode,
  onToggleZenMode,
}: SectionEditorProps) {
  const {
    content,
    error: contentError,
    loading,
    saving,
    updateContent,
  } = useContent(section.id);
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
    retry: retryGenerate,
    canRetry: canRetryGenerate,
  } = useGenerate();
  const {
    running,
    progress,
    runVoiceCheck,
    runPersonaReview,
    cancel: cancelAnalysis,
  } = useAnalysis();

  const [localBody, setLocalBody] = useState("");
  const [savedBody, setSavedBody] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const { targetWords, handleSaveTargetWords } = useTargetWords(
    `novel-creator:target-words:${section.id}`
  );

  const { styleGuideModal, handleSaveStyleGuide } = useStyleGuideModal({
    novelId,
    updateNovel: novelMutations.updateNovel,
    onRefresh,
  });
  const extractResultModal = useModalResultState<ExtractResult>();
  const historyModal = useModalState();
  const verticalPreviewModal = useModalState();
  const proofreadModal = useModalResultState<ProofreadResult>();
  const voiceCheckerModal = useModalResultState<CharacterVoiceCheckResult>();
  const voiceHistory = useHistoryViewState();
  const personaReviewModal = useModalResultState<MultiPersonaReviewResult>();
  const personaHistory = useHistoryViewState();
  const customPromptManagerModal = useModalState();

  const toast = useToast();

  const { updateSection } = useChapters(novelId);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaDirty, setMetaDirty] = useState(false);
  const metaDraftRef = useRef<{ summary: string; title: string } | null>(null);
  const metaConfirmModal = useModalState();
  const generateModeModal = useModalState();

  const handleMetaDirtyChange = useCallback((dirty: boolean) => {
    setMetaDirty(dirty);
  }, []);

  const handleMetaDraftChange = useCallback(
    (draft: { summary: string; title: string }) => {
      metaDraftRef.current = draft;
    },
    []
  );

  const handleSaveSectionMeta = useCallback(
    async (input: { summary: string; title: string }) => {
      setMetaSaving(true);
      try {
        await updateSection(section.id, {
          order: section.order,
          summary: input.summary,
          title: input.title || section.title || `節 ${section.order}`,
        });
        await onRefresh();
        toast.success("節の概要を保存しました");
        return true;
      } catch (e) {
        toast.error(toErrorMessage(e));
        return false;
      } finally {
        setMetaSaving(false);
      }
    },
    [onRefresh, section.id, section.order, section.title, toast, updateSection]
  );

  const [selectedModelConfigId, setSelectedModelConfigId] = useState<
    string | null
  >(() => localStorage.getItem("novel-creator:editor-model") || null);

  const inline = useSectionInlineAssist({
    sectionId: section.id,
    localBody,
    setLocalBody,
    selectedModelConfigId,
    inlineAssist,
    inlineAssisting,
    cancelGeneration,
  });
  const selectedText = inline.selectedText;
  const proofread = useSectionProofread({
    sectionId: section.id,
    getBody: () => localBody,
    getModelConfigId: () => selectedModelConfigId,
    modal: proofreadModal,
  });
  const proofreading = proofread.proofreading;

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

  const handleModelChange = (id: string | null) => {
    setSelectedModelConfigId(id);
    if (id) {
      localStorage.setItem("novel-creator:editor-model", id);
    } else {
      localStorage.removeItem("novel-creator:editor-model");
    }
  };

  async function runGenerate(mode: "append" | "replace") {
    resetStreamError();
    const base = mode === "replace" ? "" : localBody;
    let accumulated = base;
    try {
      await generateContent(
        section.id,
        (chunk) => {
          accumulated += chunk;
          setLocalBody(accumulated);
        },
        selectedModelConfigId
      );
      if (accumulated.length === base.length) {
        return;
      }
      await updateContent(accumulated);
      setSavedBody(accumulated);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return;
      }
      toast.error(toErrorMessage(e));
    }
  }

  function proceedToGenerate() {
    if (localBody.trim()) {
      generateModeModal.open();
      return;
    }
    void runGenerate("append");
  }

  function handleGenerateRequest() {
    if (generatingContent) {
      return;
    }
    if (metaDirty) {
      metaConfirmModal.open();
      return;
    }
    proceedToGenerate();
  }

  function handleGenerateAppend() {
    generateModeModal.close();
    void runGenerate("append");
  }

  function handleGenerateReplace() {
    generateModeModal.close();
    void runGenerate("replace");
  }

  async function handleMetaSaveAndGenerate() {
    const draft = metaDraftRef.current;
    if (draft) {
      const ok = await handleSaveSectionMeta(draft);
      if (!ok) {
        return;
      }
    }
    metaConfirmModal.close();
    proceedToGenerate();
  }

  function handleMetaGenerateAsIs() {
    metaConfirmModal.close();
    proceedToGenerate();
  }

  async function handleRetryGenerate() {
    resetStreamError();
    const base = localBody;
    let accumulated = base;
    try {
      await retryGenerate((chunk) => {
        accumulated += chunk;
        setLocalBody(accumulated);
      });
      if (accumulated.length === base.length) {
        return;
      }
      await updateContent(accumulated);
      setSavedBody(accumulated);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return;
      }
      toast.error(toErrorMessage(e));
    }
  }

  async function handleExtract() {
    if (!localBody.trim()) {
      return;
    }
    const result = await extract(section.id);
    extractResultModal.setResult(result);
    extractResultModal.open();
  }

  const handleOpenProofread = proofread.handleOpenProofread;
  const handleCancelProofread = proofread.handleCancelProofread;

  const voiceRunner = useAnalysisRunner<CharacterVoiceCheckResult>({
    run: () =>
      runVoiceCheck(novelId, {
        body: localBody,
        modelConfigId: selectedModelConfigId,
      }),
    modal: voiceCheckerModal,
    history: voiceHistory,
    analysisType: "check-voice",
  });
  const personaRunner = useAnalysisRunner<MultiPersonaReviewResult>({
    run: () =>
      runPersonaReview(novelId, {
        sectionId: section.id,
        body: localBody,
        modelConfigId: selectedModelConfigId,
      }),
    modal: personaReviewModal,
    history: personaHistory,
    analysisType: "persona-review",
  });

  const handleOpenVoiceChecker = async () => {
    if (!localBody.trim()) {
      toast.error("チェックする本文がありません");
      return;
    }
    await voiceRunner.handleRun();
  };

  const handleOpenPersonaReview = async () => {
    if (!localBody.trim()) {
      toast.error("レビュー対象の本文がありません");
      return;
    }
    await personaRunner.handleRun();
  };

  const { openChat } = useChatUI();

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

  const handleSelectionChange = inline.handleSelectionChange;
  const handleExecuteInlineAssist = inline.handleExecuteInlineAssist;
  const handleApplyInlineReplace = inline.handleApplyInlineReplace;
  const handleApplyInlineInsertAfter = inline.handleApplyInlineInsertAfter;

  const handleApplyVoiceFix = (orig: string, sugg: string) => {
    if (localBody.includes(orig)) {
      const updated = localBody.replace(orig, sugg);
      setLocalBody(updated);
      toast.success("セリフを修正しました");
    } else {
      toast.error("本文中に該当箇所が見つかりませんでした");
    }
  };

  const progressPercent = Math.min(
    100,
    Math.round((wordCount / targetWords) * 100)
  );

  return (
    <SectionEditorView
      section={section}
      novelId={novelId}
      novelStyleGuide={novelStyleGuide}
      updatingNovel={novelMutations.updating}
      isZenMode={isZenMode}
      localBody={localBody}
      loadError={contentError}
      loading={loading}
      saving={saving}
      isDirty={isDirty}
      wordCount={wordCount}
      targetWords={targetWords}
      progressPercent={progressPercent}
      extracting={extracting}
      generatingContent={generatingContent}
      streamError={streamError}
      generateStartedAt={generateStartedAt}
      generatedChars={generatedChars}
      selectedModelConfigId={selectedModelConfigId}
      selectedText={selectedText}
      isInlineActive={inline.isInlineActive}
      inlineVariants={inline.inlineVariants}
      activeVariantIndex={inline.activeVariantIndex}
      inlineAssisting={inlineAssisting}
      analysisRunning={running}
      analysisProgress={progress}
      modals={{
        styleGuide: styleGuideModal,
        extractResult: extractResultModal,
        history: historyModal,
        verticalPreview: verticalPreviewModal,
        proofread: proofreadModal,
        proofreading,
        voiceChecker: voiceCheckerModal,
        voiceHistory,
        personaReview: personaReviewModal,
        personaHistory,
        customPrompts: customPromptManagerModal,
      }}
      onLocalBodyChange={setLocalBody}
      onSelectionChange={handleSelectionChange}
      onSave={() => void handleSave()}
      onSaveSectionMeta={(input) =>
        handleSaveSectionMeta(input).then(() => undefined)
      }
      sectionMetaSaving={metaSaving}
      onMetaDirtyChange={handleMetaDirtyChange}
      onMetaDraftChange={handleMetaDraftChange}
      metaConfirmOpen={metaConfirmModal.isOpen}
      onMetaConfirmClose={metaConfirmModal.close}
      onMetaConfirmSaveAndGenerate={() => void handleMetaSaveAndGenerate()}
      onMetaConfirmGenerateAsIs={handleMetaGenerateAsIs}
      generateModeOpen={generateModeModal.isOpen}
      onGenerateModeClose={generateModeModal.close}
      onGenerateAppend={handleGenerateAppend}
      onGenerateReplace={handleGenerateReplace}
      onUpdateTitle={onUpdateTitle}
      onToggleZenMode={onToggleZenMode}
      onTargetWordsChange={handleSaveTargetWords}
      onModelChange={handleModelChange}
      onGenerate={handleGenerateRequest}
      onExtract={() => void handleExtract()}
      onCancelGeneration={cancelGeneration}
      onRetryGeneration={() => void handleRetryGenerate()}
      canRetryGeneration={canRetryGenerate}
      onOpenHistory={historyModal.open}
      onOpenVerticalPreview={verticalPreviewModal.open}
      onOpenVoiceChecker={() => void handleOpenVoiceChecker()}
      onOpenPersonaReview={() => void handleOpenPersonaReview()}
      onOpenProofread={() => void handleOpenProofread()}
      onCancelProofread={handleCancelProofread}
      onOpenChat={handleOpenChat}
      onOpenStyleGuide={styleGuideModal.open}
      onOpenCustomPrompts={customPromptManagerModal.open}
      onExecuteInlineAssist={handleExecuteInlineAssist}
      onApplyInlineReplace={handleApplyInlineReplace}
      onApplyInlineInsertAfter={handleApplyInlineInsertAfter}
      onCancelInline={() => inline.handleCancelInline(inlineAssisting)}
      onSelectInlineVariant={inline.setActiveVariantIndex}
      onActivateInline={() => inline.setIsInlineActive(true)}
      onApplyVoiceFix={handleApplyVoiceFix}
      onApplyPolishedBody={(polished) => {
        setLocalBody(polished);
        toast.success("推敲後の文章を本文に反映しました");
      }}
      onSaveStyleGuide={handleSaveStyleGuide}
      onSelectVoiceHistory={voiceRunner.handleSelectHistory}
      onSelectPersonaHistory={personaRunner.handleSelectHistory}
      onHistoryRestore={(restored) => {
        setLocalBody(restored);
        setSavedBody(restored);
        toast.success("過去のバージョンから本文を復元しました");
        void onRefresh();
      }}
      onCancelAnalysis={cancelAnalysis}
    />
  );
}
