"use client";

import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  href?: string;
  target?: "_blank" | "_parent" | "_self" | "_top";
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";

const SIZE: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

const VARIANT: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400",
  secondary:
    "bg-stone-200 text-stone-900 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-100 dark:hover:bg-stone-600",
  ghost:
    "bg-transparent text-stone-700 hover:bg-stone-200/70 dark:text-stone-200 dark:hover:bg-stone-800/70",
  danger: "bg-red-600 text-white hover:bg-red-500 dark:hover:bg-red-400",
  outline:
    "border border-stone-300 bg-transparent text-stone-800 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", href, target, ...props },
  ref,
) {
  const classes = cn(BASE, SIZE[size], VARIANT[variant], className);
  if (href) {
    return (
      <a
        href={href}
        target={target}
        className={classes}
        {...(props as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target">)}
      />
    );
  }
  return <button ref={ref} className={classes} {...props} />;
});
