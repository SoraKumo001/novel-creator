import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// globals: true が無い環境（ルートのワークスペース実行等）でも
// テスト間で DOM が残留しないよう明示的にクリーンアップする
afterEach(() => {
  cleanup();
});
