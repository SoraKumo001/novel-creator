import { useEffect, useState, useTransition } from 'react';
import {
  STYLE_GUIDE_TEMPLATES,
  STYLE_GUIDE_SNIPPETS,
  type StyleGuideTemplate,
  type StyleGuideSnippet,
} from '@novel-creator/shared';
import { Button } from './Button.js';
import { Modal } from './Modal.js';
import { MarkdownText } from './MarkdownText.js';
import { MonacoEditor } from '../routes/novels/_components/-MonacoEditor.js';
import { generateStyleGuideDraft } from '@/lib/services/novel.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';

interface StyleGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  novelId: string;
  initialStyleGuide?: string | null;
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
  const [styleGuide, setStyleGuide] = useState(initialStyleGuide ?? '');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [rightPanelTab, setRightPanelTab] = useState<'templates' | 'snippets'>('templates');
  const [snippetCategory, setSnippetCategory] = useState<string>('all');
  const [generatingDraft, startGenerateDraft] = useTransition();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const toast = useToast();

  // モーダルが開かれた時に初期値を反映
  useEffect(() => {
    if (isOpen) {
      setStyleGuide(initialStyleGuide ?? '');
      setSelectedTemplateId(null);
    }
  }, [isOpen, initialStyleGuide]);

  // テンプレートの一括適用
  const handleApplyTemplate = (template: StyleGuideTemplate) => {
    if (styleGuide.trim()) {
      if (!window.confirm('現在の内容が選択したテンプレートで上書きされます。よろしいですか？')) {
        return;
      }
    }
    setStyleGuide(template.content);
    setSelectedTemplateId(template.id);
    toast.success(`テンプレート「${template.name}」を適用しました`);
  };

  // スニペットの末尾追記
  const handleInsertSnippet = (snippet: StyleGuideSnippet) => {
    const trimmed = styleGuide.trimEnd();
    const newContent = trimmed ? `${trimmed}\n\n${snippet.content}\n` : `${snippet.content}\n`;
    setStyleGuide(newContent);
    toast.success(`「${snippet.name}」を追加しました`);
  };

  // AI下書き自動生成
  const handleGenerateAIDraft = () => {
    if (styleGuide.trim()) {
      if (!window.confirm('現在の内容がAIの生成した下書きで置き換わります。よろしいですか？')) {
        return;
      }
    }

    startGenerateDraft(async () => {
      try {
        const draft = await generateStyleGuideDraft(novelId);
        setStyleGuide(draft);
        toast.success('AIによる執筆スタイルガイドの下書きを生成しました');
      } catch (err) {
        toast.error(toErrorMessage(err));
      }
    });
  };

  const handleSave = async () => {
    try {
      await onSave(styleGuide.trim());
      toast.success('執筆スタイル・文体ガイドを保存しました');
      onClose();
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  };

  const snippetCategories = [
    { id: 'all', label: 'すべて' },
    { id: 'viewpoint', label: '🎯 視点・人称' },
    { id: 'tone', label: '✍️ 文体・トーン' },
    { id: 'rules', label: '📐 作法・表記' },
    { id: 'ng', label: '🚫 NG・禁止' },
    { id: 'direction', label: '⚡ 描写方針' },
  ];

  const filteredSnippets =
    snippetCategory === 'all'
      ? STYLE_GUIDE_SNIPPETS
      : STYLE_GUIDE_SNIPPETS.filter((s) => s.category === snippetCategory);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📝 執筆スタイル & 文体ガイドライン"
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {styleGuide.length.toLocaleString()} 文字（Markdown形式で自由に定義可能）
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
      <div className="flex flex-col lg:flex-row gap-4 h-[65vh] min-h-[480px]">
        {/* 左側: エディタ / プレビュー */}
        <div className="flex-1 flex flex-col min-w-0 border border-border rounded-xl bg-surface-raised overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2 shrink-0">
            <div className="flex items-center gap-1 bg-surface-raised rounded-lg p-0.5 border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                  activeTab === 'edit'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ✏️ Markdown編集
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                👁️ プレビュー
              </button>
            </div>
            <div className="text-[11px] text-muted-foreground">
              本文生成・推敲・校正プロンプトに自動反映されます
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            {activeTab === 'edit' ? (
              <MonacoEditor value={styleGuide} onChange={setStyleGuide} />
            ) : (
              <div className="h-full overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none">
                {styleGuide.trim() ? (
                  <MarkdownText content={styleGuide} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground text-xs">
                    設定内容がありません。右側のテンプレートやスニペットから選んで設定してください。
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 右側: テンプレート・スニペット・AI下書きパレット */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col border border-border rounded-xl bg-surface-raised overflow-hidden">
          {/* AI生成バナー */}
          <div className="p-3 border-b border-border bg-primary/5 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1">
                <span>🪄</span> AIによる自動提案
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              作品のあらすじ・登場人物・設定から最適な文体ガイドを自動作成します。
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center text-xs font-medium"
              onClick={handleGenerateAIDraft}
              isLoading={generatingDraft}
            >
              作品に合うガイドラインを下書き生成
            </Button>
          </div>

          {/* テンプレート/スニペット タブ切り替え */}
          <div className="flex border-b border-border bg-surface shrink-0">
            <button
              type="button"
              onClick={() => setRightPanelTab('templates')}
              className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition cursor-pointer ${
                rightPanelTab === 'templates'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              📋 フルテンプレート ({STYLE_GUIDE_TEMPLATES.length})
            </button>
            <button
              type="button"
              onClick={() => setRightPanelTab('snippets')}
              className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition cursor-pointer ${
                rightPanelTab === 'snippets'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              🧩 スニペット追加 ({STYLE_GUIDE_SNIPPETS.length})
            </button>
          </div>

          {/* パネルコンテンツ */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {rightPanelTab === 'templates' ? (
              <div className="space-y-2.5">
                <div className="text-[11px] text-muted-foreground font-medium">
                  ワンクリックで全体をセットアップできます:
                </div>
                {STYLE_GUIDE_TEMPLATES.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className={`p-3 rounded-lg border text-left transition ${
                      selectedTemplateId === tmpl.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-surface hover:border-primary/50'
                    }`}
                  >
                    <div className="font-bold text-xs text-foreground mb-1">{tmpl.name}</div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-2.5 line-clamp-2">
                      {tmpl.description}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>📥 このテンプレートを適用</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* カテゴリフィルター */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {snippetCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSnippetCategory(cat.id)}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition cursor-pointer ${
                        snippetCategory === cat.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="text-[11px] text-muted-foreground font-medium">
                  クリックして現在の設定の末尾に追記:
                </div>

                {filteredSnippets.map((snp) => (
                  <div
                    key={snp.id}
                    className="p-2.5 rounded-lg border border-border bg-surface hover:border-primary/50 transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-foreground">{snp.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-raised border border-border text-muted-foreground">
                        {snp.categoryLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet(snp)}
                      className="mt-1 text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
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
  );
}
