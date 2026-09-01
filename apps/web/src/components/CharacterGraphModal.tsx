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
  const containerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const mermaidCode = useMemo(
    () => generateCharacterMermaidGraph(characters),
    [characters]
  );

  useEffect(() => {
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="人物相関図・勢力図 (Mermaid)"
      size="xl"
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
        <p className="text-muted-foreground text-xs">
          登場人物のカテゴリ（陣営）と、人物詳細に記述された人間関係（例:
          「田中: 友人」など）から相関図を自動生成しています。
        </p>

        {viewCode ? (
          <div className="space-y-2">
            <textarea
              readOnly
              value={mermaidCode}
              rows={12}
              className="w-full select-all rounded-lg border border-border bg-surface-raised p-3 font-mono text-foreground text-xs leading-relaxed focus:outline-none"
            />
          </div>
        ) : (
          <div
            ref={containerRef}
            key={mermaidCode}
            className="flex max-h-[500px] min-h-[320px] items-center justify-center overflow-auto rounded-xl border border-border bg-surface-raised/40 p-4"
          >
            <div className="mermaid w-full text-center">{mermaidCode}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
