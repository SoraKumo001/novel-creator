import { DiffEditor } from "@monaco-editor/react";
import { useContext, useState } from "react";
import { Button } from "@/components/Button.js";
import { Modal } from "@/components/Modal.js";
import { ThemeContext } from "@/context/ThemeContext.js";

export interface ProposalDiffModalProps {
  isApplying?: boolean;
  isOpen: boolean;
  novelTitle?: string;
  onApply: () => Promise<void>;
  onClose: () => void;
  onOpenInEditor?: () => void;
  originalMarkdown: string;
  proposalSummary: string;
  title: string;
  updatedMarkdown: string;
}

export function ProposalDiffModal({
  isOpen,
  onClose,
  title,
  proposalSummary,
  originalMarkdown,
  updatedMarkdown,
  onApply,
  onOpenInEditor,
  isApplying = false,
}: ProposalDiffModalProps) {
  const themeContext = useContext(ThemeContext);
  const resolvedTheme = themeContext?.resolvedTheme || "light";
  const [renderSideBySide, setRenderSideBySide] = useState(true);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`差分プレビュー: ${title}`}
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
            <span>現在（左/赤）</span>
            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>提案適用後（右/緑）</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isApplying}>
              キャンセル
            </Button>
            {onOpenInEditor && (
              <Button
                type="button"
                variant="secondary"
                onClick={onOpenInEditor}
                disabled={isApplying}
              >
                📝 Markdown画面で開く
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              onClick={onApply}
              disabled={isApplying}
              isLoading={isApplying}
            >
              ✔ 小説に反映する
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex h-[560px] min-h-0 w-full flex-col space-y-2.5">
        {/* 上部コントロールバー */}
        <div className="flex shrink-0 items-center justify-between border-border border-b pb-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              💡 {proposalSummary}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer select-none items-center gap-1.5 text-foreground">
              <input
                type="checkbox"
                checked={renderSideBySide}
                onChange={(e) => setRenderSideBySide(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              左右並列で比較（Side-by-Side）
            </label>
          </div>
        </div>

        {/* Monaco DiffEditor */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
          <DiffEditor
            height="100%"
            language="markdown"
            theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
            original={originalMarkdown}
            modified={updatedMarkdown}
            options={{
              readOnly: true,
              renderSideBySide,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              fontSize: 13,
              diffWordWrap: "on",
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
