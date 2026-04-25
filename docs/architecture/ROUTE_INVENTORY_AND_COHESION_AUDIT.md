# Route Inventory & Cohesion Audit

Date: 2026-04-25

## Objective
Identify floating pages, overlaps, and IA gaps; propose a cohesive target route model and migration actions.

## Current Route Inventory (App Pages)

### Core product surfaces (keep)
- `/` (public launcher/home)
- `/journal`
- `/todos`
- `/workspace`
- `/ops`
- `/tools`
- `/questions` (public intake + display)

### Core sub-surfaces (keep, may reorganize)
- `/journal/explorer`
- `/journal/search`
- `/workspace/contacts`
- `/workspace/contacts/[id]`
- `/workspace/contacts/capture`
- `/workspace/contacts/review`
- `/workspace/ideas`
- `/tools/bac`
- `/tools/meal-prep`
- `/tools/workout`
- `/tools/pd-controller`
- `/ops/projects/[projectKey]`
- `/reports/[slug]`
- `/todos/process`

### Legacy/overlap (merge/relocate)
- `/arias` (usage-oriented dashboard overlaps with Ops visibility)

### Test/debug (remove from production surface)
- `/test-env`
- `/test-supabase`

### Non-cohesive content (rewrite or remove)
- `/about` (placeholder content and tone mismatch)

---

## Floating/Orphan Candidates (from static-link scan)
Routes with zero static incoming links from `href="/…"` and `router.push("/…")`:
- `/about`
- `/ops/projects/[projectKey]` *(likely reached via dynamic links from Ops page)*
- `/reports/[slug]` *(likely reached via dynamic links from Ops/Reports)*
- `/test-env`
- `/test-supabase`
- `/todos/process`
- `/workspace/contacts/review`

Interpretation:
- Some are true floaters (`/about`, test pages).
- Some are dynamic-route false positives and still valid.

---

## IA Problems
1. Top-level has a legacy overlap (`/arias`) that fragments the product story.
2. Debug/test pages live as first-class routes in production code tree.
3. No explicit canonical route map exists in repo docs.
4. Route naming reflects history rather than product architecture.
5. Public/private boundary is implicit, not product-documented.

---

## Proposed Target Sitemap (Cohesive)

## Public
- `/` Home/entry
- `/questions` (public Q&A intake/display)
- `/about` (optional, only if rewritten with real purpose)

## Private product
- `/journal`
- `/todos`
- `/workspace`
- `/ops`
- `/tools`
- `/reports/[slug]`

### Consolidation rule
- Move usage/agent analytics from `/arias` into Ops (`/ops/usage`) and deprecate `/arias`.

---

## Keep / Merge / Remove Actions

## Keep
- Journal, Todos, Workspace, Ops, Tools, Questions routes.
- Domain subroutes already powering workflows.

## Merge / Relocate
- `/arias` → `/ops/usage`.

## Remove or guard
- `/test-env`, `/test-supabase`:
  - either delete, or
  - guard to non-production only (`NODE_ENV !== 'production'`) and remove all discoverability.

## Rewrite decision
- `/about`:
  - rewrite with product-consistent voice and purpose, or
  - remove route entirely.

---

## Redirect Notes
If/when route moves happen:
- `301 /arias -> /ops/usage`
- optional: `301 /about -> /` if removed
- no redirect needed for test routes (prefer hard removal/guard)

Implement redirects in `next.config.ts` when cutover happens.

---

## Immediate Low-Risk Wave (next PRs)
1. Add `docs/architecture/ROUTE_MAP.md` canonical route table.
2. Create `/ops/usage` shell route and keep `/arias` temporarily.
3. Add non-production guard to `/test-env` and `/test-supabase`.
4. Decide `/about` keep-vs-remove.
5. Follow with `/arias` deprecation redirect.
