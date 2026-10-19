# Todo v2 tracked-case contract

The first tracked-case slice adds a server-owned persistence boundary for work that needs an outcome and ongoing follow-up rather than a single task:

- A tracked case has a concise title, explicit desired outcome, lifecycle state, and automation state.
- Optional deadlines are accepted only as a complete bundle: date, provenance type, provenance reference, and confidence. A date is never stored without its source and confidence.
- Tasks attach to a case as next actions or milestones. Dependency edges are restricted to tasks already attached to the same case and preserve open, satisfied, or explicitly waived state.
- Evidence stores a bounded summary plus source identity, observed time, and optional content hash. This slice intentionally stores no message or document body. Evidence rows and case-event rows are append-only.
- Exception escalations preserve severity, reason, acknowledgement, and resolution state. They may point to one dependency or evidence record, while still allowing a case-level exception.
- Browser roles have no direct table access.

## Authenticated lifecycle operations

- `GET /api/tracked-cases` lists the 200 most recently updated cases.
- `POST /api/tracked-cases` creates an outcome-first case after enforcing the complete deadline-provenance bundle.
- `GET /api/tracked-cases/:id` returns one case, its attached tasks, same-case dependency edges, and append-only event history.
- `PATCH /api/tracked-cases/:id` explicitly changes case fields, status, automation state, or the complete deadline bundle. Every update requires a human-readable reason and the caller's expected case version; stale updates fail with `409 Conflict`.
- `POST /api/tracked-cases/:id/tasks` attaches a task or explicitly changes its case role; `DELETE` detaches it. Both require a reason, and detach is rejected while any dependency still references the task.
- `POST /api/tracked-cases/:id/dependencies` creates an open directed edge between two distinct tasks already attached to that case. Duplicate open edges are rejected.
- `PATCH /api/tracked-cases/:id/dependencies/:dependencyId` irreversibly resolves an open edge as satisfied or waived with a required reason. Resolved edges remain in history.
- `POST /api/tracked-cases/:id/evidence` records bounded evidence metadata and an explicit versioned reconciliation rule. The deterministic action is one of: record only, satisfy one open dependency, or raise one evidence-linked exception. Source plus source ID is replay-safe: an exact replay returns the prior result without repeating a side effect, while changed data returns `409 Conflict`.
- `PATCH /api/tracked-cases/:id/escalations/:escalationId` acknowledges an open exception or resolves an open/acknowledged exception with a required reason. Resolved exceptions cannot be reopened.
- Creation and updates run through service-role-only database functions so event attribution, row locking, version checks, and mutation happen in one transaction. PIN-authenticated requests are attributed to `user`.

Evidence deliberately carries no free-text inference or connector-specific parsing. A caller must supply the reconciliation action and immutable rule ID; connector mapping remains item 5 work.

## Focused review UI

The authenticated v2 task workspace includes a Cases view that keeps one outcome in focus. It shows deadline provenance and confidence, linked work, dependency direction and state, metadata-only evidence with its reconciliation rule, open exceptions, and immutable case history. A single required review note gates explicit lifecycle changes, dependency satisfaction or waiver, and exception acknowledgement or resolution; stale lifecycle changes retain the API's expected-version conflict protection. Empty, loading, error, and mobile single-column states are explicit.

Migration 030 intentionally does not read production data, migrate legacy todos, or run automatically.
