import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/Input.js";
import { Select } from "@/components/Select.js";
import { useChatUI } from "@/context/ChatContext.js";
import { useChapters } from "@/hooks/useChapters.js";
import { useForeshadowings } from "@/hooks/useForeshadowings.js";
import { useLlmInstructions } from "@/hooks/useLlmInstructions.js";
import { useModalState } from "@/hooks/useModalResultState.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import type { ForeshadowingStatus } from "@/lib/types.js";
import { EntityEditorShell } from "./-EntityEditorShell.js";
import { MonacoEditor } from "./-MonacoEditor.js";

interface ForeshadowingEditorProps {
  foreshadowingId?: string;
  novelId: string;
}

export function ForeshadowingEditor({
  novelId,
  foreshadowingId,
}: ForeshadowingEditorProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { openChat } = useChatUI();
  const { chapters } = useChapters(novelId);
  const {
    foreshadowings,
    loading: foreshadowingsLoading,
    error: queryError,
    createForeshadowing,
    updateForeshadowing,
    generateDraft,
    creating,
    updating,
    generatingDraft,
  } = useForeshadowings(novelId);
  const {
    instructions,
    saveInstruction,
    deleteInstruction,
    deleting: deletingInstruction,
  } = useLlmInstructions(novelId, "foreshadowing");

  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ForeshadowingStatus>("unresolved");
  const [placedSectionId, setPlacedSectionId] = useState<string>("");
  const [resolvedSectionId, setResolvedSectionId] = useState<string>("");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  // 履歴削除確認ダイアログ（payload = 削除対象の指示ID）と履歴差分モーダル
  const deleteConfirm = useModalState<string>();
  const historyModal = useModalState();

  const isEdit = !!foreshadowingId;
  const loading = isEdit ? foreshadowingsLoading : false;

  const targetForeshadowing = useMemo(
    () => foreshadowings?.find((f) => f.id === foreshadowingId),
    [foreshadowings, foreshadowingId]
  );

  // 既存のカテゴリ一覧（サジェスト用）
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const f of foreshadowings ?? []) {
      if (f.category?.trim()) {
        set.add(f.category.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
  }, [foreshadowings]);

  const populatedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!targetForeshadowing) {
      return;
    }
    if (populatedIdRef.current === targetForeshadowing.id) {
      return;
    }
    populatedIdRef.current = targetForeshadowing.id;
    setCategory(targetForeshadowing.category ?? "未分類");
    setTitle(targetForeshadowing.title);
    setDescription(targetForeshadowing.description ?? "");
    setStatus(targetForeshadowing.status ?? "unresolved");
    setPlacedSectionId(targetForeshadowing.placedSectionId ?? "");
    setResolvedSectionId(targetForeshadowing.resolvedSectionId ?? "");
  }, [targetForeshadowing]);

  useEffect(() => {
    if (isEdit) {
      setError(queryError);
    }
  }, [isEdit, queryError]);

  async function handleGenerate() {
    if (!instruction.trim()) {
      return;
    }
    setError(null);
    try {
      const currentDraft =
        category || title || description
          ? { category, title, description, status }
          : undefined;
      const result = await generateDraft(instruction.trim(), currentDraft);
      setCategory(result.category);
      setTitle(result.title);
      setDescription(result.description);
      if (result.status) {
        setStatus(result.status);
      }
      await saveInstruction({
        entityType: "foreshadowing",
        instruction: instruction.trim(),
      });
      toast.success("伏線案を生成しました");
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  }

  async function handleSave() {
    setError(null);
    if (!title.trim() || !category.trim()) {
      toast.error("カテゴリーとタイトルは必須です");
      return;
    }
    try {
      const input = {
        category: category.trim(),
        title: title.trim(),
        description: description.trim(),
        status,
        placedSectionId: placedSectionId || null,
        resolvedSectionId: resolvedSectionId || null,
      };
      if (isEdit && foreshadowingId) {
        await updateForeshadowing(foreshadowingId, input);
      } else {
        const created = await createForeshadowing(input);
        navigate({
          to: "/novels/$novelId/foreshadowings/$foreshadowingId",
          params: { novelId, foreshadowingId: created.id },
          replace: true,
        });
      }
      toast.success(isEdit ? "伏線を更新しました" : "伏線を作成しました");
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  }

  // Ctrl+S / Cmd+S ショートカットで保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (category.trim() && title.trim() && !creating && !updating) {
          void handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [category, creating, title, updating, handleSave]);

  async function handleDeleteInstruction() {
    const targetId = deleteConfirm.payload;
    if (!targetId) {
      return;
    }
    await deleteInstruction(targetId);
    deleteConfirm.close();
  }

  function handleChatConsult() {
    const summaryParts = [
      category.trim() && `カテゴリー: ${category.trim()}`,
      `ステータス: ${status === "unresolved" ? "未回収" : status === "resolved" ? "回収済" : "保留・破棄"}`,
      description.trim() &&
        `詳細メモ: ${description.trim().slice(0, 500)}${description.trim().length > 500 ? "…" : ""}`,
      isEdit && "※エディタ上の未保存の内容を含みます",
    ].filter(Boolean);
    openChat(novelId, {
      entityType: "foreshadowing",
      title: `伏線「${title.trim() || "（タイトル未設定）"}」`,
      summary: summaryParts.length > 0 ? summaryParts.join("\n") : undefined,
    });
  }

  return (
    <EntityEditorShell
      novelId={novelId}
      backLabel="伏線一覧に戻る"
      backTab="foreshadowing"
      title={isEdit ? "伏線・フラグを編集" : "新規伏線・フラグの作成"}
      isEdit={isEdit}
      entityId={foreshadowingId}
      onSave={handleSave}
      saveLoading={creating || updating}
      saveDisabled={!title.trim() || !category.trim()}
      error={error}
      loading={loading}
      loadingMessage="伏線を読み込み中..."
      instruction={instruction}
      onInstructionChange={setInstruction}
      instructionPlaceholder="例: 主人公の出自に関する伏線を考えて。回収時のサプライズを重視して。"
      onGenerate={handleGenerate}
      generateLoading={generatingDraft}
      generateDisabled={!instruction.trim()}
      generateLabel={
        isEdit || category || title || description
          ? "AIで伏線を更新"
          : "AIでドラフト生成"
      }
      onChatConsult={handleChatConsult}
      instructions={instructions}
      onApplyHistory={setInstruction}
      onRequestDeleteInstruction={deleteConfirm.open}
      deleteInstructionId={deleteConfirm.payload}
      onCloseDeleteInstruction={deleteConfirm.close}
      onConfirmDeleteInstruction={handleDeleteInstruction}
      deletingInstruction={deletingInstruction}
      historyOpen={historyModal.isOpen}
      onOpenHistory={historyModal.open}
      onCloseHistory={historyModal.close}
      entityType="foreshadowing"
      currentContent={description}
      historyTitle={`伏線: ${title || "（タイトル未設定）"}`}
      onRestoreSuccess={setDescription}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Input
            label="カテゴリー（スラッシュ区切りで階層化可能）"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="例: 主要伏線 / 主人公の出自, 世界観 / 禁忌..."
            list="foreshadowing-categories-list"
          />
          <datalist id="foreshadowing-categories-list">
            {existingCategories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>
        <Input
          label="伏線・フラグ名"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 主人公のペンダントの秘密, 謎の黒ずくめの男..."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block font-semibold text-muted-foreground text-xs">
            ステータス
          </label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as ForeshadowingStatus)}
            className="w-full p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="unresolved">⏳ 未回収</option>
            <option value="resolved">✅ 回収済</option>
            <option value="abandoned">🚫 保留・破棄</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block font-semibold text-muted-foreground text-xs">
            設置された節 (任意)
          </label>
          <Select
            value={placedSectionId}
            onChange={(e) => setPlacedSectionId(e.target.value)}
            className="w-full p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">未指定</option>
            {chapters.map((ch) => (
              <optgroup key={ch.id} label={ch.title}>
                {ch.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.title || `節 ${sec.order}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block font-semibold text-muted-foreground text-xs">
            回収された節 (任意)
          </label>
          <Select
            value={resolvedSectionId}
            onChange={(e) => setResolvedSectionId(e.target.value)}
            className="w-full p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">未指定</option>
            {chapters.map((ch) => (
              <optgroup key={ch.id} label={ch.title}>
                {ch.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.title || `節 ${sec.order}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
      </div>

      {/* 詳細メモ MonacoEditor */}
      <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-foreground text-xs">
            詳細メモ（Markdown 対応）
          </label>
          <span className="text-[11px] text-muted-foreground">
            {description.length.toLocaleString()} 文字
          </span>
        </div>
        <div className="min-h-[260px] flex-1 overflow-hidden rounded-xl border border-border bg-surface shadow-inner">
          <MonacoEditor value={description} onChange={setDescription} />
        </div>
      </div>
    </EntityEditorShell>
  );
}
