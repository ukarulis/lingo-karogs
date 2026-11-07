"use client";

import { createContext, useCallback, useContext, useState } from "react";

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "success" | "error";
}

const ToastContext = createContext<{
  toasts: Toast[];
  push: (message: string, kind?: Toast["kind"]) => void;
} | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);
  return (
    <ToastContext.Provider value={{ toasts, push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "max-w-sm rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur " +
              (t.kind === "error"
                ? "border-red-300 bg-red-50/95 text-red-800 dark:border-red-800 dark:bg-red-950/90 dark:text-red-200"
                : t.kind === "success"
                  ? "border-emerald-300 bg-emerald-50/95 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-200"
                  : "border-stone-300 bg-white/95 text-stone-800 dark:border-stone-700 dark:bg-stone-900/95 dark:text-stone-200")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}
