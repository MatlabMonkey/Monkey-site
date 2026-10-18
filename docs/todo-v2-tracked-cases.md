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
- Creation and updates run through service-role-only database functions so event attribution, row locking, version checks, and mutation happen in one transaction. PIN-authenticated requests are attributed to `user`.

Deterministic evidence reconciliation and escalation, and the review UI remain separate bounded work.

Migration 030 intentionally does not read production data, migrate legacy todos, or run automatically.
