import type { DiffEditorProps, DiffOnMount } from "@monaco-editor/react";
import {
  type ComponentType,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useState,
} from "react";
import { Button } from "@/components/Button.js";
import { Modal } from "@/components/Modal.js";
import { ThemeContext } from "@/context/ThemeContext.js";

// @monaco-editor/react は差分表示時にだけ読み込む（初期バンドルから除外する）
const DiffEditor = lazy<ComponentType<DiffEditorProps>>(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.DiffEditor }))
);

export interface DiffTabItem {
  count?: number;
  entityType: string;
  id: string;
  label: string;
  originalMarkdown: string;
  targetTab: string;
  title: string;
  updatedMarkdown: string;
}

export interface ProposalDiffModalProps {
  diffItems?: DiffTabItem[];
  isApplying?: boolean;
  isOpen: boolean;
  novelTitle?: string;
  onApply: () => Promise<void>;
  onClose: () => void;
  onOpenInEditor?: (targetTab?: string) => void;
  originalMarkdown?: string;
  proposalSummary: string;
  title?: string;
  updatedMarkdown?: string;
}

export function ProposalDiffModal({
  isOpen,
  onClose,
  title = "",
  proposalSummary,
  originalMarkdown = "",
  updatedMarkdown = "",
  diffItems,
  onApply,
  onOpenInEditor,
  isApplying = false,
}: ProposalDiffModalProps) {
  const themeContext = useContext(ThemeContext);
  const resolvedTheme = themeContext?.resolvedTheme || "light";
  const [renderSideBySide, setRenderSideBySide] = useState(true);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);

  const activeItem =
    diffItems && diffItems.length > 0
      ? (diffItems.find((item) => item.id === selectedTabId) ?? diffItems[0])
      : null;

  const currentTitle = activeItem ? activeItem.title : title;
  const currentOriginal = activeItem
    ? activeItem.originalMarkdown
    : originalMarkdown;
  const currentUpdated = activeItem
    ? activeItem.updatedMarkdown
    : updatedMarkdown;
  const currentTargetTab = activeItem?.targetTab;

  const handleDiffMount: DiffOnMount = useCallback((editor) => {
    // Monaco DiffEditor の仕様上、左側（original）に wordWrap が自動波及しない場合があるため、明示適用する
    editor.getOriginalEditor().updateOptions({
      wordWrap: "on",
      wrappingStrategy: "advanced",
    });
    editor.getModifiedEditor().updateOptions({
      wordWrap: "on",
      wrappingStrategy: "advanced",
    });
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`差分プレビュー: ${currentTitle}`}
      size="full"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>
              {renderSideBySide ? "現在（左/赤）" : "削除・変更前（赤）"}
            </span>
            <span className="ml-3 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>
              {renderSideBySide ? "提案適用後（右/緑）" : "追加・変更後（緑）"}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={onClose} disabled={isApplying}>
              キャンセル
            </Button>
            {onOpenInEditor && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenInEditor(currentTargetTab)}
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
      <div className="flex h-[75vh] max-h-205 min-h-110 w-full flex-col space-y-3">
        {/* 上部コントロールバー */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-border border-b pb-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-foreground text-sm">
              💡 {proposalSummary}
            </span>

            {/* 複数カテゴリがある場合のタブ切替 */}
            {diffItems && diffItems.length > 1 && (
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface-raised p-0.5">
                {diffItems.map((item) => {
                  const isActive =
                    (activeItem?.id ?? diffItems[0].id) === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedTabId(item.id)}
                      className={`cursor-pointer rounded-md px-3 py-1 font-medium transition ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">比較モード:</span>
            <div className="flex items-center rounded-lg border border-border bg-surface-raised p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRenderSideBySide(true)}
                className={`cursor-pointer rounded px-2.5 py-1 font-medium transition ${
                  renderSideBySide
                    ? "bg-surface text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                左右並列（2ペイン）
              </button>
              <button
                type="button"
                onClick={() => setRenderSideBySide(false)}
                className={`cursor-pointer rounded px-2.5 py-1 font-medium transition ${
                  !renderSideBySide
                    ? "bg-surface text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                行内統合（1ペイン）
              </button>
            </div>
          </div>
        </div>

        {/* Monaco DiffEditor */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-background shadow-xs">
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            }
          >
            <DiffEditor
              key={`${renderSideBySide ? "side" : "inline"}-${activeItem?.id ?? "single"}-${isOpen ? "open" : "closed"}`}
              height="100%"
              language="markdown"
              theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
              original={currentOriginal}
              modified={currentUpdated}
              onMount={handleDiffMount}
              options={{
                readOnly: true,
                renderSideBySide,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                diffWordWrap: "on",
                wrappingStrategy: "advanced",
                automaticLayout: true,
                fontSize: 13,
                lineNumbersMinChars: 3,
                padding: { top: 8, bottom: 8 },
                originalEditable: false,
                useInlineViewWhenSpaceIsLimited: false,
              }}
            />
          </Suspense>
        </div>
      </div>
    </Modal>
  );
}
