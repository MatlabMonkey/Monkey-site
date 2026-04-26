# Website Cleanup — Milestone Wave Execution Pack

Last updated: 2026-04-25 18:09 PDT

This file converts the transformation plan into executable GitHub issue + PR units.
Use `.github/ISSUE_TEMPLATE/work-item.yml` and `.github/pull_request_template.md` for each item.

## Milestone: IA Cohesion Wave 1 (Stabilize canonical surfaces)

### Issue 1 — Contacts subpage navigation completion
- **Work type:** Refactor
- **Goal:** Apply shared private-section navigation to remaining contacts subpages and keep route-level UX consistent.
- **Context:** Core and several secondary pages already use `PrivateSectionNav`; contacts subpages were the remaining gap.
- **Definition of done:**
  - [ ] `/workspace/contacts/capture` shows shared private nav
  - [ ] `/workspace/contacts/review` shows shared private nav
  - [ ] `/workspace/contacts/[id]` shows shared private nav
  - [ ] Lint/build pass
- **Notes / non-goals:** No backend/data-model changes.

### PR draft for Issue 1
- **Title:** `refactor(workspace): complete private nav on contact subpages`
- **Type of change:** Refactor
- **Validation:** lint + build + manual navigation smoke test
- **Risks/rollback:** low; rollback by reverting 3 page files

---

### Issue 2 — Contact flow shell consistency pass
- **Work type:** Refactor
- **Goal:** Align contact capture/review/detail page headers/shell styling with canonical private page pattern.
- **Context:** Header cards and hierarchy varied across these subpages.
- **Definition of done:**
  - [ ] capture/review/detail pages use consistent rounded header shell
  - [ ] spacing and action grouping consistent with workspace style
  - [ ] no regression in edit/save/delete flows
  - [ ] Lint/build pass
- **Notes / non-goals:** No form-field schema changes.

### PR draft for Issue 2
- **Title:** `refactor(workspace): unify contacts subpage shell styling`
- **Type of change:** Refactor
- **Validation:** lint + build + manual create/edit/delete smoke test
- **Risks/rollback:** low; rollback by reverting style/header edits

---

### Issue 3 — Route governance + cleanup execution board
- **Work type:** Docs
- **Goal:** Create the durable execution board for remaining route cleanup and redirects.
- **Context:** Transformation plan exists but needed issue/PR-level tasks for execution tracking.
- **Definition of done:**
  - [ ] route cleanup tasks listed with owner/status/checkpoints
  - [ ] each task maps to a PR unit
  - [ ] clear redirect matrix references for implementation
- **Notes / non-goals:** This is planning/coordination only.

### PR draft for Issue 3
- **Title:** `docs(architecture): add wave execution board for route cleanup`
- **Type of change:** Docs
- **Validation:** docs reviewed for completeness
- **Risks/rollback:** none

---

## Milestone: IA Cohesion Wave 2 (route canonicalization)

### Issue 4 — Redirect matrix execution
- **Work type:** Refactor
- **Goal:** Execute keep/merge/remove route decisions from architecture docs with explicit redirects.
- **Context:** `/arias` migration and test-route lockouts are done; remaining route governance should be completed in tracked units.
- **Definition of done:**
  - [ ] obsolete routes either redirected or removed per matrix
  - [ ] all redirects tested locally
  - [ ] no broken top-level nav links
  - [ ] lint/build pass
- **Notes / non-goals:** avoid changing intended public endpoints.

### PR draft for Issue 4
- **Title:** `refactor(routes): execute canonical redirect matrix`
- **Type of change:** Refactor
- **Validation:** lint + build + redirect smoke checks
- **Risks/rollback:** medium; rollback via `next.config.ts` revert + route restore

---

## Suggested execution order
1. Issue 1 + Issue 2 (same sprint)
2. Issue 3 (durable tracking artifact)
3. Issue 4 (matrix execution)
