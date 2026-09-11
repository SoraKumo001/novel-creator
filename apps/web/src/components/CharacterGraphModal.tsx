import {
  type CharacterGraphNode,
  generateCharacterMermaidGraph,
} from "@novel-creator/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/useToast.js";
import { renderMermaid } from "@/lib/mermaid.js";
import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

interface CharacterGraphModalProps {
  characters: CharacterGraphNode[];
  isOpen: boolean;
  onClose: () => void;
}

export function CharacterGraphModal({
  isOpen,
  onClose,
  characters,
}: CharacterGraphModalProps) {
  const [viewCode, setViewCode] = useState(false);
  const [zoom, setZoom] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const mermaidCode = useMemo(
    () => generateCharacterMermaidGraph(characters),
    [characters]
  );

  useEffect(() => {
    // mermaidCode は再実行トリガー（コンテナは key={mermaidCode} で再マウントされ、
    // 描画内容は DOM 経由で renderMermaid が参照するため、ここで参照を明示する）
    void mermaidCode;
    if (isOpen && !viewCode && containerRef.current) {
      // Mermaid レンダリング
      const timer = setTimeout(() => {
        if (containerRef.current) {
          void renderMermaid(containerRef.current);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, viewCode, mermaidCode]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(mermaidCode);
      toast.success("Mermaid コードをコピーしました");
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 20, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 20, 40));
  const handleZoomReset = () => setZoom(100);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="人物相関図・勢力図 (Mermaid)"
      size="full"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
          <Button
            variant="secondary"
            onClick={() => setViewCode((prev) => !prev)}
          >
            {viewCode ? "📊 図を表示" : "📝 Mermaid コード表示"}
          </Button>
          {viewCode && (
            <Button variant="secondary" onClick={handleCopyCode}>
              📋 コードをコピー
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            登場人物のカテゴリ（陣営）と、人物詳細に記述された人間関係（例:
            「田中: 友人」など）から相関図を自動生成しています。
          </p>
          {!viewCode && (
            <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
              <span className="w-10 text-right font-mono text-[11px]">
                {zoom}%
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 40}
                title="縮小"
              >
                −
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleZoomReset}
                disabled={zoom === 100}
                title="100%にリセット"
              >
                リセット
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                title="拡大"
              >
                ＋
              </Button>
            </div>
          )}
        </div>

        {viewCode ? (
          <div className="space-y-2">
            <textarea
              readOnly
              value={mermaidCode}
              rows={16}
              className="w-full select-all rounded-lg border border-border bg-surface-raised p-3 font-mono text-foreground text-xs leading-relaxed focus:outline-none"
            />
          </div>
        ) : (
          <div
            ref={containerRef}
            key={mermaidCode}
            className="max-h-[72vh] min-h-[400px] overflow-auto rounded-xl border border-border bg-surface-raised/40 p-6"
          >
            <div
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
              }}
              className="mermaid mx-auto flex w-fit min-w-fit justify-center transition-transform duration-150 [&_svg]:max-w-none"
            >
              {mermaidCode}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
