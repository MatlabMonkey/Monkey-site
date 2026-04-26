# Todos GTD UX Audit — Worklog

Last updated: 2026-04-25 19:59 PDT

## Trigger
User feedback: current GTD implementation works functionally but feels like "a to-do list with folders" rather than a guided GTD workflow.

## What was reviewed
- `app/todos/page.tsx` (dashboard/board experience)
- `app/todos/process/page.tsx` (clarify mode)
- `app/api/todos/process/route.ts`
- `lib/server/todos.ts` (`processTodo` outcome mapping)

## Notes
- Attempted Codex audit run, but CLI quota error blocked it.
- Continued with in-session audit and produced architecture + UX recommendations.
- Logged incident details in `docs/ops/model-runtime-issues.md`.

## Current output
- `docs/projects/todos-gtd-ux-audit/AUDIT_2026-04-25.md`

## Next step
- ✅ Phase 1 started and shipped:
  - `app/todos/process/page.tsx` moved to guided GTD decision flow (question-by-question)
  - `app/todos/page.tsx` reframed to process-first dashboard with bucket nav de-emphasized
- Follow-up: collect usage feedback and tune wording/step friction.
