import { useEffect, useState } from 'react';
import { Button } from '@/components/Button.js';
import { Loading } from '@/components/Loading.js';
import { Modal } from '@/components/Modal.js';
import { useChapters } from '@/hooks/useChapters.js';
import { useContent } from '@/hooks/useContent.js';
import { useGenerate } from '@/hooks/useGenerate.js';
import { useNovel } from '@/hooks/useNovel.js';
import { countWords } from '@/lib/sse.js';
import type { ExtractResult, Section, Setting, Timeline } from '@/lib/types.js';
import { SparklesIcon } from './-Icons.js';
import { MonacoEditor } from './-MonacoEditor.js';

export function EditorTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const { chapters } = useChapters(novel.id);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const selectedSection = selectedChapter?.sections.find((s) => s.id === selectedSectionId);

  useEffect(() => {
    if (chapters.length > 0 && !selectedChapterId) {
      setSelectedChapterId(chapters[0].id);
      setSelectedSectionId(chapters[0].sections[0]?.id ?? null);
    }
  }, [chapters, selectedChapterId]);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      <div className="w-64 shrink-0 overflow-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          章 / 節
        </h3>
        {chapters.length === 0 && (
          <p className="px-2 text-sm text-slate-400 dark:text-slate-500">章がありません。</p>
        )}
        {chapters.map((chapter) => (
          <div key={chapter.id} className="mb-2">
            <div className="px-2 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {chapter.title}
            </div>
            {chapter.sections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setSelectedChapterId(chapter.id);
                  setSelectedSectionId(section.id);
                  setEditorKey((k) => k + 1);
                }}
                className={`block w-full rounded px-2 py-1 text-left text-sm transition ${
                  selectedSectionId === section.id
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {section.title || `節 ${section.order}`}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {selectedSection ? (
          <SectionEditor key={editorKey} section={selectedSection} onRefresh={onRefresh} />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-500">
            節を選択してください
          </div>
        )}
      </div>
    </div>
  );
}

function SectionEditor({
  section,
  onRefresh,
}: {
  section: Section;
  onRefresh: () => Promise<void>;
}) {
  const { content, loading, saving, updateContent } = useContent(section.id);
  const { generateContent, generatingContent, extract, extracting, streamError, resetStreamError } =
    useGenerate();
  const [localBody, setLocalBody] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [extractResultOpen, setExtractResultOpen] = useState(false);
  const [extracted, setExtracted] = useState<ExtractResult | null>(null);

  useEffect(() => {
    if (content) {
      setLocalBody(content.body);
      setWordCount(content.wordCount ?? countWords(content.body));
    }
  }, [content]);

  useEffect(() => {
    setWordCount(countWords(localBody));
  }, [localBody]);

  async function handleSave() {
    await updateContent(localBody);
    await onRefresh();
  }

  async function handleGenerate() {
    resetStreamError();
    let accumulated = localBody;
    await generateContent(section.id, (chunk) => {
      accumulated += chunk;
      setLocalBody(accumulated);
    });
    await updateContent(accumulated);
  }

  async function handleExtract() {
    if (!localBody.trim()) return;
    const result = await extract(section.id);
    setExtracted(result);
    setExtractResultOpen(true);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            {section.title || `節 ${section.order}`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            文字数: {wordCount.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExtract}
            isLoading={extracting}
            disabled={!localBody.trim()}
          >
            整合性更新
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGenerate}
            isLoading={generatingContent}
            leftIcon={<SparklesIcon />}
          >
            本文生成
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={saving}>
            保存
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <Loading message="本文を読み込み中..." />
        ) : (
          <MonacoEditor value={localBody} onChange={setLocalBody} />
        )}
      </div>
      {generatingContent && (
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-2 text-xs text-indigo-600 dark:border-slate-700 dark:text-indigo-300">
          <span className="h-3 w-3 animate-pulse rounded-full bg-indigo-500" />
          本文を生成中…
        </div>
      )}
      {streamError && (
        <div className="border-t border-rose-100 bg-rose-50 px-5 py-2 text-xs text-rose-600 dark:border-rose-900/30 dark:bg-rose-900/20">
          {streamError}
        </div>
      )}
      <ExtractResultModal
        isOpen={extractResultOpen}
        onClose={() => setExtractResultOpen(false)}
        result={extracted}
      />
    </div>
  );
}

function ExtractResultModal({
  isOpen,
  onClose,
  result,
}: {
  isOpen: boolean;
  onClose: () => void;
  result: ExtractResult | null;
}) {
  if (!result) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="整合性更新結果"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            抽出された時系列
          </h4>
          {result.timelines.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">ありません</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {result.timelines.map((timeline: Timeline) => (
                <li
                  key={timeline.id}
                  className="rounded bg-slate-50 px-3 py-2 dark:bg-slate-700/50"
                >
                  {timeline.timestamp && (
                    <span className="mr-2 text-xs text-slate-500 dark:text-slate-400">
                      {timeline.timestamp}
                    </span>
                  )}
                  {timeline.event}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            抽出された設定
          </h4>
          {result.settings.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">ありません</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {result.settings.map((setting: Setting) => (
                <li key={setting.id} className="rounded bg-slate-50 px-3 py-2 dark:bg-slate-700/50">
                  <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400">
                    {setting.category}
                  </span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {setting.name}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {setting.description}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
