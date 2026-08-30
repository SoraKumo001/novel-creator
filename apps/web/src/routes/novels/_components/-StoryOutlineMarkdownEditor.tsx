import { useCallback, useState } from 'react';
import {
  buildStoryOutlineCategoryTree,
  findStoryOutlineSectionByLine,
  scanStoryOutlineSectionRanges,
  STORY_OUTLINE_TEMPLATES,
  type StoryOutlineSectionRange,
} from '@novel-creator/shared';
import { Button } from '@/components/Button.js';
import { Modal } from '@/components/Modal.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import {
  editStoryOutlineDocument,
  editStoryOutlineSection,
  fetchStoryOutline,
  generatePlotFromStoryOutline,
  saveStoryOutline,
} from '@/lib/services/index.js';
import { EntityMarkdownEditor } from './-EntityMarkdownEditor.js';
import { PlotPreviewPanel } from './-PlotPreviewPanel.js';
import { useChapters } from '@/hooks/useChapters.js';

interface StoryOutlineMarkdownEditorProps {
  novelId: string;
  onRefresh?: () => Promise<void>;
}

export function StoryOutlineMarkdownEditor({
  novelId,
  onRefresh,
}: StoryOutlineMarkdownEditorProps) {
  const [savingMarkdown, setSavingMarkdown] = useState(false);
  const [editingSectionState, setEditingSectionState] = useState(false);
  const [editingDocumentState, setEditingDocumentState] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [generatingPlot, setGeneratingPlot] = useState(false);
  const [plotPreview, setPlotPreview] = useState<{
    title: string;
    description: string;
    chapters: { title: string; order: number; summary: string }[];
  } | null>(null);
  const [selectedPlotIndices, setSelectedPlotIndices] = useState<Set<number>>(new Set());

  const toast = useToast();
  const { createChapter } = useChapters(novelId);

  const handleFetchMarkdown = useCallback(async () => {
    const markdown = await fetchStoryOutline(novelId);
    if (!markdown || markdown.trim() === '') {
      // 初期値が空の場合は標準の起承転結テンプレートをデフォルト提示
      return STORY_OUTLINE_TEMPLATES[0].template;
    }
    return markdown;
  }, [novelId]);

  const handleSaveMarkdown = useCallback(
    async (markdown: string) => {
      setSavingMarkdown(true);
      try {
        await saveStoryOutline(novelId, markdown);
        toast.success('ストーリー構想を保存しました');
        if (onRefresh) {
          await onRefresh();
        }
        return { updated: 1 };
      } finally {
        setSavingMarkdown(false);
      }
    },
    [novelId, onRefresh, toast],
  );

  const handleEditSection = useCallback(
    async ({
      activeSection,
      instruction,
      markdown,
    }: {
      activeSection: StoryOutlineSectionRange;
      instruction: string;
      markdown: string;
    }) => {
      setEditingSectionState(true);
      try {
        const sections = scanStoryOutlineSectionRanges(markdown);
        const target = sections.find(
          (s) => s.category === activeSection.category && s.name === activeSection.name,
        );

        if (!target) {
          throw new Error(`セクション「${activeSection.name}」が見つかりません`);
        }

        const nextContent = await editStoryOutlineSection(novelId, {
          activeSection: {
            category: target.category,
            name: target.name,
            content: target.content,
          },
          instruction,
          markdown,
        });

        const lines = markdown.split('\n');
        const before = lines.slice(0, target.startLine);
        const after = lines.slice(target.endLine + 1);
        return [...before, nextContent.trim(), ...after].join('\n');
      } finally {
        setEditingSectionState(false);
      }
    },
    [novelId],
  );

  const handleEditDocument = useCallback(
    async ({ markdown, instruction }: { markdown: string; instruction: string }) => {
      setEditingDocumentState(true);
      try {
        return await editStoryOutlineDocument(novelId, { markdown, instruction });
      } finally {
        setEditingDocumentState(false);
      }
    },
    [novelId],
  );

  const handleGeneratePlot = async (currentMarkdown: string) => {
    if (!currentMarkdown || currentMarkdown.trim().length < 20) {
      toast.error('プロットを生成するには、ストーリー構想に十分なあらすじや展開を記入してください');
      return;
    }
    setGeneratingPlot(true);
    try {
      const result = await generatePlotFromStoryOutline(novelId, {
        storyOutline: currentMarkdown,
      });
      setPlotPreview(result);
      setSelectedPlotIndices(new Set(result.chapters.map((_, i) => i)));
    } catch (err) {
      const msg = toErrorMessage(err);
      toast.error(msg);
    } finally {
      setGeneratingPlot(false);
    }
  };

  const handleApplyPlot = async () => {
    if (!plotPreview) return;
    const selectedChapters = plotPreview.chapters.filter((_, i) => selectedPlotIndices.has(i));
    for (const ch of selectedChapters) {
      await createChapter({ title: ch.title, order: ch.order, summary: ch.summary });
    }
    setPlotPreview(null);
    setSelectedPlotIndices(new Set());
    toast.success(`${selectedChapters.length} 件の章プロットを反映しました`);
    if (onRefresh) {
      await onRefresh();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <EntityMarkdownEditor<StoryOutlineSectionRange>
        novelId={novelId}
        entityTitle="ストーリー構想・あらすじ"
        entityType="story_outline_markdown"
        storageKey={`novel-creator:draft:story_outline:${novelId}`}
        fetchMarkdown={handleFetchMarkdown}
        saveMarkdown={handleSaveMarkdown}
        buildTree={buildStoryOutlineCategoryTree}
        findSectionAtLine={findStoryOutlineSectionByLine}
        onEditSection={handleEditSection}
        onEditDocument={handleEditDocument}
        savingMarkdown={savingMarkdown}
        editingSection={editingSectionState}
        editingDocument={editingDocumentState}
        sectionPlaceholder={(active: StoryOutlineSectionRange | null) =>
          active
            ? `「${active.name}」への指示（例: 結末をビターエンドに / 中盤の事件案を3つ提案して）`
            : 'カーソルを見出しやセクション内に置いてください'
        }
        documentPlaceholder="ストーリー構想全体への指示（例: 全体を三幕構成に再編して / ログラインをキャッチーに推敲して）"
        extraToolbarActions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setTemplateModalOpen(true)}
              title="構想テンプレート（起承転結・三幕構成・Web連載など）を挿入"
            >
              📋 テンプレート
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const current = await fetchStoryOutline(novelId).catch(() => '');
                await handleGeneratePlot(current);
              }}
              isLoading={generatingPlot}
              title="詰めたストーリー構想から全章・節のプロット（章タイトル＋概要）を自動設計"
            >
              🗺️ 章立て（プロット）に展開
            </Button>
          </>
        }
      />

      {/* テンプレート選択モーダル */}
      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="ストーリー構想テンプレートを選択"
        size="lg"
      >
        <div className="space-y-4 text-xs">
          <p className="text-muted-foreground">
            テンプレートを選択すると、現在の構想の末尾に追加または新しい雛形として活用できます。
          </p>
          <div className="grid gap-3">
            {STORY_OUTLINE_TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                className="rounded-xl border border-border p-4 hover:border-primary hover:bg-primary/5 transition flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-sm text-foreground">{tmpl.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{tmpl.description}</div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const current = await fetchStoryOutline(novelId).catch(() => '');
                      const newContent = current.trim()
                        ? `${current.trim()}\n\n${tmpl.template}`
                        : tmpl.template;
                      await saveStoryOutline(novelId, newContent);
                      setTemplateModalOpen(false);
                      toast.success(`「${tmpl.name}」を末尾に挿入しました`);
                      if (onRefresh) await onRefresh();
                    }}
                  >
                    末尾に追記挿入
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={async () => {
                      await saveStoryOutline(novelId, tmpl.template);
                      setTemplateModalOpen(false);
                      toast.success(`「${tmpl.name}」を上書き適用しました`);
                      if (onRefresh) await onRefresh();
                    }}
                  >
                    このテンプレートで置き換え
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* プロット展開プレビューモーダル */}
      {plotPreview && (
        <Modal
          isOpen={!!plotPreview}
          onClose={() => setPlotPreview(null)}
          title="ストーリー構想から章立て（プロット）を設計しました"
          size="xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                選択中: {selectedPlotIndices.size} / {plotPreview.chapters.length} 章
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPlotPreview(null)}>
                  キャンセル
                </Button>
                <Button variant="primary" onClick={handleApplyPlot}>
                  選択した章を小説に反映
                </Button>
              </div>
            </div>
          }
        >
          <PlotPreviewPanel
            plotPreview={plotPreview}
            selectedPlotIndices={selectedPlotIndices}
            onToggleAll={(checked) => {
              if (checked) {
                setSelectedPlotIndices(new Set(plotPreview.chapters.map((_, i) => i)));
              } else {
                setSelectedPlotIndices(new Set());
              }
            }}
            onToggleIndex={(idx) => {
              setSelectedPlotIndices((prev) => {
                const next = new Set(prev);
                if (next.has(idx)) next.delete(idx);
                else next.add(idx);
                return next;
              });
            }}
            onDiscard={() => setPlotPreview(null)}
            onApply={handleApplyPlot}
          />
        </Modal>
      )}
    </div>
  );
}
