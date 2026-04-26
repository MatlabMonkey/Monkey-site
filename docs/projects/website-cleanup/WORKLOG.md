# Website Cleanup Worklog

Last updated: 2026-04-25 17:24 PDT

## Current state

### Completed in this sprint
- Added `/ops/usage` as canonical usage surface and wired permanent redirect `/arias -> /ops/usage`.
- Added production-only redirects for `/test-env` and `/test-supabase` to `/`.
- Rewrote `/about` to a clean production-ready page.
- Removed legacy Arias card from homepage tools grid.
- Introduced shared private-section navigation component:
  - `app/components/PrivateSectionNav.tsx`
- Applied nav consistency across:
  - core pages: `/journal`, `/todos`, `/workspace`, `/ops`
  - secondary pages: `/journal/search`, `/journal/explorer`, `/workspace/contacts`, `/workspace/ideas`

### Verification status
- Lint: passes (warnings only, no blocking errors)
- Build: passes

### Recent commits
- `a877db7` Add `/ops/usage` route + redirects
- `c38c759` Rewrite `/about` and remove legacy Arias card
- `d2f1d39` Unify private section nav across core surfaces
- `eeb81de` Extend private section nav to journal/workspace secondary pages

## Remaining cleanup items
- Apply private-section nav to remaining workspace contact subpages (`/workspace/contacts/capture`, `/workspace/contacts/review`, `/workspace/contacts/[id]`).
- Continue shell and section-level visual consistency pass.
- Convert architecture cleanup waves into executable milestone issues/PRs (using templates).

## Next action
- Start full implementation of Adderall XR visualizer under `/tools` while preserving this cleanup stream as active-but-stable.
