import { useCallback, useRef, useState } from "react";

export interface ToastState {
  message: string;
  kind: "success" | "error";
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const showToast = useCallback((message: string, kind: ToastState["kind"]) => {
    setToast({ message, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), kind === "error" ? 6000 : 3000);
  }, []);
  return { toast, showToast };
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return <div className={`toast toast-${toast.kind}`}>{toast.message}</div>;
}
