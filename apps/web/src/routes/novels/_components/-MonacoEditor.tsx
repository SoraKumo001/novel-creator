import Editor, { type OnMount } from '@monaco-editor/react';
import { useTheme } from '@/hooks/useTheme.js';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onMount?: OnMount;
}

export function MonacoEditor({ value, onChange, onMount }: MonacoEditorProps) {
  const { resolvedTheme } = useTheme();

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
        padding: { top: 16, bottom: 240 },
        smoothScrolling: true,
      }}
      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
    />
  );
}
