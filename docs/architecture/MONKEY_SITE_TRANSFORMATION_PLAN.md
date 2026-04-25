# Monkey-site Transformation Plan

## Status Snapshot (2026-04-25)
- Deep-dive Codex audit workers for IA/UX/technical boundaries failed with internal runtime errors and returned no content.
- One high-level transformation planning pass completed and produced the strategy below.
- This plan is now the canonical working draft.

## Decision: Recommended Path
**Choose Option A: Incremental Cleanup (strangler inside current app).**

Why:
- Core stack and product surfaces are already working.
- Primary problem is cohesion/architecture drift, not total platform failure.
- Preserves momentum and allows weekly visible progress.

---

## Option A — Incremental Cleanup (Recommended)

### Scope
- Keep current app and data model.
- Introduce cohesive IA + shared app shell.
- Refactor domain-by-domain (Todos, Workspace, Journal, Ops, Tools).
- Standardize API/service boundaries.

### Timeline
- ~6–10 weeks to cohesive v1.

### Risks
- Legacy complexity persists during transition.
- Architecture can drift if PR gates are weak.

### Choose A if
- You want continuous shipping with minimal downtime.
- Existing features must remain live.

---

## Option B — Rebuild/Migration

### Scope
- Build parallel clean architecture and migrate features.

### Timeline
- ~10–16 weeks for parity and cutover.

### Risks
- Slower visible progress.
- Dual-maintenance and migration fatigue.

### Choose B if
- Major product pivot (multi-user SaaS/public product) is immediate.

---

## Target Product IA (North Star)
- Home (public)
- Journal
- Todos
- Workspace
- Ops
- Tools
- Reports
- Questions (public)

Notes:
- Remove/hide debug/test surfaces from production.
- Consolidate legacy/overlap pages (e.g., usage surfaces under Ops).

---

## 30 / 60 / 90 Roadmap

## Days 0–30: Skeleton
- Canonical IA doc + route taxonomy.
- Shared private app shell (nav/header/layout).
- Shared data-state primitives (loading/error/empty/success).
- Standard page shell for all private sections.

**Gate:** lint/build pass; all touched pages use shared shell/patterns.

## Days 31–60: Domain Refactor
- Break large pages into domain modules/components.
- Move data access behind service boundaries.
- Standardize API response envelopes and typing.

**Gate:** no new monolith pages; primary domains use modular services.

## Days 61–90: Cohesion + Cleanup
- Remove/redirect stale routes.
- Complete cross-product navigation consistency.
- Final architecture docs + enforcement in PR checklist.

**Gate:** new features can be added via documented patterns without ad-hoc architecture.

---

## Do This Week (Immediate)
1. Create route inventory with keep/merge/delete/redirect decisions.
2. Define and ship shared private app shell.
3. Pick first pilot domain:
   - Safe first: Workspace
   - Highest leverage: Todos
4. Hide/remove test routes from production flow (`/test-env`, `/test-supabase`).
5. Add PR acceptance gates for architecture cohesion.
6. Move/standardize any overlapping legacy sections under canonical domains.

---

## Operating Rules
- Project-specific docs/specs live in this project repo.
- Telegram for decisions/approvals/status.
- GitHub/issues/PRs for durable implementation history.
