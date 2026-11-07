"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible segmented control (native radiogroup). Avoids Web Awesome here:
 * the wa-radio-group host rules redefined `--spacing`, breaking Tailwind
 * sizing, and its button appearance produced cramped, touching labels.
 */
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
  const groupRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-stone-200/80 p-1 dark:bg-stone-800",
        className,
      )}
    >
      {options.map((o, index) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const dir =
                e.key === "ArrowRight" || e.key === "ArrowDown"
                  ? 1
                  : e.key === "ArrowLeft" || e.key === "ArrowUp"
                    ? -1
                    : 0;
              if (!dir) return;
              e.preventDefault();
              const next = (index + dir + options.length) % options.length;
              onChange(options[next].value);
              requestAnimationFrame(() => {
                const node = groupRef.current?.querySelectorAll<HTMLElement>(
                  '[role="radio"]',
                )[next];
                node?.focus();
              });
            }}
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500",
              selected
                ? "bg-white text-stone-900 shadow-sm dark:bg-stone-600 dark:text-white"
                : "text-stone-600 hover:bg-white/60 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-700/60 dark:hover:text-stone-200",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
