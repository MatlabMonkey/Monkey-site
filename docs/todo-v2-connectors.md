# Todo v2 connector ingestion

The first connector slice accepts authenticated, email-shaped events at `POST /api/connector-events/email`. It does not connect an email account or parse free text. A trusted caller supplies an explicit versioned rule and one deterministic signal:

- `advance` satisfies one named open dependency.
- `block` records a warning exception and places the case in `blocked` / `awaiting_approval`.
- `complete` records evidence and places the case in `completed` / `finished`.

## Provenance and privacy boundary

Each event records the provider, external event ID, message ID, optional thread ID, observed timestamp, SHA-256 content digest, bounded summary, signal, and rule. Message bodies, subjects, sender/recipient addresses, attachments, and credentials are not accepted or stored.

The provider plus external event ID is the idempotency identity. Ingestion takes an advisory transaction lock before any side effect. An exact replay returns the existing event with `replayed: true`; reuse of that identity with different provenance, signal, target, or content returns `409 Conflict`. The connector receipt, evidence, dependency/escalation effect, and case lifecycle change commit in one database transaction.

Browser roles have no direct access to connector events or the ingestion function. The API uses the existing PIN-authenticated server boundary and service role. Migration 031 does not read production data or run automatically.

Mobile/Shortcut capture verification remains a separate item-5 work unit. No external account is connected by this slice.
