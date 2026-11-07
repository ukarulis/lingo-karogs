"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import WaDialog from "@awesome.me/webawesome/dist/react/dialog/index.js";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  children,
  labelledBy,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  labelledBy?: string;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!mounted) return null;
  return (
    <WaDialog
      open={visible}
      label={title}
      aria-labelledby={labelledBy}
      onWaHide={() => {
        // Escape / user-requested close: sync the controlled state.
        if (visible) onClose();
      }}
      onWaAfterHide={() => setMounted(false)}
      className={cn("dark:bg-stone-900", wide ? "sm:max-w-2xl" : "sm:max-w-md")}
      style={{ "--width": wide ? "42rem" : "28rem" } as CSSProperties}
    >
      <button
        slot="header-actions"
        onClick={onClose}
        aria-label="Aizvērt"
        className="rounded-lg p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-200"
      >
        <X className="size-5" aria-hidden />
      </button>
      {children}
    </WaDialog>
  );
}
