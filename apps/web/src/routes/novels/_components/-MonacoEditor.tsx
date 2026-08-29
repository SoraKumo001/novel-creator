import Editor, { type OnMount } from '@monaco-editor/react';
import { useTheme } from '@/hooks/useTheme.js';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onMount?: OnMount;
  onSelectionChange?: (selectedText: string) => void;
}

export function MonacoEditor({ value, onChange, onMount, onSelectionChange }: MonacoEditorProps) {
  const { resolvedTheme } = useTheme();

  const handleMount: OnMount = (editor, monaco) => {
    if (onSelectionChange) {
      editor.onDidChangeCursorSelection((e) => {
        const model = editor.getModel();
        if (model && !e.selection.isEmpty()) {
          const selected = model.getValueInRange(e.selection);
          onSelectionChange(selected);
        } else if (e.selection.isEmpty()) {
          onSelectionChange('');
        }
      });
    }

    if (onMount) {
      onMount(editor, monaco);
    }
  };

  return (
    <Editor
      height="100%"
      defaultLanguage="markdown"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={handleMount}
      options={{
        wordWrap: 'on',
        minimap: { enabled: false },
        lineNumbers: 'on',
        fontSize: 15,
        fontFamily: '"Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif',
        padding: { top: 16, bottom: 240 },
        smoothScrolling: true,
      }}
      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
    />
  );
}
