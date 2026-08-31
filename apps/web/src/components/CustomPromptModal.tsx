import { useState, useEffect } from 'react';
import { Button } from './Button.js';
import { Modal } from './Modal.js';
import type {
  CreateCustomPromptInput,
  CustomPrompt,
  UpdateCustomPromptInput,
} from '@/lib/types.js';

interface CustomPromptModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCustomPromptInput | UpdateCustomPromptInput) => Promise<void>;
  editingPrompt?: CustomPrompt | null;
  novelId?: string | null;
  defaultCategory?: 'inline' | 'generation' | 'chat' | 'general';
}

const AVAILABLE_VARIABLES = [
  { tag: '{selectedText}', label: '選択テキスト', desc: 'エディタで選択したテキスト' },
  { tag: '{surroundingText}', label: '前後の文脈', desc: '選択範囲の前後の文章' },
  { tag: '{instruction}', label: '追加指示', desc: '実行時に作家が入力した指示' },
  { tag: '{characters}', label: '登場人物', desc: '関連キャラクター情報' },
  { tag: '{settings}', label: '世界観設定', desc: '関連する設定用語' },
  { tag: '{styleGuide}', label: '文体ガイド', desc: '作品の文体・執筆方針' },
  { tag: '{novelTitle}', label: '作品名', desc: '小説タイトル' },
  { tag: '{sectionTitle}', label: '節タイトル', desc: '現在の節の名前' },
];

const ICONS = ['🪄', '✨', '🌿', '💓', '💬', '✂️', '🚬', '🌧️', '⚡', '🎭', '🔥', '⚔️', '💡', '🔍'];

export function CustomPromptModal({
  open,
  onClose,
  onSubmit,
  editingPrompt,
  novelId,
  defaultCategory = 'inline',
}: CustomPromptModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🪄');
  const [category, setCategory] = useState<'inline' | 'generation' | 'chat' | 'general'>('inline');
  const [userPrompt, setUserPrompt] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingPrompt) {
      setName(editingPrompt.name);
      setDescription(editingPrompt.description || '');
      setIcon(editingPrompt.icon || '🪄');
      setCategory(editingPrompt.category);
      setUserPrompt(editingPrompt.userPrompt);
      setIsGlobal(!editingPrompt.novelId);
    } else {
      setName('');
      setDescription('');
      setIcon('🪄');
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
    setUserPrompt((prev) => prev + (prev.endsWith('\n') || !prev ? '' : ' ') + tag);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('プロンプト名を入力してください');
      return;
    }
    if (!userPrompt.trim()) {
      setError('プロンプトテンプレート本文を入力してください');
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
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editingPrompt ? '✏️ カスタムプロンプトの編集' : '✨ 新規カスタムプロンプトの登録'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-danger/10 border border-danger/30 p-2.5 text-xs text-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* アイコン */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">アイコン</label>
            <div className="flex flex-wrap gap-1 p-1.5 rounded-lg border border-border bg-surface max-h-24 overflow-y-auto">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`h-7 w-7 rounded flex items-center justify-center text-sm cursor-pointer transition ${
                    icon === ic
                      ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                      : 'hover:bg-muted'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* プロンプト名 */}
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-foreground mb-1">
              プロンプト名 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: ハードボイルド調に変換、ツンデレ口調に修正"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              エディタの推敲メニューやボタンに表示される名称です
            </p>
          </div>
        </div>

        {/* 説明 & カテゴリ & スコープ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-foreground mb-1">簡単な説明</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例: 乾いた視点と渋いモノローグで描写を書き換え"
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">利用カテゴリ</label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as 'inline' | 'generation' | 'chat' | 'general')
              }
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="inline">インライン推敲 (選択範囲)</option>
              <option value="generation">本文・プロット生成</option>
              <option value="chat">創作相談チャット</option>
              <option value="general">汎用</option>
            </select>
          </div>
        </div>

        {/* 適用スコープ */}
        {!editingPrompt && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-border text-xs">
            <input
              type="checkbox"
              id="isGlobal"
              checked={isGlobal}
              onChange={(e) => setIsGlobal(e.target.checked)}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="isGlobal" className="text-foreground cursor-pointer select-none">
              全作品共通プロンプトにする（オフの場合はこの小説専用）
            </label>
          </div>
        )}

        {/* テンプレート挿入用変数バッジ */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-foreground">
              プロンプトテンプレート <span className="text-danger">*</span>
            </label>
            <span className="text-[11px] text-muted-foreground">クリックして変数タグを挿入 ↓</span>
          </div>

          <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-surface border border-border/70">
            {AVAILABLE_VARIABLES.map((v) => (
              <button
                key={v.tag}
                type="button"
                onClick={() => handleInsertTag(v.tag)}
                title={v.desc}
                className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/20 hover:border-primary/40 transition cursor-pointer font-mono"
              >
                <span>+</span>
                <span>{v.tag}</span>
                <span className="text-muted-foreground text-[10px]">({v.label})</span>
              </button>
            ))}
          </div>

          <textarea
            required
            rows={8}
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="プロンプトの指示文を入力してください。{selectedText} などのタグが自動的に置換されます。"
            className="w-full font-mono text-xs leading-relaxed rounded-lg border border-border bg-surface p-3 text-foreground focus:outline-none focus:border-primary resize-y"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? '保存中...' : editingPrompt ? '変更を保存' : 'プロンプトを登録'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
