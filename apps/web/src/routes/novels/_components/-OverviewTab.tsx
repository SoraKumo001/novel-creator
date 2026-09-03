import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAnalysis } from "@/hooks/useAnalysis.js";
import { useChapters } from "@/hooks/useChapters.js";
import {
  useHistoryViewState,
  useModalResultState,
  useModalState,
} from "@/hooks/useModalResultState.js";
import { useNovel } from "@/hooks/useNovel.js";
import { toErrorMessage } from "@/lib/errors.js";
import type {
  AnalysisHistoryEntry,
  CharacterVoiceCheckResult,
  MultiPersonaReviewResult,
  StoryArcResult,
} from "@/lib/types.js";
import { OverviewView } from "./-OverviewView.js";

export function OverviewTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
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

  const infoEditModal = useModalState();
  const deleteConfirmModal = useModalState();
  const heatmapModal = useModalState();
  const styleGuideModal = useModalState();

  const arcModal = useModalResultState<StoryArcResult>();
  const arcHistory = useHistoryViewState();
  const voiceModal = useModalResultState<CharacterVoiceCheckResult>();
  const voiceHistory = useHistoryViewState();
  const personaModal = useModalResultState<MultiPersonaReviewResult>();
  const personaHistory = useHistoryViewState();

  const [title, setTitle] = useState(novel.title);
  const [description, setDescription] = useState(novel.description ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSaveStyleGuide = async (newStyleGuide: string) => {
    await updateNovel(novel.id, { styleGuide: newStyleGuide });
    await onRefresh();
  };

  const [targetWordCount, setTargetWordCount] = useState<number>(() => {
    const saved = localStorage.getItem(
      `novel-creator:target-words-total:${novel.id}`
    );
    return saved ? Number.parseInt(saved, 10) : 100_000;
  });
  const [isEditingTarget, setIsEditingTarget] = useState(false);

  const totalSections = useMemo(
    () => chapters.reduce((acc, ch) => acc + ch.sections.length, 0),
    [chapters]
  );

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
      if ((e as Error)?.name === "AbortError") {
        return;
      }
      arcModal.setError(toErrorMessage(e));
    }
  };

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
      if ((e as Error)?.name === "AbortError") {
        return;
      }
      voiceModal.setError(toErrorMessage(e));
    }
  };

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
      if ((e as Error)?.name === "AbortError") {
        return;
      }
      personaModal.setError(toErrorMessage(e));
    }
  };

  const handleSelectArcHistory = (entry: AnalysisHistoryEntry) => {
    if (entry.analysisType !== "story-arc") {
      return;
    }
    arcModal.setResult(entry.result as StoryArcResult);
    arcModal.setError(null);
    arcHistory.showHistory(entry.createdAt);
  };
  const handleSelectVoiceHistory = (entry: AnalysisHistoryEntry) => {
    if (entry.analysisType !== "check-voice") {
      return;
    }
    voiceModal.setResult(entry.result as CharacterVoiceCheckResult);
    voiceModal.setError(null);
    voiceHistory.showHistory(entry.createdAt);
  };
  const handleSelectPersonaHistory = (entry: AnalysisHistoryEntry) => {
    if (entry.analysisType !== "persona-review") {
      return;
    }
    personaModal.setResult(entry.result as MultiPersonaReviewResult);
    personaModal.setError(null);
    personaHistory.showHistory(entry.createdAt);
  };

  const handleSaveTargetWords = (val: number) => {
    const clamped = Math.max(
      1000,
      Math.min(1_000_000, Number.isNaN(val) ? 100_000 : val)
    );
    setTargetWordCount(clamped);
    localStorage.setItem(
      `novel-creator:target-words-total:${novel.id}`,
      String(clamped)
    );
    setIsEditingTarget(false);
  };

  async function handleDelete() {
    try {
      await deleteNovel(novel.id);
      navigate({ to: "/novels" });
    } catch (e) {
      setFormError(toErrorMessage(e));
    }
  }

  async function handleSave() {
    setFormError(null);
    if (!title.trim()) {
      setFormError("タイトルを入力してください");
      return;
    }
    try {
      await updateNovel(novel.id, {
        title: title.trim(),
        description: description.trim(),
      });
      infoEditModal.close();
      await onRefresh();
    } catch (e) {
      setFormError(toErrorMessage(e));
    }
  }

  return (
    <OverviewView
      novel={novel}
      chapters={chapters}
      totalSections={totalSections}
      targetWordCount={targetWordCount}
      isEditingTarget={isEditingTarget}
      updating={updating}
      deleting={deleting}
      running={running}
      progress={progress}
      title={title}
      description={description}
      formError={formError}
      modals={{
        infoEdit: infoEditModal,
        deleteConfirm: deleteConfirmModal,
        heatmap: heatmapModal,
        styleGuide: styleGuideModal,
        arc: arcModal,
        arcHistory: {
          isHistoryView: arcHistory.isHistoryView,
          viewedAt: arcHistory.viewedAt,
          key: arcHistory.historyKey,
        },
        voice: voiceModal,
        voiceHistory: {
          isHistoryView: voiceHistory.isHistoryView,
          viewedAt: voiceHistory.viewedAt,
          key: voiceHistory.historyKey,
        },
        persona: personaModal,
        personaHistory: {
          isHistoryView: personaHistory.isHistoryView,
          viewedAt: personaHistory.viewedAt,
          key: personaHistory.historyKey,
        },
      }}
      onEditTarget={() => setIsEditingTarget(true)}
      onSaveTargetWords={handleSaveTargetWords}
      onOpenInfoEdit={infoEditModal.open}
      onTitleChange={setTitle}
      onDescriptionChange={setDescription}
      onSaveInfo={() => void handleSave()}
      onDelete={() => void handleDelete()}
      onOpenStyleGuide={styleGuideModal.open}
      onSaveStyleGuide={handleSaveStyleGuide}
      onRunStoryArc={() => void handleRunStoryArc()}
      onRunVoiceCheck={() => void handleRunVoiceCheck()}
      onRunPersonaReview={() => void handleRunPersonaReview()}
      onSelectArcHistory={handleSelectArcHistory}
      onSelectVoiceHistory={handleSelectVoiceHistory}
      onSelectPersonaHistory={handleSelectPersonaHistory}
      onCancelAnalysis={cancelAnalysis}
    />
  );
}
