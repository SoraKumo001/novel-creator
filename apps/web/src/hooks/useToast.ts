import { useToastContext } from "@/components/Toast.js";

export function useToast() {
  const { showToast, dismissToast } = useToastContext();

  return {
    showToast,
    dismissToast,
    success: (message: string) => showToast("success", message),
    error: (message: string) => showToast("error", message),
    loading: (message: string) => showToast("loading", message),
  };
}
