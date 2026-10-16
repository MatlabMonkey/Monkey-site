# Todo Command Center Gap Inventory

Date: 2026-10-07

Baseline: `origin/main` at `e2e8bb4`

## Shipped capabilities

- One-field capture into Inbox, split into Personal and Work contexts.
- Guided Inbox processing into Next, Projects, Waiting, Calendar, Someday, Reference, or Trash.
- Manually ordered Next actions, project-linked actions, scheduled Calendar items, Waiting notes, and recurring tasks.
- Responsive dark-first UI using the existing Ink + Paper tokens.

## Gaps against the command-center brief

| Capability | Baseline state | Smallest coherent next step |
| --- | --- | --- |
| Today-first execution | Missing; scheduled work appears only in Calendar or Next | Show incomplete overdue and scheduled-today actions near the top without changing storage |
| Assistant organization | Capture/service foundation is in draft PR #10; no complete Arias control surface | Finish the approved canonical service, then add deterministic list/move operations |
| Restart mode | Implemented in this branch without storage changes | Focus recovery on missed commitments, Inbox count, stale Waiting items, and a 10-minute cleanup path |
| Reviews | Inbox processing exists; daily/weekly review does not | Add a bounded daily review before designing a weekly score or ceremony |
| Areas | Only Personal/Work contexts exist | Keep deferred until real records establish whether areas differ from projects or contexts |
| Priority, energy, and time metadata | Missing | Add only fields proven useful by Today/Next usage; keep capture one-field |
| Audit history | Missing on `main`; append-only history is in draft PR #10 | Surface history only after the canonical events migration is validated and approved |

## Selected slice

This branch implements Today-first execution without a schema migration:

- Quick Capture remains a one-field action at the top.
- Today collects incomplete scheduled records from Next and Calendar.
- Overdue and scheduled-today items are ordered chronologically and retain their original GTD bucket.
- Completion uses the existing mutation path, so the original lists remain compatible.
- All other gaps remain explicit follow-up work; no new product taxonomy or architecture is introduced here.

## Restart-mode slice

Restart mode adds a focused, explicitly entered recovery view without changing capture or storage:

- Missed commitments are incomplete Next or Calendar records scheduled before today.
- Waiting items become stale after seven days without an update.
- The view shows those records plus the Inbox count in a forgiving 10-minute sequence.
- The normal dashboard is hidden while recovery is active and returns unchanged when the user exits.
- Empty recovery state confirms that no cleanup is needed; it does not manufacture work or due dates.
