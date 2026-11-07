# Lingo & Karogs V1.2 — release notes

## Highlights

- **Web Awesome defect fixed.** WA `wa-card`/`wa-dialog` host styles were
  redefining Tailwind's `--spacing` token, multiplying every spacing value
  inside cards and dialogs by six (264px inputs, 120px card padding, huge
  dialogs, mobile overflow). Shared controls returned to native, accessible
  implementations; WA remains only for dialogs, toasts and progress bars with
  the token pinned back.
- **Lingo input repaired.** Accepted guesses now clear synchronously;
  duplicate words are rejected with "Šo vārdu jau mēģināji." without losing an
  attempt; invalid words stay editable; rapid Enter can no longer double-submit.
- **Karogs instant play.** A balanced 40-piece army is pre-filled on a fresh
  visit; "Sākt kauju" works immediately. Formation picker and manual
  customization live behind collapsible panels, drag-and-drop actually works
  (drops use the dragged piece, never stale selection), and the AI game gains
  a desktop side panel with turn, selected unit and battle log.
- **Honest saved-state UX.** Schema-versioned game saves with validation,
  legacy migration and per-key recovery; settings list every saved game with
  continue/delete actions; completed games always offer a new game.
- **Polish.** New 4-row Latvian keyboard (≥22px keys at 320px), readable mode
  cards, warm/graphite theme tokens, enemy-colored face-down pieces, stats
  empty state, polished unavailable-online state, fixed hydration mismatches.

## Tests

- Vitest: 97 unit/integration tests (engines, AI, data, multiplayer,
  formations, storage envelope).
- Playwright: 59 scenarios — functional (Lingo/Karogs/multiplayer),
  responsive, geometry, axe accessibility (zero critical/serious) and visual
  regression with reviewed baselines.
- Production smoke: 9/9 checks against the live deployment.

## Known limitations

- Online multiplayer remains disabled in production until Supabase
  credentials are configured in the Vercel project (see README).
- 320px boards use a compact keyboard (≈22px keys) and zoom/pan for Karogs;
  full-size touch targets are not physically possible at that width.
- Landscape phones scroll vertically; that is intentional.
