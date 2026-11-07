"use client";

import WaRadioGroup from "@awesome.me/webawesome/dist/react/radio-group/index.js";
import WaRadio from "@awesome.me/webawesome/dist/react/radio/index.js";

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
    <WaRadioGroup
      value={value}
      label={ariaLabel}
      orientation="horizontal"
      size="s"
      onChange={(e) => onChange((e.target as { value?: string }).value as T)}
      className={"wa-sr-label " + (className ?? "")}
    >
      {options.map((o) => (
        <WaRadio
          key={o.value}
          value={o.value}
          appearance="button"
          checked={value === o.value}
        >
          {o.label}
        </WaRadio>
      ))}
    </WaRadioGroup>
  );
}
