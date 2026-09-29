# Todo Capture V1

## Scope

V1 keeps `todos` as the only task record and preserves the existing GTD folders (`inbox`, `next_action`, `project`, `waiting_for`, `calendar`, `someday_maybe`, `reference`, and `trash`). Capture adds provenance and replay safety without introducing a second capture model or an asynchronous routing pipeline.

The deferred tables from the earlier branch are intentionally absent: capture records, assistant jobs, source registries, and routing rules.

## Canonical record

Every new todo may include:

- `source`: producer name, defaulting to `app`.
- `source_id`: the producer's stable identifier for the item.
- `idempotency_key`: the producer's stable identifier for the request.

`source_id` and `idempotency_key` are each unique within `(context, source)` when present. Normal in-app creation remains compatible because both identifiers are optional. All creation paths use `lib/server/todos.ts`; provenance cannot be changed through the update service.

The website API records `source=web`, the authenticated webhook defaults to `source=webhook`, and recurring items use a stable `recurring-id:scheduled-date` source identifier. A webhook retry with the same source identifier or idempotency key returns the original todo with `duplicate=true` and HTTP 200. A first creation returns HTTP 201.

## Event history

Database triggers append `todo.created`, `todo.updated`, and `todo.deleted` snapshots to `todo_events`, including the todo ID and source. The event table has no foreign key that would erase history when a todo is deleted. Update and delete operations on event rows are rejected, and public access is closed by row-level security. Trusted server code can read events with the existing service role.

## Migration and rollout

Migration `027_todo_provenance_and_events.sql` backfills existing rows with `source=app`, adds the uniqueness constraints, creates the event table, and installs its triggers. It does not synthesize historical events for changes made before migration 027.

Before deployment, apply the migration in a non-production Supabase environment, run the todo capture tests, and verify one new capture, one retry, one update, and one deletion event. Production migration and deployment require separate approval.
