import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = "primary", size = "md", ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          size === "sm" && "h-9 px-3 text-sm",
          size === "md" && "h-11 px-5 text-sm",
          size === "lg" && "h-13 px-7 text-base",
          variant === "primary" &&
            "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500",
          variant === "secondary" &&
            "bg-stone-200 text-stone-900 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-100 dark:hover:bg-stone-600",
          variant === "ghost" &&
            "bg-transparent text-stone-700 hover:bg-stone-200/70 dark:text-stone-200 dark:hover:bg-stone-800/70",
          variant === "danger" &&
            "bg-red-600 text-white hover:bg-red-500",
          variant === "outline" &&
            "border border-stone-300 bg-transparent text-stone-800 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800",
          className,
        )}
        {...props}
      />
    );
  },
);
