import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { EmptyState } from "@/components/EmptyState.js";
import { Input } from "@/components/Input.js";
import { Loading } from "@/components/Loading.js";
import { Modal } from "@/components/Modal.js";
import { Select } from "@/components/Select.js";
import { Textarea } from "@/components/Textarea.js";
import { ViewModeSwitch } from "@/components/ViewModeSwitch.js";
import { useNovel } from "@/hooks/useNovel.js";
import { useTimelines } from "@/hooks/useTimelines.js";
import type { Chapter, Section, Timeline } from "@/lib/types.js";
import { IconButton, PencilIcon, PlusIcon, TrashIcon } from "./-Icons.js";
import { TimelinesMarkdownEditor } from "./-TimelinesMarkdownEditor.js";

export function TimelineTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
  onRefresh: () => Promise<void>;
}) {
  const {
    timelines,
    loading,
    createTimeline,
    updateTimeline,
    deleteTimeline,
    fetchTimelinesMarkdown,
    saveTimelinesMarkdown,
    savingMarkdown,
    creating,
    updating,
    deleting,
  } = useTimelines(novel.id);

  const [viewMode, setViewMode] = useState<"cards" | "markdown">("cards");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState<Timeline | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const chaptersWithSections = useMemo(
    () => (novel.chapters as Array<Chapter & { sections?: Section[] }>) ?? [],
    [novel]
  );

  const allSections = useMemo(
    () => chaptersWithSections.flatMap((c) => c.sections ?? []),
    [chaptersWithSections]
  );

  // 節IDから表示用テキスト（章タイトル > 節タイトル）を取得するマップ
  const sectionTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const chapter of chaptersWithSections) {
      for (const section of chapter.sections ?? []) {
        map.set(
          section.id,
          `${chapter.title} > ${section.title || `節 ${section.order}`}`
        );
      }
    }
    return map;
  }, [chaptersWithSections]);

  function handleOpenCreate() {
    setEditingTimeline(null);
    setIsFormOpen(true);
  }

  function handleOpenEdit(timeline: Timeline) {
    setEditingTimeline(timeline);
    setIsFormOpen(true);
  }

  async function handleFormSubmit(input: {
    event: string;
    order: number;
    timestamp: string;
    sectionId?: string;
  }) {
    if (editingTimeline) {
      await updateTimeline(editingTimeline.id, {
        event: input.event,
        order: input.order,
        timestamp: input.timestamp || null,
        sectionId: input.sectionId || null,
      });
    } else {
      await createTimeline(input);
    }
    setIsFormOpen(false);
    setEditingTimeline(null);
    await onRefresh();
  }

  async function handleDelete() {
    if (!deletingId) {
      return;
    }
    await deleteTimeline(deletingId);
    setDeletingId(null);
    await onRefresh();
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-border border-b pb-3">
        <h2 className="font-bold text-foreground text-xl">タイムライン</h2>
        <div className="flex flex-wrap items-center gap-3">
          {viewMode === "cards" && (
            <Button
              onClick={handleOpenCreate}
              leftIcon={<PlusIcon />}
              className="shrink-0 whitespace-nowrap"
            >
              イベント追加
            </Button>
          )}
          <ViewModeSwitch
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: "一覧", value: "cards" },
              { label: "マークダウン", value: "markdown" },
            ]}
          />
        </div>
      </div>

      {viewMode === "markdown" ? (
        <div className="min-h-0 flex-1">
          <TimelinesMarkdownEditor
            novelId={novel.id}
            fetchTimelinesMarkdown={fetchTimelinesMarkdown}
            saveTimelinesMarkdown={saveTimelinesMarkdown}
            savingMarkdown={savingMarkdown}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          {loading && <Loading message="タイムラインを読み込み中..." />}

          {!loading && timelines.length === 0 && (
            <EmptyState
              title="イベントがありません"
              description="物語の流れを時系列で整理しましょう。"
            />
          )}

          {!loading && timelines.length > 0 && (
            <div className="relative space-y-0 pl-4">
              <div className="absolute top-0 bottom-0 left-7 w-px bg-border" />
              {timelines.map((timeline) => {
                const sectionLabel = timeline.sectionId
                  ? sectionTitleMap.get(timeline.sectionId)
                  : null;
                return (
                  <div
                    key={timeline.id}
                    className="relative flex items-start gap-4 py-3"
                  >
                    <div className="z-10 mt-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-surface" />
                    <div className="flex-1 rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-border-hover">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-primary text-xs">
                              {timeline.timestamp || `順序 ${timeline.order}`}
                            </span>
                            {sectionLabel && (
                              <span className="inline-flex items-center rounded-md border border-border bg-surface-raised px-2 py-0.5 text-muted-foreground text-xs">
                                📖 {sectionLabel}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 whitespace-pre-wrap font-medium text-foreground text-sm leading-relaxed">
                            {timeline.event}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton
                            label="編集"
                            onClick={() => handleOpenEdit(timeline)}
                            icon={<PencilIcon />}
                          />
                          <IconButton
                            label="削除"
                            onClick={() => setDeletingId(timeline.id)}
                            icon={<TrashIcon />}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <TimelineFormModal
            isOpen={isFormOpen}
            defaultValues={editingTimeline}
            onClose={() => {
              setIsFormOpen(false);
              setEditingTimeline(null);
            }}
            onSubmit={handleFormSubmit}
            isLoading={creating || updating}
            chapters={chaptersWithSections}
            novelSections={allSections}
          />

          <ConfirmDialog
            isOpen={!!deletingId}
            onClose={() => setDeletingId(null)}
            onConfirm={handleDelete}
            title="イベントを削除しますか？"
            message="この操作は元に戻せません。"
            confirmLabel="削除"
            isLoading={deleting}
          />
        </div>
      )}
    </div>
  );
}

function TimelineFormModal({
  isOpen,
  defaultValues,
  onClose,
  onSubmit,
  isLoading,
  chapters,
  novelSections,
}: {
  isOpen: boolean;
  defaultValues?: Timeline | null;
  onClose: () => void;
  onSubmit: (input: {
    event: string;
    order: number;
    timestamp: string;
    sectionId?: string;
  }) => Promise<void>;
  isLoading: boolean;
  chapters?: Array<Chapter & { sections?: Section[] }>;
  novelSections: Section[];
}) {
  const isEdit = !!defaultValues;
  const [event, setEvent] = useState("");
  const [order, setOrder] = useState(1);
  const [timestamp, setTimestamp] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (defaultValues) {
        setEvent(defaultValues.event);
        setOrder(defaultValues.order);
        setTimestamp(defaultValues.timestamp ?? "");
        setSectionId(defaultValues.sectionId ?? "");
      } else {
        setEvent("");
        setOrder(1);
        setTimestamp("");
        setSectionId("");
      }
      setError(null);
    }
  }, [isOpen, defaultValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!event.trim()) {
      setError("イベント内容を入力してください");
      return;
    }
    await onSubmit({
      event: event.trim(),
      order,
      timestamp: timestamp.trim(),
      sectionId: sectionId || undefined,
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "イベントを編集" : "イベントを追加"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>
            {isEdit ? "更新" : "追加"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          label="イベント内容"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          rows={3}
          placeholder="例: 王都の市場で黒ずくめの男と接触する。"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="順序"
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
          />
          <Input
            label="タイムスタンプ"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            placeholder="例: 第一章冒頭, 3日目の朝..."
          />
        </div>
        {novelSections.length > 0 && (
          <div>
            <label className="mb-1.5 block font-medium text-foreground-secondary text-sm">
              紐づける節 (任意)
            </label>
            <Select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">なし</option>
              {chapters && chapters.length > 0
                ? chapters.map((ch) => (
                    <optgroup key={ch.id} label={ch.title}>
                      {(ch.sections ?? []).map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.title || `節 ${sec.order}`}
                        </option>
                      ))}
                    </optgroup>
                  ))
                : novelSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title || `節 ${s.order}`}
                    </option>
                  ))}
            </Select>
          </div>
        )}
        {error && <p className="text-rose-500 text-sm">{error}</p>}
      </form>
    </Modal>
  );
}
