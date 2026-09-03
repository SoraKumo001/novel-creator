import type { OnMount } from "@monaco-editor/react";
import { lazy, Suspense } from "react";
import { useTheme } from "@/hooks/useTheme.js";

// @monaco-editor/react は初回マウント時にだけ読み込む（初期バンドルから除外する）
const Editor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.Editor }))
);

interface MonacoEditorProps {
  onChange: (value: string) => void;
  onMount?: OnMount;
  onSelectionChange?: (selectedText: string) => void;
  value: string;
}

export function MonacoEditor({
  value,
  onChange,
  onMount,
  onSelectionChange,
}: MonacoEditorProps) {
  const { resolvedTheme } = useTheme();

  const handleMount: OnMount = (editor, monaco) => {
    if (onSelectionChange) {
      editor.onDidChangeCursorSelection((e) => {
        const model = editor.getModel();
        if (model && !e.selection.isEmpty()) {
          const selected = model.getValueInRange(e.selection);
          onSelectionChange(selected);
        } else if (e.selection.isEmpty()) {
          onSelectionChange("");
        }
      });
    }

    if (onMount) {
      onMount(editor, monaco);
    }
  };

  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-40 w-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <Editor
        height="100%"
        defaultLanguage="markdown"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          wordWrap: "on",
          minimap: { enabled: false },
          lineNumbers: "on",
          fontSize: 15,
          fontFamily:
            '"Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif',
          padding: { top: 16, bottom: 240 },
          smoothScrolling: true,
        }}
        theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
      />
    </Suspense>
  );
}
