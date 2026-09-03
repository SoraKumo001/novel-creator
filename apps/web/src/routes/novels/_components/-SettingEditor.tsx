import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/Input.js";
import { useChatUI } from "@/context/ChatContext.js";
import { useLlmInstructions } from "@/hooks/useLlmInstructions.js";
import { useModalState } from "@/hooks/useModalResultState.js";
import { useSettings } from "@/hooks/useSettings.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { EntityEditorShell } from "./-EntityEditorShell.js";
import { MonacoEditor } from "./-MonacoEditor.js";

interface SettingEditorProps {
  novelId: string;
  settingId?: string;
}

export function SettingEditor({ novelId, settingId }: SettingEditorProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { openChat } = useChatUI();
  const {
    settings,
    loading: settingsLoading,
    error: queryError,
    createSetting,
    updateSetting,
    generateDraft,
    creating,
    updating,
    generatingDraft,
  } = useSettings(novelId);
  const {
    instructions,
    saveInstruction,
    deleteInstruction,
    deleting: deletingInstruction,
  } = useLlmInstructions(novelId, "setting");

  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  // 履歴削除確認ダイアログ（payload = 削除対象の指示ID）と履歴差分モーダル
  const deleteConfirm = useModalState<string>();
  const historyModal = useModalState();

  const isEdit = !!settingId;
  const loading = isEdit ? settingsLoading : false;

  const targetSetting = useMemo(
    () => settings?.find((s) => s.id === settingId),
    [settings, settingId]
  );

  // 既存の設定カテゴリ一覧（サジェスト用）
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of settings ?? []) {
      if (s.category?.trim()) {
        set.add(s.category.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
  }, [settings]);

  // 編集対象の設定情報をフォームに反映
  // 同一IDの再取得（refetch）で編集中のフォームを再初期化しないよう、反映済みIDでガードする
  const populatedSettingIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!targetSetting) {
      return;
    }
    if (populatedSettingIdRef.current === targetSetting.id) {
      return;
    }
    populatedSettingIdRef.current = targetSetting.id;
    setCategory(targetSetting.category);
    setName(targetSetting.name);
    setDescription(targetSetting.description ?? "");
  }, [targetSetting]);

  // クエリのエラーを表示用の error に反映（編集時のみ）
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
        category || name || description
          ? { category, name, description }
          : undefined;
      const result = await generateDraft(instruction.trim(), currentDraft);
      setCategory(result.category);
      setName(result.name);
      setDescription(result.description);
      // 履歴に保存（重複時は既存を返す）
      await saveInstruction({
        entityType: "setting",
        instruction: instruction.trim(),
      });
      toast.success("設定案を生成しました");
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  }

  const handleSave = useCallback(async () => {
    setError(null);
    if (!category.trim() || !name.trim()) {
      toast.error("カテゴリーと名前は必須です");
      return;
    }
    try {
      const input = {
        category: category.trim(),
        name: name.trim(),
        description: description.trim(),
      };
      if (isEdit && settingId) {
        await updateSetting(settingId, input);
      } else {
        const created = await createSetting(input);
        // 新規作成後に重複保存が起きないよう編集ページへ置換遷移する（一覧には遷移しない）
        navigate({
          to: "/novels/$novelId/settings/$settingId",
          params: { novelId, settingId: created.id },
          replace: true,
        });
      }
      toast.success(isEdit ? "設定を更新しました" : "設定を作成しました");
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  }, [
    category,
    createSetting,
    description,
    isEdit,
    name,
    navigate,
    novelId,
    settingId,
    toast,
    updateSetting,
  ]);

  // Ctrl+S / Cmd+S ショートカットで保存（頁遷移なし）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (category.trim() && name.trim() && !creating && !updating) {
          void handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [category, creating, name, updating, handleSave]);

  async function handleDeleteInstruction() {
    const targetId = deleteConfirm.payload;
    if (!targetId) {
      return;
    }
    await deleteInstruction(targetId);
    deleteConfirm.close();
  }

  function applyHistory(text: string) {
    setInstruction(text);
  }

  // 編集中フォームの現在値からチャット相談フォーカスを構築してドロワーを開く。
  // 未保存の編集内容が対象になる点が価値なので summary に「未保存」旨を添える。
  function handleChatConsult() {
    const summaryParts = [
      category.trim() && `カテゴリー: ${category.trim()}`,
      description.trim() &&
        `説明: ${description.trim().slice(0, 500)}${description.trim().length > 500 ? "…" : ""}`,
      isEdit && "※エディタ上の未保存の内容を含みます",
    ].filter(Boolean);
    openChat(novelId, {
      entityType: "setting",
      title: `設定「${name.trim() || "（名称未設定）"}」`,
      summary: summaryParts.length > 0 ? summaryParts.join("\n") : undefined,
    });
  }

  return (
    <EntityEditorShell
      novelId={novelId}
      backLabel="設定一覧に戻る"
      backTab="settings"
      title={isEdit ? "設定を編集" : "新規設定の作成"}
      isEdit={isEdit}
      entityId={settingId}
      onSave={handleSave}
      saveLoading={creating || updating}
      saveDisabled={!name.trim() || !category.trim()}
      error={error}
      loading={loading}
      loadingMessage="設定を読み込み中..."
      instruction={instruction}
      onInstructionChange={setInstruction}
      instructionPlaceholder="例: 魔法体系を考えて。代償と制限がある硬い世界観で。このアイテムの弱点や副作用を具体化して。"
      onGenerate={handleGenerate}
      generateLoading={generatingDraft}
      generateDisabled={!instruction.trim()}
      generateLabel={
        isEdit || category || name || description
          ? "AIで設定を更新"
          : "AIでドラフト生成"
      }
      onChatConsult={handleChatConsult}
      instructions={instructions}
      onApplyHistory={applyHistory}
      onRequestDeleteInstruction={deleteConfirm.open}
      deleteInstructionId={deleteConfirm.payload}
      onCloseDeleteInstruction={deleteConfirm.close}
      onConfirmDeleteInstruction={handleDeleteInstruction}
      deletingInstruction={deletingInstruction}
      historyOpen={historyModal.isOpen}
      onOpenHistory={historyModal.open}
      onCloseHistory={historyModal.close}
      entityType="setting"
      currentContent={description}
      historyTitle={`設定: ${name || "（名称未設定）"}`}
      onRestoreSuccess={setDescription}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Input
            label="カテゴリー（スラッシュ区切りで階層化可能）"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="例: 世界観 / 魔法体系 / 禁忌魔法, 組織 / 採取ギルド..."
            list="setting-categories-list"
          />
          <datalist id="setting-categories-list">
            {existingCategories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>
        <Input
          label="名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 制御キー, ヴォルンハイム辺境伯領..."
        />
      </div>

      {/* 説明 MonacoEditor */}
      <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-foreground text-xs">
            説明（Markdown 対応）
          </label>
          <span className="text-[11px] text-muted-foreground">
            {description.length.toLocaleString()} 文字
          </span>
        </div>
        <div className="min-h-[300px] flex-1 overflow-hidden rounded-xl border border-border bg-surface shadow-inner">
          <MonacoEditor value={description} onChange={setDescription} />
        </div>
      </div>
    </EntityEditorShell>
  );
}
