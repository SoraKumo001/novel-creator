import Editor, { type OnMount } from '@monaco-editor/react';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onMount?: OnMount;
}

export function MonacoEditor({ value, onChange, onMount }: MonacoEditorProps) {
  return (
    <Editor
      height="100%"
      defaultLanguage="markdown"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={onMount}
      options={{
        wordWrap: 'on',
        minimap: { enabled: false },
        lineNumbers: 'on',
        fontSize: 15,
        fontFamily: '"Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif',
        padding: { top: 16 },
        smoothScrolling: true,
        scrollBeyondLastLine: false,
      }}
      theme="vs-dark"
    />
  );
}
