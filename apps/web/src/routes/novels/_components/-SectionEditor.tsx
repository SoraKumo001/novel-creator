import { useCallback, useEffect, useState } from 'react';
import { Loading } from '@/components/Loading.js';
import { HistoryDiffModal } from '@/components/HistoryDiffModal.js';
import { useContent } from '@/hooks/useContent.js';
import { useGenerate } from '@/hooks/useGenerate.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import { countWords } from '@/lib/sse.js';
import type { ExtractResult, Section } from '@/lib/types.js';
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
  const { generateContent, generatingContent, extract, extracting, streamError, resetStreamError } =
    useGenerate();
  const [localBody, setLocalBody] = useState('');
  const [savedBody, setSavedBody] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [targetWords, setTargetWords] = useState(() => {
    const saved = localStorage.getItem(`novel-creator:target-words:${section.id}`);
    return saved ? parseInt(saved, 10) : 2000;
  });
  const [extractResultOpen, setExtractResultOpen] = useState(false);
  const [extracted, setExtracted] = useState<ExtractResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
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

  async function handleGenerate() {
    resetStreamError();
    let accumulated = localBody;
    await generateContent(section.id, (chunk) => {
      accumulated += chunk;
      setLocalBody(accumulated);
    });
    await updateContent(accumulated);
    setSavedBody(accumulated);
  }

  async function handleExtract() {
    if (!localBody.trim()) return;
    const result = await extract(section.id);
    setExtracted(result);
    setExtractResultOpen(true);
  }

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
        isZenMode={isZenMode}
        onToggleZenMode={onToggleZenMode}
        onOpenHistory={() => setHistoryOpen(true)}
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

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {loading ? (
          <Loading message="本文を読み込み中..." />
        ) : (
          <MonacoEditor value={localBody} onChange={setLocalBody} />
        )}
      </div>

      <GenerateContentPanel generatingContent={generatingContent} streamError={streamError} />

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
    </div>
  );
}
