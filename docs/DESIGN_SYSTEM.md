# Design system (V1.2)

The interface is built from a small set of tokens and primitives. Web Awesome
is used only where it excels (dialogs, toasts, progress bars); buttons, cards,
segmented controls and switches are native, fully accessible React components.

## Tokens (`src/styles/globals.css`)

| Token | Light | Dark |
|---|---|---|
| `--background` | `#f8f7f2` warm paper | `#121417` graphite |
| `--surface` / `--surface-raised` | `#ffffff` | `#1b1e23` / `#23272d` |
| `--line` | `#e4e1d9` | `#2d3138` |
| `--foreground` | `#1d1c18` | `#ececea` |
| `--text-muted` | `#6f6b62` | `#a2a8b0` |
| Brand | `#4f46e5` indigo | same |
| Success / Warning / Danger | emerald-600 / amber-400 / red-600 | emerald-400 / amber-400 / red-500 |

Radius: controls `0.5rem`, cards `0.75rem`, panels `1rem`. Shadows stay
subtle (`shadow-sm`) with layered surfaces instead of heavy outlines.

## Typography

- Font: Inter (self-hosted via `next/font`, OFL).
- Body 14–16px, secondary text ≥12px, section headings 18–24px.
- Avoids tiny 10–11px text for gameplay information; uppercase is reserved
  for word grids and short labels.

## Motion

- Transitions `150ms`; flip/shake/pop keyframes only for gameplay feedback.
- `prefers-reduced-motion` collapses animations to instant state changes.

## Primitives

- `Button` — native `<button>` (or `<a>` with `href`), variants
  primary/secondary/ghost/danger/outline, sizes sm/md/lg.
- `Card` — native surface panel.
- `Segmented` — native radiogroup with arrow-key navigation.
- `Switch` — native `role="switch"` toggle.
- `Dialog` / toast / progress — Web Awesome, with `--spacing` pinned to
  `0.25rem` inside the dialog host.

## Web Awesome integration note

WA component `:host` styles define `--spacing: var(--wa-space-l)` for their
own layout. That collides with Tailwind's `--spacing` token, so any WA
component that hosts slotted Tailwind-styled content must restore
`--spacing: 0.25rem` on the host (see `src/components/ui/dialog.tsx`).
