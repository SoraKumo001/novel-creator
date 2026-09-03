import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAnalysis } from "@/hooks/useAnalysis.js";
import { useAnalysisRunner } from "@/hooks/useAnalysisRunner.js";
import { useChapters } from "@/hooks/useChapters.js";
import {
  useHistoryViewState,
  useModalResultState,
  useModalState,
} from "@/hooks/useModalResultState.js";
import { type NovelMutations, useNovel } from "@/hooks/useNovel.js";
import { useStyleGuideModal } from "@/hooks/useStyleGuideModal.js";
import { useTargetWords } from "@/hooks/useTargetWords.js";
import { REQUIRED_TITLE_MESSAGE } from "@/lib/constants.js";
import { toErrorMessage } from "@/lib/errors.js";
import type {
  CharacterVoiceCheckResult,
  MultiPersonaReviewResult,
  StoryArcResult,
} from "@/lib/types.js";
import { OverviewView } from "./-OverviewView.js";

export function OverviewTab({
  novel,
  novelMutations,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
  novelMutations: NovelMutations;
  onRefresh: () => Promise<void>;
}) {
  const { updateNovel, updating, deleteNovel, deleting } = novelMutations;
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

  const { styleGuideModal, handleSaveStyleGuide } = useStyleGuideModal({
    novelId: novel.id,
    updateNovel,
    onRefresh,
  });

  const {
    targetWords: targetWordCount,
    isEditingTarget,
    handleEditTarget,
    handleSaveTargetWords,
  } = useTargetWords(`novel-creator:target-words-total:${novel.id}`);

  const arcModal = useModalResultState<StoryArcResult>();
  const arcHistory = useHistoryViewState();
  const voiceModal = useModalResultState<CharacterVoiceCheckResult>();
  const voiceHistory = useHistoryViewState();
  const personaModal = useModalResultState<MultiPersonaReviewResult>();
  const personaHistory = useHistoryViewState();

  const arcRunner = useAnalysisRunner<StoryArcResult>({
    run: () => runStoryArc(novel.id),
    modal: arcModal,
    history: arcHistory,
    analysisType: "story-arc",
  });
  const voiceRunner = useAnalysisRunner<CharacterVoiceCheckResult>({
    run: () => runVoiceCheck(novel.id, {}),
    modal: voiceModal,
    history: voiceHistory,
    analysisType: "check-voice",
  });
  const personaRunner = useAnalysisRunner<MultiPersonaReviewResult>({
    run: () => runPersonaReview(novel.id, {}),
    modal: personaModal,
    history: personaHistory,
    analysisType: "persona-review",
  });

  const [title, setTitle] = useState(novel.title);
  const [description, setDescription] = useState(novel.description ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const totalSections = useMemo(
    () => chapters.reduce((acc, ch) => acc + ch.sections.length, 0),
    [chapters]
  );

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
      setFormError(REQUIRED_TITLE_MESSAGE);
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
      onEditTarget={handleEditTarget}
      onSaveTargetWords={handleSaveTargetWords}
      onOpenInfoEdit={infoEditModal.open}
      onTitleChange={setTitle}
      onDescriptionChange={setDescription}
      onSaveInfo={() => void handleSave()}
      onDelete={() => void handleDelete()}
      onOpenStyleGuide={styleGuideModal.open}
      onSaveStyleGuide={handleSaveStyleGuide}
      onRunStoryArc={() => void arcRunner.handleRun()}
      onRunVoiceCheck={() => void voiceRunner.handleRun()}
      onRunPersonaReview={() => void personaRunner.handleRun()}
      onSelectArcHistory={arcRunner.handleSelectHistory}
      onSelectVoiceHistory={voiceRunner.handleSelectHistory}
      onSelectPersonaHistory={personaRunner.handleSelectHistory}
      onCancelAnalysis={cancelAnalysis}
    />
  );
}
