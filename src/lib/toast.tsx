"use client";

import { createContext, useCallback, useContext, useRef } from "react";
import WaToast from "@awesome.me/webawesome/dist/react/toast/index.js";

type ToastKind = "info" | "success" | "error";

const ToastContext = createContext<{
  push: (message: string, kind?: ToastKind) => void;
} | null>(null);

interface ToastStackElement extends HTMLElement {
  create?: (
    message: string,
    options?: { variant?: string; duration?: number; allowHtml?: boolean },
  ) => Promise<HTMLElement>;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const stackRef = useRef<ToastStackElement | null>(null);
  const push = useCallback((message: string, kind: ToastKind = "info") => {
    const variant =
      kind === "error" ? "danger" : kind === "success" ? "success" : "neutral";
    void stackRef.current?.create?.(message, { variant, duration: 3200 });
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <WaToast ref={stackRef as never} placement="top-center" />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}
