"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import WaButton from "@awesome.me/webawesome/dist/react/button/index.js";
import type WaButtonElement from "@awesome.me/webawesome/dist/components/button/button.js";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  href?: string;
  target?: "_blank" | "_parent" | "_self" | "_top";
}

const VARIANT: Record<
  NonNullable<ButtonProps["variant"]>,
  { variant: "brand" | "neutral" | "danger"; appearance: "filled" | "outlined" | "plain" }
> = {
  primary: { variant: "brand", appearance: "filled" },
  secondary: { variant: "neutral", appearance: "filled" },
  ghost: { variant: "neutral", appearance: "plain" },
  danger: { variant: "danger", appearance: "filled" },
  outline: { variant: "neutral", appearance: "outlined" },
};

const SIZE: Record<NonNullable<ButtonProps["size"]>, "s" | "m" | "l"> = {
  sm: "s",
  md: "m",
  lg: "l",
};

export const Button = forwardRef<WaButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", href, target, ...props },
  ref,
) {
  return (
    <WaButton
      ref={ref}
      variant={VARIANT[variant].variant}
      appearance={VARIANT[variant].appearance}
      size={SIZE[size]}
      href={href}
      target={target}
      className={cn("inline-flex items-center justify-center gap-2 font-semibold", className)}
      {...(props as Record<string, unknown>)}
    />
  );
});
