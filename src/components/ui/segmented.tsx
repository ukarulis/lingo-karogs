"use client";

import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-stone-200/80 p-1 dark:bg-stone-800",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
            value === o.value
              ? "bg-white text-stone-900 shadow-sm dark:bg-stone-600 dark:text-white"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
