"use client";

import WaSwitch from "@awesome.me/webawesome/dist/react/switch/index.js";

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
    <WaSwitch
      id={id}
      checked={checked}
      title={label}
      aria-label={label}
      onChange={(e) =>
        onCheckedChange(Boolean((e.target as { checked?: boolean }).checked))
      }
      className="shrink-0"
    />
  );
}
