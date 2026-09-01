import { useEffect, useState } from "react";
import type {
  CreateCustomPromptInput,
  CustomPrompt,
  UpdateCustomPromptInput,
} from "@/lib/types.js";
import { Button } from "./Button.js";
import { Modal } from "./Modal.js";
import { Select } from "./Select.js";

interface CustomPromptModalProps {
  defaultCategory?: "inline" | "generation" | "chat" | "general";
  editingPrompt?: CustomPrompt | null;
  novelId?: string | null;
  onClose: () => void;
  onSubmit: (
    data: CreateCustomPromptInput | UpdateCustomPromptInput
  ) => Promise<void>;
  open: boolean;
}

const AVAILABLE_VARIABLES = [
  {
    tag: "{selectedText}",
    label: "選択テキスト",
    desc: "エディタで選択したテキスト",
  },
  {
    tag: "{surroundingText}",
    label: "前後の文脈",
    desc: "選択範囲の前後の文章",
  },
  {
    tag: "{instruction}",
    label: "追加指示",
    desc: "実行時に作家が入力した指示",
  },
  { tag: "{characters}", label: "登場人物", desc: "関連キャラクター情報" },
  { tag: "{settings}", label: "世界観設定", desc: "関連する設定用語" },
  { tag: "{styleGuide}", label: "文体ガイド", desc: "作品の文体・執筆方針" },
  { tag: "{novelTitle}", label: "作品名", desc: "小説タイトル" },
  { tag: "{sectionTitle}", label: "節タイトル", desc: "現在の節の名前" },
];

const ICONS = [
  "🪄",
  "✨",
  "🌿",
  "💓",
  "💬",
  "✂️",
  "🚬",
  "🌧️",
  "⚡",
  "🎭",
  "🔥",
  "⚔️",
  "💡",
  "🔍",
];

export function CustomPromptModal({
  open,
  onClose,
  onSubmit,
  editingPrompt,
  novelId,
  defaultCategory = "inline",
}: CustomPromptModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🪄");
  const [category, setCategory] = useState<
    "inline" | "generation" | "chat" | "general"
  >("inline");
  const [userPrompt, setUserPrompt] = useState("");
  const [isGlobal, setIsGlobal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingPrompt) {
      setName(editingPrompt.name);
      setDescription(editingPrompt.description || "");
      setIcon(editingPrompt.icon || "🪄");
      setCategory(editingPrompt.category);
      setUserPrompt(editingPrompt.userPrompt);
      setIsGlobal(!editingPrompt.novelId);
    } else {
      setName("");
      setDescription("");
      setIcon("🪄");
      setCategory(defaultCategory);
      setUserPrompt(`以下の選択されたテキストを、指定された方針で書き換えてください。

{styleGuide}
{surroundingText}

■ 対象テキスト:
"""
{selectedText}
"""

書き換え後のテキストのみを出力してください:`);
      setIsGlobal(!novelId);
    }
    setError(null);
  }, [editingPrompt, open, defaultCategory, novelId]);

  const handleInsertTag = (tag: string) => {
    setUserPrompt(
      (prev) => prev + (prev.endsWith("\n") || !prev ? "" : " ") + tag
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("プロンプト名を入力してください");
      return;
    }
    if (!userPrompt.trim()) {
      setError("プロンプトテンプレート本文を入力してください");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingPrompt) {
        await onSubmit({
          name: name.trim(),
          description: description.trim() || null,
          icon,
          category,
          userPrompt: userPrompt.trim(),
        });
      } else {
        await onSubmit({
          novelId: isGlobal ? null : novelId || null,
          name: name.trim(),
          description: description.trim() || null,
          icon,
          category,
          userPrompt: userPrompt.trim(),
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={
        editingPrompt
          ? "✏️ カスタムプロンプトの編集"
          : "✨ 新規カスタムプロンプトの登録"
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-danger text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {/* アイコン */}
          <div>
            <label className="mb-1 block font-semibold text-foreground text-xs">
              アイコン
            </label>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto rounded-lg border border-border bg-surface p-1.5">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded text-sm transition ${
                    icon === ic
                      ? "bg-primary font-bold text-primary-foreground shadow-sm"
                      : "hover:bg-muted"
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* プロンプト名 */}
          <div className="md:col-span-3">
            <label className="mb-1 block font-semibold text-foreground text-xs">
              プロンプト名 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: ハードボイルド調に変換、ツンデレ口調に修正"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground text-xs focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              エディタの推敲メニューやボタンに表示される名称です
            </p>
          </div>
        </div>

        {/* 説明 & カテゴリ & スコープ */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block font-semibold text-foreground text-xs">
              簡単な説明
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例: 乾いた視点と渋いモノローグで描写を書き換え"
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground text-xs focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-foreground text-xs">
              利用カテゴリ
            </label>
            <Select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value as "inline" | "generation" | "chat" | "general"
                )
              }
              className="w-full px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
            >
              <option value="inline">インライン推敲 (選択範囲)</option>
              <option value="generation">本文・プロット生成</option>
              <option value="chat">創作相談チャット</option>
              <option value="general">汎用</option>
            </Select>
          </div>
        </div>

        {/* 適用スコープ */}
        {!editingPrompt && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 text-xs">
            <input
              type="checkbox"
              id="isGlobal"
              checked={isGlobal}
              onChange={(e) => setIsGlobal(e.target.checked)}
              className="h-4 w-4 rounded text-primary focus:ring-primary"
            />
            <label
              htmlFor="isGlobal"
              className="cursor-pointer select-none text-foreground"
            >
              全作品共通プロンプトにする（オフの場合はこの小説専用）
            </label>
          </div>
        )}

        {/* テンプレート挿入用変数バッジ */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block font-semibold text-foreground text-xs">
              プロンプトテンプレート <span className="text-danger">*</span>
            </label>
            <span className="text-[11px] text-muted-foreground">
              クリックして変数タグを挿入 ↓
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/70 bg-surface p-2">
            {AVAILABLE_VARIABLES.map((v) => (
              <button
                key={v.tag}
                type="button"
                onClick={() => handleInsertTag(v.tag)}
                title={v.desc}
                className="inline-flex cursor-pointer items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary transition hover:border-primary/40 hover:bg-primary/20"
              >
                <span>+</span>
                <span>{v.tag}</span>
                <span className="text-[10px] text-muted-foreground">
                  ({v.label})
                </span>
              </button>
            ))}
          </div>

          <textarea
            required
            rows={8}
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="プロンプトの指示文を入力してください。{selectedText} などのタグが自動的に置換されます。"
            className="w-full resize-y rounded-lg border border-border bg-surface p-3 font-mono text-foreground text-xs leading-relaxed focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-border border-t pt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            キャンセル
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving
              ? "保存中..."
              : editingPrompt
                ? "変更を保存"
                : "プロンプトを登録"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
