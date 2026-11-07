import type { LucideIcon } from "lucide-react";
import { Card } from "./card";

export function Kpi({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="grid size-11 place-items-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-extrabold tabular-nums leading-tight">{value}</div>
        <div className="truncate text-xs font-medium text-stone-500 dark:text-stone-400">
          {label}
        </div>
        {hint ? (
          <div className="truncate text-[11px] text-stone-400 dark:text-stone-500">{hint}</div>
        ) : null}
      </div>
    </Card>
  );
}
