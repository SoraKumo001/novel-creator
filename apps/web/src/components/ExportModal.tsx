import { useMemo, useState } from 'react';
import { Button } from './Button.js';
import { Modal } from './Modal.js';
import { formatNovelText, type ExportFormat, type NovelExportData } from '@novel-creator/shared';
import { useToast } from '@/hooks/useToast.js';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  novel: NovelExportData;
}

const FORMAT_OPTIONS: { id: ExportFormat; label: string; ext: string; desc: string }[] = [
  {
    id: 'markdown',
    label: 'Markdown (.md)',
    ext: 'md',
    desc: '見出しタグ付き。GitHubや各種マークダウン対応エディタ向け',
  },
  {
    id: 'plain',
    label: 'プレーンテキスト (.txt)',
    ext: 'txt',
    desc: '汎用テキストファイル形式。装飾記号で章・節を区切ります',
  },
  {
    id: 'narou',
    label: '小説家になろう形式 (.txt)',
    ext: 'txt',
    desc: '章見出し・節見出しのフォーマットをなろう投稿用に最適化',
  },
  {
    id: 'kakuyomu',
    label: 'カクヨム形式 (.txt)',
    ext: 'txt',
    desc: '章・節の区切りをカクヨム投稿用に最適化',
  },
];

export function ExportModal({ isOpen, onClose, novel }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const toast = useToast();

  const formattedText = useMemo(() => {
    return formatNovelText(novel, format);
  }, [novel, format]);

  const selectedFormatOption = useMemo(
    () => FORMAT_OPTIONS.find((f) => f.id === format) ?? FORMAT_OPTIONS[0],
    [format],
  );

  const characterCount = useMemo(() => {
    return formattedText.length;
  }, [formattedText]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedText);
      toast.success('クリップボードに全文をコピーしました');
    } catch {
      toast.error('コピーに失敗しました');
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = novel.title.replace(/[\\/:*?"<>|]/g, '_');
      a.download = `${safeTitle}.${selectedFormatOption.ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('ファイルをダウンロードしました');
    } catch {
      toast.error('ダウンロードに失敗しました');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="小説全文エクスポート"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
          <Button variant="secondary" onClick={handleCopy}>
            📋 クリップボードにコピー
          </Button>
          <Button variant="primary" onClick={handleDownload}>
            💾 ファイルをダウンロード
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* フォーマット選択 */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            エクスポート形式
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FORMAT_OPTIONS.map((opt) => {
              const isSelected = format === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormat(opt.id)}
                  className={`flex flex-col rounded-lg border p-2.5 text-left transition cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                  }`}
                >
                  <span className="text-xs">{opt.label}</span>
                  <span className="mt-1 text-[10px] opacity-75 line-clamp-2 leading-tight">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* プレビュー情報ヘッダー */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>プレビュー ({characterCount.toLocaleString()} 文字)</span>
          <span>章数: {novel.chapters.length}</span>
        </div>

        {/* プレビューテキストエリア */}
        <div className="relative">
          <textarea
            readOnly
            value={formattedText}
            rows={14}
            className="w-full font-mono text-xs rounded-lg border border-border bg-surface-raised p-3 text-foreground focus:outline-none leading-relaxed select-all"
          />
        </div>
      </div>
    </Modal>
  );
}
