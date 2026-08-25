import { useToastContext } from '@/components/Toast.js';
import type { ToastType } from '@/components/Toast.js';

/**
 * トースト通知を表示するためのフック。
 * success / error / loading の 3 タイプを提供する。
 * 使用するには ToastProvider でアプリをラップする必要がある。
 */
export function useToast() {
  const { showToast } = useToastContext();

  return {
    success: (message: string) => showToast('success', message),
    error: (message: string) => showToast('error', message),
    loading: (message: string) => showToast('loading', message),
  };
}

export type { ToastType };
