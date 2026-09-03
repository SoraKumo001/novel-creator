import { useState } from "react";

const NOVEL_TOTAL_PREFIX = "novel-creator:target-words-total:";

interface TargetWordsConfig {
  defaultValue: number;
  fallback: number;
  max: number;
  min: number;
}

interface UseTargetWordsReturn {
  handleEditTarget: () => void;
  handleSaveTargetWords: (val: number) => void;
  isEditingTarget: boolean;
  targetWords: number;
}

/**
 * scopeKey に応じた既定値・クランプ範囲を返す。
 * 作品全体（`novel-creator:target-words-total:*`）と節単位
 * （`novel-creator:target-words:*`）の両方をまかなう。
 */
function resolveConfig(scopeKey: string): TargetWordsConfig {
  if (scopeKey.startsWith(NOVEL_TOTAL_PREFIX)) {
    return {
      defaultValue: 100_000,
      fallback: 100_000,
      min: 1000,
      max: 1_000_000,
    };
  }
  return { defaultValue: 2000, fallback: 2000, min: 100, max: 50_000 };
}

/**
 * 目標文字数の localStorage 読み書きと保存ハンドラを集約するフック。
 * 作品全体・節単位のいずれも scopeKey 文字列1つで利用できる。
 */
export function useTargetWords(scopeKey: string): UseTargetWordsReturn {
  const [targetWords, setTargetWords] = useState<number>(() => {
    const saved = localStorage.getItem(scopeKey);
    return saved
      ? Number.parseInt(saved, 10)
      : resolveConfig(scopeKey).defaultValue;
  });
  const [isEditingTarget, setIsEditingTarget] = useState(false);

  const handleEditTarget = (): void => {
    setIsEditingTarget(true);
  };

  const handleSaveTargetWords = (val: number): void => {
    const config = resolveConfig(scopeKey);
    const clamped = Math.max(
      config.min,
      Math.min(config.max, Number.isNaN(val) ? config.fallback : val)
    );
    setTargetWords(clamped);
    localStorage.setItem(scopeKey, String(clamped));
    setIsEditingTarget(false);
  };

  return {
    targetWords,
    isEditingTarget,
    handleEditTarget,
    handleSaveTargetWords,
  };
}
