"use client";

export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={
        "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 " +
        (checked ? "bg-indigo-600" : "bg-stone-300 dark:bg-stone-600")
      }
    >
      <span
        className={
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all " +
          (checked ? "left-6" : "left-1")
        }
      />
    </button>
  );
}
