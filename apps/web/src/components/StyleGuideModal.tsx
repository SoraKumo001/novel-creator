import {
  STYLE_GUIDE_SNIPPETS,
  STYLE_GUIDE_TEMPLATES,
  type StyleGuideSnippet,
  type StyleGuideTemplate,
} from "@novel-creator/shared";
import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { generateStyleGuideDraft } from "@/lib/services/novel.js";
import { MonacoEditor } from "../routes/novels/_components/-MonacoEditor.js";
import { Button } from "./Button.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { MarkdownText } from "./MarkdownText.js";
import { Modal } from "./Modal.js";

interface StyleGuideModalProps {
  initialStyleGuide?: string | null;
  isOpen: boolean;
  novelId: string;
  onClose: () => void;
  onSave: (styleGuide: string) => Promise<void>;
  saving?: boolean;
}

export function StyleGuideModal({
  isOpen,
  onClose,
  novelId,
  initialStyleGuide,
  onSave,
  saving = false,
}: StyleGuideModalProps) {
  const [styleGuide, setStyleGuide] = useState(initialStyleGuide ?? "");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [rightPanelTab, setRightPanelTab] = useState<"templates" | "snippets">(
    "templates"
  );
  const [snippetCategory, setSnippetCategory] = useState<string>("all");
  const [generatingDraft, startGenerateDraft] = useTransition();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [pendingTemplate, setPendingTemplate] =
    useState<StyleGuideTemplate | null>(null);
  const [confirmAIDraft, setConfirmAIDraft] = useState<boolean>(false);
  const toast = useToast();

  // モーダルが開かれた時に初期値を反映
  useEffect(() => {
    if (isOpen) {
      setStyleGuide(initialStyleGuide ?? "");
      setSelectedTemplateId(null);
    }
  }, [isOpen, initialStyleGuide]);

  // テンプレートの一括適用
  const applyTemplate = (template: StyleGuideTemplate): void => {
    setStyleGuide(template.content);
    setSelectedTemplateId(template.id);
    toast.success(`テンプレート「${template.name}」を適用しました`);
  };

  const handleApplyTemplate = (template: StyleGuideTemplate): void => {
    if (styleGuide.trim()) {
      setPendingTemplate(template);
      return;
    }
    applyTemplate(template);
  };

  const handleConfirmApplyTemplate = (): void => {
    if (!pendingTemplate) {
      return;
    }
    applyTemplate(pendingTemplate);
    setPendingTemplate(null);
  };

  // スニペットの末尾追記
  const handleInsertSnippet = (snippet: StyleGuideSnippet) => {
    const trimmed = styleGuide.trimEnd();
    const newContent = trimmed
      ? `${trimmed}\n\n${snippet.content}\n`
      : `${snippet.content}\n`;
    setStyleGuide(newContent);
    toast.success(`「${snippet.name}」を追加しました`);
  };

  // AI下書き自動生成
  const generateAIDraft = (): void => {
    setConfirmAIDraft(false);
    startGenerateDraft(async () => {
      try {
        const draft = await generateStyleGuideDraft(novelId);
        setStyleGuide(draft);
        toast.success("AIによる執筆スタイルガイドの下書きを生成しました");
      } catch (err) {
        toast.error(toErrorMessage(err));
      }
    });
  };

  const handleGenerateAIDraft = (): void => {
    if (styleGuide.trim()) {
      setConfirmAIDraft(true);
      return;
    }
    generateAIDraft();
  };

  const handleSave = async () => {
    try {
      await onSave(styleGuide.trim());
      toast.success("執筆スタイル・文体ガイドを保存しました");
      onClose();
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  };

  const snippetCategories = [
    { id: "all", label: "すべて" },
    { id: "viewpoint", label: "🎯 視点・人称" },
    { id: "tone", label: "✍️ 文体・トーン" },
    { id: "rules", label: "📐 作法・表記" },
    { id: "ng", label: "🚫 NG・禁止" },
    { id: "direction", label: "⚡ 描写方針" },
  ];

  const filteredSnippets =
    snippetCategory === "all"
      ? STYLE_GUIDE_SNIPPETS
      : STYLE_GUIDE_SNIPPETS.filter((s) => s.category === snippetCategory);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="📝 執筆スタイル & 文体ガイドライン"
        size="xl"
        footer={
          <div className="flex w-full items-center justify-between">
            <div className="text-muted-foreground text-xs">
              {styleGuide.length.toLocaleString()}{" "}
              文字（Markdown形式で自由に定義可能）
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                キャンセル
              </Button>
              <Button variant="primary" onClick={handleSave} isLoading={saving}>
                保存する
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex h-[65vh] min-h-[480px] flex-col gap-4 lg:flex-row">
          {/* 左側: エディタ / プレビュー */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface-raised">
            <div className="flex shrink-0 items-center justify-between border-border border-b bg-surface px-3 py-2">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-raised p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  className={`cursor-pointer rounded-md px-3 py-1 font-semibold text-xs transition ${
                    activeTab === "edit"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ✏️ Markdown編集
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`cursor-pointer rounded-md px-3 py-1 font-semibold text-xs transition ${
                    activeTab === "preview"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  👁️ プレビュー
                </button>
              </div>
              <div className="text-[11px] text-muted-foreground">
                本文生成・推敲・校正プロンプトに自動反映されます
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              {activeTab === "edit" ? (
                <MonacoEditor value={styleGuide} onChange={setStyleGuide} />
              ) : (
                <div className="prose prose-sm dark:prose-invert h-full max-w-none overflow-y-auto p-4">
                  {styleGuide.trim() ? (
                    <MarkdownText content={styleGuide} />
                  ) : (
                    <div className="py-12 text-center text-muted-foreground text-xs">
                      設定内容がありません。右側のテンプレートやスニペットから選んで設定してください。
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 右側: テンプレート・スニペット・AI下書きパレット */}
          <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-raised lg:w-80">
            {/* AI生成バナー */}
            <div className="shrink-0 border-border border-b bg-primary/5 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1 font-bold text-foreground text-xs">
                  <span>🪄</span> AIによる自動提案
                </span>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                作品のあらすじ・登場人物・設定から最適な文体ガイドを自動作成します。
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-center font-medium text-xs"
                onClick={handleGenerateAIDraft}
                isLoading={generatingDraft}
              >
                作品に合うガイドラインを下書き生成
              </Button>
            </div>

            {/* テンプレート/スニペット タブ切り替え */}
            <div className="flex shrink-0 border-border border-b bg-surface">
              <button
                type="button"
                onClick={() => setRightPanelTab("templates")}
                className={`flex-1 cursor-pointer border-b-2 py-2 text-center font-bold text-xs transition ${
                  rightPanelTab === "templates"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                📋 フルテンプレート ({STYLE_GUIDE_TEMPLATES.length})
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab("snippets")}
                className={`flex-1 cursor-pointer border-b-2 py-2 text-center font-bold text-xs transition ${
                  rightPanelTab === "snippets"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                🧩 スニペット追加 ({STYLE_GUIDE_SNIPPETS.length})
              </button>
            </div>

            {/* パネルコンテンツ */}
            <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
              {rightPanelTab === "templates" ? (
                <div className="space-y-2.5">
                  <div className="font-medium text-[11px] text-muted-foreground">
                    ワンクリックで全体をセットアップできます:
                  </div>
                  {STYLE_GUIDE_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className={`rounded-lg border p-3 text-left transition ${
                        selectedTemplateId === tmpl.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-surface hover:border-primary/50"
                      }`}
                    >
                      <div className="mb-1 font-bold text-foreground text-xs">
                        {tmpl.name}
                      </div>
                      <p className="mb-2.5 line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
                        {tmpl.description}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(tmpl)}
                        className="flex cursor-pointer items-center gap-1 font-bold text-[11px] text-primary hover:underline"
                      >
                        <span>📥 このテンプレートを適用</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* カテゴリフィルター */}
                  <div className="mb-2 flex flex-wrap gap-1">
                    {snippetCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSnippetCategory(cat.id)}
                        className={`cursor-pointer rounded-full border px-2 py-0.5 font-semibold text-[10px] transition ${
                          snippetCategory === cat.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-surface text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <div className="font-medium text-[11px] text-muted-foreground">
                    クリックして現在の設定の末尾に追記:
                  </div>

                  {filteredSnippets.map((snp) => (
                    <div
                      key={snp.id}
                      className="rounded-lg border border-border bg-surface p-2.5 transition hover:border-primary/50"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-bold text-foreground text-xs">
                          {snp.name}
                        </span>
                        <span className="rounded border border-border bg-surface-raised px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          {snp.categoryLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInsertSnippet(snp)}
                        className="mt-1 flex cursor-pointer items-center gap-1 font-bold text-[11px] text-primary hover:underline"
                      >
                        <span>➕ 末尾に追加</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={pendingTemplate !== null}
        onClose={() => setPendingTemplate(null)}
        onConfirm={handleConfirmApplyTemplate}
        title="テンプレートの適用"
        message="現在の内容が選択したテンプレートで上書きされます。よろしいですか？"
        confirmLabel="適用する"
        cancelLabel="キャンセル"
      />

      <ConfirmDialog
        isOpen={confirmAIDraft}
        onClose={() => setConfirmAIDraft(false)}
        onConfirm={generateAIDraft}
        title="下書きの生成"
        message="現在の内容がAIの生成した下書きで置き換わります。よろしいですか？"
        confirmLabel="生成する"
        cancelLabel="キャンセル"
      />
    </>
  );
}
