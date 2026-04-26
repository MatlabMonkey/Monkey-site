# Website Cleanup Worklog

Last updated: 2026-04-25 18:09 PDT

## Current state

### Completed in this sprint
- Applied private-section nav to remaining contact subpages:
  - `/workspace/contacts/capture`
  - `/workspace/contacts/review`
  - `/workspace/contacts/[id]`
- Completed contact-flow shell consistency pass (header card and spacing alignment).
- Added milestone execution pack for cleanup issues/PRs:
  - `docs/projects/website-cleanup/MILESTONE_WAVE_EXECUTION_2026-04-25.md`
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
- Publish milestone issue set in GitHub from execution pack.
- Execute route canonicalization matrix in tracked PR units.
- Continue section-level consistency pass for any remaining edge pages.

## Next action
- Open the listed Wave 1 issues in GitHub and begin redirect matrix execution branch.
