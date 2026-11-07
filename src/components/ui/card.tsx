"use client";

import WaCard from "@awesome.me/webawesome/dist/react/card/index.js";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <WaCard
      appearance="outlined"
      className={cn("rounded-2xl bg-white shadow-sm dark:bg-stone-900", className)}
      {...(props as Record<string, unknown>)}
    />
  );
}
