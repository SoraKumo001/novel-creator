import { useCallback, useEffect, useRef, useState } from 'react';
import { AIProgressIndicator } from '@/components/AIProgressIndicator.js';
import { Loading } from '@/components/Loading.js';
import { HistoryDiffModal } from '@/components/HistoryDiffModal.js';
import { ProofreadModal } from '@/components/ProofreadModal.js';
import { VerticalPreviewModal } from '@/components/VerticalPreviewModal.js';
import { CharacterVoiceCheckerModal } from '@/components/CharacterVoiceCheckerModal.js';
import { MultiPersonaReviewModal } from '@/components/MultiPersonaReviewModal.js';
import { StyleGuideModal } from '@/components/StyleGuideModal.js';
import { InlineAIAssistant } from '@/components/InlineAIAssistant.js';
import { useContent } from '@/hooks/useContent.js';
import { useAnalysis } from '@/hooks/useAnalysis.js';
import { useGenerate } from '@/hooks/useGenerate.js';
import { useChat } from '@/hooks/useChat.js';
import { useNovel } from '@/hooks/useNovel.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import { countWords } from '@/lib/sse.js';
import { proofreadSectionContent } from '@/lib/services/index.js';
import type {
  AnalysisHistoryEntry,
  CharacterVoiceCheckResult,
  ExtractResult,
  InlineAssistAction,
  MultiPersonaReviewResult,
  ProofreadResult,
  Section,
} from '@/lib/types.js';
import { MonacoEditor } from './-MonacoEditor.js';
import { EditorToolbar } from './-EditorToolbar.js';
import { GenerateContentPanel } from './-GenerateContentPanel.js';
import { ExtractResultModal } from './-ExtractResultModal.js';

interface SectionEditorProps {
  novelId: string;
  section: Section;
  onRefresh: () => Promise<void>;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  isZenMode: boolean;
  onToggleZenMode: () => void;
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
  const [styleGuideOpen, setStyleGuideOpen] = useState(false);

  const handleSaveStyleGuide = async (newGuide: string) => {
    await updateNovel(novelId, { styleGuide: newGuide });
    await onRefresh();
  };

  const [localBody, setLocalBody] = useState('');
  const [savedBody, setSavedBody] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [targetWords, setTargetWords] = useState(() => {
    const saved = localStorage.getItem(`novel-creator:target-words:${section.id}`);
    return saved ? parseInt(saved, 10) : 2000;
  });

  // モーダル用ステート
  const [extractResultOpen, setExtractResultOpen] = useState(false);
  const [extracted, setExtracted] = useState<ExtractResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [verticalPreviewOpen, setVerticalPreviewOpen] = useState(false);

  const [proofreadOpen, setProofreadOpen] = useState(false);
  const [proofreadResult, setProofreadResult] = useState<ProofreadResult | null>(null);
  const [proofreading, setProofreading] = useState(false);

