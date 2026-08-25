import Editor from '@monaco-editor/react';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MonacoEditor({ value, onChange }: MonacoEditorProps) {
  return (
    <Editor
      height="100%"
      defaultLanguage="markdown"
      value={value}
      onChange={(v) => onChange(v ?? '')}
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
