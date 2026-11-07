# UX audits V1.2

Measurement-driven audits performed with a real Chromium browser
(`scripts/audit-ux.mjs` + Playwright geometry probes) before and after the
V1.2 redesign. Screenshots from the audit runs live in
`docs/screenshots/v1.2/audit/`.

## Before V1.2 — defects found

| Severity | Area | Finding | Root cause |
|---|---|---|---|
| Critical | Shared components | Nickname input rendered 264px tall; card padding became 120px; dialogs inflated | Web Awesome `wa-card` / `wa-dialog` `:host` styles redefine `--spacing: var(--wa-space-l)` (24px). Tailwind's spacing utilities (`h-11`, `px-3`, `p-5`, `space-y-*`) resolve against `--spacing`, so every spacing value inside WA cards/dialogs multiplied by 6. |
| Critical | Settings / Statistics | Horizontal overflow 164–716px on 320–430px screens | Same `--spacing` corruption bloated cards and gaps beyond the viewport. |
| High | Lingo mode selector | Tab labels touched (0px gap), 14px text, WA radio-button appearance | Replaced by native, accessible segmented control with 4px gaps and roomier padding. |
| High | Lingo keyboard | Smallest key 12px wide at 320px (a sliver) | One flex row packed 13 keys; additionally the V1.2 grid fix exposed a spacer-track bug where the `a` key landed in a 0.5fr track. New layout: dedicated diacritics row, ≥22px keys at 320px. |
| High | Lingo input | The same word could be submitted repeatedly; input was retained across rounds | `use-guess-input` never cleared the buffer after submission; the engine had no duplicate guard. Fixed with explicit accept/reject semantics and a `duplicate-word` engine error. |
| High | Homepage / Settings | React hydration mismatches ("server rendered HTML didn't match") | Components read localStorage during render. Fixed by deferring storage reads until after mount. |
| High | Karogs setup | Desktop drag-and-drop did not work | Tray buttons were HTML5 `draggable`; a native drag captured the pointer stream so the board never received `pointerup`. The drop handler also read stale React selection state instead of the dragged piece. |
| Medium | Karogs onboarding | Dense 40-piece manual setup was the default experience | Fresh visits now auto-fill a balanced formation; manual customization is hidden behind "Pielāgot izvietojumu". |
| Medium | Karogs AI | Resume of old sessions felt like a stuck game | Resume notice with "Turpināt spēli" / "Jauna spēle" choices. |
| Medium | Online play | Unavailable multiplayer showed a create-room form that failed with 503 | Polished "pagaidām nav pieejama" state driven by `/api/health`. |
| Medium | Statistics | Dense dashboard, no empty state | Empty-state call-to-action, overflow-safe bars, min-width guards. |
| Medium | Landscape phones | Board taller than a 320px viewport | Acceptable scrolling compromise; vertical gaps tightened on small screens. |

## After V1.2 — verified results

- Mode-selector gaps ≥4px, zero overlaps at 320/375/1280px (geometry E2E).
- Nickname input height 38–56px at all tested viewports (geometry E2E).
- Zero horizontal overflow on `/`, `/lingo`, `/karogs`, `/iestatijumi`,
  `/statistika` at 320–1920px (audit + geometry E2E).
- Keyboard keys ≥22px wide at 320px; full Latvian alphabet accessible.
- axe: zero critical/serious violations across 7 routes × 2 viewports.
- Zero console errors in production smoke tests.
