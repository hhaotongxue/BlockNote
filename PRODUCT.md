# Product context

## Register

Product UI: a reusable block editor and shared editor preset.

## Users and purpose

People writing, reading and editing documents in Lianshu and other consumers of this fork. The preset owns editor controls and appearance; consumers connect storage and business callbacks.

## Design direction

Quiet, compact and content-first. Follow the existing light and dark editor themes. For media cards, the reference is Loomart: a simple proportional media surface, controls revealed on hover, and a floating settings panel opened explicitly.

## Principles

- Keep document content visible; settings float without changing document layout.
- Avoid permanent toolbars, upload instructions and generation forms on media cards.
- Preserve keyboard focus, accessible control labels and reduced-motion support.
- Reuse public editor APIs and themed portal infrastructure.
- Keep changes in the shared preset, following `docs/lianshu/style-policy.md`.