  const [voiceCheckerOpen, setVoiceCheckerOpen] = useState(false);
  const [voiceResult, setVoiceResult] = useState<CharacterVoiceCheckResult | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceHistoryView, setVoiceHistoryView] = useState(false);
  const [voiceViewedAt, setVoiceViewedAt] = useState<string | null>(null);
  const [voiceHistoryKey, setVoiceHistoryKey] = useState(0);

  const [personaReviewOpen, setPersonaReviewOpen] = useState(false);
  const [personaResult, setPersonaResult] = useState<MultiPersonaReviewResult | null>(null);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [personaHistoryView, setPersonaHistoryView] = useState(false);
  const [personaViewedAt, setPersonaViewedAt] = useState<string | null>(null);
  const [personaHistoryKey, setPersonaHistoryKey] = useState(0);

  // インラインAI支援用ステート
  const [selectedText, setSelectedText] = useState('');
  const [inlineGeneratedText, setInlineGeneratedText] = useState('');
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
    if (!isDirty && !saving) return;
    try {
      await updateContent(localBody);
      setSavedBody(localBody);
      await onRefresh();
      toast.success('本文を保存しました');
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  }, [isDirty, localBody, onRefresh, saving, toast, updateContent]);

  // Ctrl+S / Cmd+S ショートカットで保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleTargetWordsChange = (val: number) => {
    const clamped = Math.max(100, Math.min(50000, isNaN(val) ? 2000 : val));
    setTargetWords(clamped);
    localStorage.setItem(`novel-creator:target-words:${section.id}`, String(clamped));
  };

  const [selectedModelConfigId, setSelectedModelConfigId] = useState<string | null>(() => {
    return localStorage.getItem('novel-creator:editor-model') || null;
  });

  const handleModelChange = (id: string | null) => {
    setSelectedModelConfigId(id);
    if (id) {
      localStorage.setItem('novel-creator:editor-model', id);
    } else {
      localStorage.removeItem('novel-creator:editor-model');
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
      selectedModelConfigId,
    );
    await updateContent(accumulated);
    setSavedBody(accumulated);
  }

  async function handleExtract() {
    if (!localBody.trim()) return;
    const result = await extract(section.id);
    setExtracted(result);
    setExtractResultOpen(true);
  }

  const proofreadAbortControllerRef = useRef<AbortController | null>(null);

  // 校正モーダル
  const handleOpenProofread = async () => {
    if (!localBody.trim()) {
      toast.error('校正する本文がありません');
      return;
    }
    setProofreadOpen(true);
    setProofreading(true);
    const controller = new AbortController();
    proofreadAbortControllerRef.current = controller;
    try {
      const res = await proofreadSectionContent(
        section.id,
        localBody,
        selectedModelConfigId,
        controller.signal,
      );
      setProofreadResult(res);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      toast.error(toErrorMessage(e));
      setProofreadOpen(false);
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
    setProofreadOpen(false);
  };

  // 口調チェッカーモーダル
  const handleOpenVoiceChecker = async () => {
    if (!localBody.trim()) {
      toast.error('チェックする本文がありません');
      return;
    }
    setVoiceCheckerOpen(true);
    setVoiceResult(null);
    setVoiceError(null);
    setVoiceHistoryView(false);
    setVoiceViewedAt(null);
    try {
      const res = await runVoiceCheck(novelId, {
        body: localBody,
        modelConfigId: selectedModelConfigId,
      });
      setVoiceResult(res);
      setVoiceHistoryKey((k) => k + 1);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setVoiceError(toErrorMessage(e));
    }
  };

  // 模擬読者レビューモーダル
  const handleOpenPersonaReview = async () => {
    if (!localBody.trim()) {
      toast.error('レビュー対象の本文がありません');
      return;
    }
    setPersonaReviewOpen(true);
    setPersonaResult(null);
    setPersonaError(null);
    setPersonaHistoryView(false);
    setPersonaViewedAt(null);
    try {
      const res = await runPersonaReview(novelId, {
        sectionId: section.id,
        body: localBody,
        modelConfigId: selectedModelConfigId,
      });
      setPersonaResult(res);
      setPersonaHistoryKey((k) => k + 1);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setPersonaError(toErrorMessage(e));
    }
  };

  // 履歴から結果を読み込む
  const handleSelectVoiceHistory = (entry: AnalysisHistoryEntry) => {
    if (entry.analysisType !== 'check-voice') return;
    setVoiceResult(entry.result as CharacterVoiceCheckResult);
    setVoiceError(null);
    setVoiceHistoryView(true);
    setVoiceViewedAt(entry.createdAt);
  };
  const handleSelectPersonaHistory = (entry: AnalysisHistoryEntry) => {
    if (entry.analysisType !== 'persona-review') return;
    setPersonaResult(entry.result as MultiPersonaReviewResult);
    setPersonaError(null);
    setPersonaHistoryView(true);
    setPersonaViewedAt(entry.createdAt);
  };

  const { openChat } = useChat();

  // チャット相談起動
  const handleOpenChat = useCallback(
    (useSelected = false) => {
      if (useSelected && selectedText.trim()) {
        openChat(novelId, {
          entityType: 'selection',
          title: `第${section.order}節「${section.title || '（無題）'}」（選択テキスト）`,
          selectedText: selectedText.trim(),
        });
        return;
      }

      openChat(novelId, {
        entityType: 'section',
        title: `第${section.order}節「${section.title || '（無題）'}」`,
        summary: localBody.slice(0, 800) + (localBody.length > 800 ? '…' : ''),
      });
    },
    [localBody, novelId, openChat, section.order, section.title, selectedText],
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
  ) => {
    if (!selectedText) return;
    setInlineGeneratedText('');
    let acc = '';
    try {
      await inlineAssist(
        section.id,
        {
          selectedText,
          action,
          customInstruction,
          modelConfigId: selectedModelConfigId,
        },
        (chunk) => {
          acc += chunk;
          setInlineGeneratedText(acc);
        },
      );
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  };

  // インラインAI置換
  const handleApplyInlineReplace = (generated: string) => {
    if (!selectedText || !generated) return;
    const newBody = localBody.replace(selectedText, generated);
    setLocalBody(newBody);
    setIsInlineActive(false);
    setSelectedText('');
    setInlineGeneratedText('');
    toast.success('選択範囲を書き換えました');
  };

  // インラインAI挿入
  const handleApplyInlineInsertAfter = (generated: string) => {
    if (!selectedText || !generated) return;
    const idx = localBody.indexOf(selectedText);
    if (idx !== -1) {
      const insertPos = idx + selectedText.length;
      const newBody = localBody.slice(0, insertPos) + '\n' + generated + localBody.slice(insertPos);
      setLocalBody(newBody);
      setIsInlineActive(false);
      setSelectedText('');
      setInlineGeneratedText('');
      toast.success('直後にテキストを挿入しました');
    }
  };

  // 口調修正反映
  const handleApplyVoiceFix = (orig: string, sugg: string) => {
    if (localBody.includes(orig)) {
      const updated = localBody.replace(orig, sugg);
      setLocalBody(updated);
      toast.success('セリフを修正しました');
    } else {
      toast.error('本文中に該当箇所が見つかりませんでした');
    }
  };

  // 進捗率
  const progressPercent = Math.min(100, Math.round((wordCount / targetWords) * 100));

  return (
    <div className="flex h-full w-full flex-col min-h-0 overflow-hidden">
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
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenVerticalPreview={() => setVerticalPreviewOpen(true)}
        onOpenVoiceChecker={() => void handleOpenVoiceChecker()}
        onOpenPersonaReview={() => void handleOpenPersonaReview()}
        onOpenProofread={() => void handleOpenProofread()}
        onOpenChat={() => handleOpenChat(false)}
        onOpenStyleGuide={() => setStyleGuideOpen(true)}
        onSave={() => void handleSave()}
      />

      {/* 目標達成度プログレスバー */}
      <div className="h-1 w-full bg-border shrink-0">
        <div
          className={`h-full transition-all duration-300 ${
            progressPercent >= 100 ? 'bg-emerald-500' : 'bg-primary'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {extracting && (
        <div className="px-4 py-2 border-b border-border bg-surface shrink-0">
          <AIProgressIndicator
            variant="inline"
            stage="AIが本文から設定・時系列を自動抽出中..."
            startedAt={generateStartedAt ?? Date.now()}
            onCancel={cancelGeneration}
            cancelLabel="抽出を中止"
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        {loading ? (
          <Loading message="本文を読み込み中..." />
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <MonacoEditor
              value={localBody}
              onChange={setLocalBody}
              onSelectionChange={handleSelectionChange}
            />

            {/* 選択テキストがある場合のインラインAI・チャット相談トリガーバー */}
            {selectedText && !isInlineActive && (
              <div className="absolute top-4 right-8 z-30 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  type="button"
                  onClick={() => setIsInlineActive(true)}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-lg hover:brightness-110 transition cursor-pointer border border-primary/20"
                >
                  <span>✨ 選択範囲をAI推敲 ({selectedText.length}文字)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenChat(true)}
                  className="flex items-center gap-1.5 rounded-full bg-surface-raised border border-border px-3.5 py-1.5 text-xs font-bold text-foreground shadow-lg hover:bg-surface-hover hover:border-primary/50 transition cursor-pointer"
                >
                  <span>💬 チャットで相談</span>
                </button>
              </div>
            )}

            {/* インラインAIアシスタントパネル */}
            {isInlineActive && (
              <div className="absolute top-4 right-8 z-40 w-96 max-w-[calc(100%-4rem)]">
                <InlineAIAssistant
                  selectedText={selectedText}
                  onApplyReplace={handleApplyInlineReplace}
                  onApplyInsertAfter={handleApplyInlineInsertAfter}
                  onCancel={() => {
                    if (inlineAssisting) {
                      cancelGeneration();
                    }
                    setIsInlineActive(false);
                    setInlineGeneratedText('');
                  }}
                  onExecuteAssist={handleExecuteInlineAssist}
                  isLoading={inlineAssisting}
                  startedAt={inlineAssisting ? generateStartedAt : null}
                  generatedText={inlineGeneratedText}
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
        isOpen={extractResultOpen}
        onClose={() => setExtractResultOpen(false)}
        result={extracted}
      />
      <HistoryDiffModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        novelId={novelId}
        entityType="content"
        entityId={section.id}
        currentContent={localBody}
        title={`${section.title || `節 ${section.order}`} の本文`}
        onRestoreSuccess={(restored) => {
          setLocalBody(restored);
          setSavedBody(restored);
          toast.success('過去のバージョンから本文を復元しました');
          void onRefresh();
        }}
      />
      <VerticalPreviewModal
        isOpen={verticalPreviewOpen}
        onClose={() => setVerticalPreviewOpen(false)}
        title={section.title || `節 ${section.order}`}
        body={localBody}
      />
      <ProofreadModal
        isOpen={proofreadOpen}
        onClose={() => setProofreadOpen(false)}
        result={proofreadResult}
        isLoading={proofreading}
        onCancel={handleCancelProofread}
        onApplyPolishedBody={(polished) => {
          setLocalBody(polished);
          toast.success('推敲後の文章を本文に反映しました');
        }}
      />
      <CharacterVoiceCheckerModal
        isOpen={voiceCheckerOpen}
        onClose={() => setVoiceCheckerOpen(false)}
        result={voiceResult}
        progress={progress}
        running={running === 'check-voice'}
        error={voiceError}
        isHistoryView={voiceHistoryView}
        viewedAt={voiceViewedAt}
        novelId={novelId}
        historyRefreshKey={voiceHistoryKey}
        onSelectHistory={handleSelectVoiceHistory}
        onRerun={() => void handleOpenVoiceChecker()}
        onCancel={cancelAnalysis}
        onApplyFix={handleApplyVoiceFix}
      />
      <MultiPersonaReviewModal
        isOpen={personaReviewOpen}
        onClose={() => setPersonaReviewOpen(false)}
        result={personaResult}
        progress={progress}
        running={running === 'persona-review'}
        error={personaError}
        isHistoryView={personaHistoryView}
        viewedAt={personaViewedAt}
        novelId={novelId}
        historyRefreshKey={personaHistoryKey}
        onSelectHistory={handleSelectPersonaHistory}
        onRerun={() => void handleOpenPersonaReview()}
        onCancel={cancelAnalysis}
      />
      <StyleGuideModal
        isOpen={styleGuideOpen}
        onClose={() => setStyleGuideOpen(false)}
        novelId={novelId}
        initialStyleGuide={novel?.styleGuide}
        onSave={handleSaveStyleGuide}
        saving={updatingNovel}
      />
    </div>
  );
}
