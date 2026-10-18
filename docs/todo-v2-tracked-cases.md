# Todo v2 tracked-case contract

The first tracked-case slice adds a server-owned persistence boundary for work that needs an outcome and ongoing follow-up rather than a single task:

- A tracked case has a concise title, explicit desired outcome, lifecycle state, and automation state.
- Optional deadlines are accepted only as a complete bundle: date, provenance type, provenance reference, and confidence. A date is never stored without its source and confidence.
- Tasks attach to a case as next actions or milestones. Dependency edges are restricted to tasks already attached to the same case and preserve open, satisfied, or explicitly waived state.
- Evidence stores a bounded summary plus source identity, observed time, and optional content hash. This slice intentionally stores no message or document body. Evidence rows and case-event rows are append-only.
- Exception escalations preserve severity, reason, acknowledgement, and resolution state. They may point to one dependency or evidence record, while still allowing a case-level exception.
- Browser roles have no direct table access. Authenticated server lifecycle operations, deterministic reconciliation, and the review UI remain separate bounded work.

Migration 030 intentionally does not read production data, migrate legacy todos, or run automatically.
