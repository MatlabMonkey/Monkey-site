# Ops Dashboard — Design + Functionality Audit

Date: 2026-04-26

## Core diagnosis

Current Ops UX looks like a generic dashboard shell instead of a workflow tool. It surfaces counts and lists, but weakly supports the core loop: **capture update -> publish artifact -> review status -> decide next action**.

## What feels off today

1. **Snapshot-heavy, decision-light**
   - Cards (projects/reports/runs/checkpoints/tasks) look informative but do not drive next action.
2. **Low signal hierarchy**
   - "Global Focus Snapshot" and "Recent Reports" compete with project execution controls.
3. **Artifact model mismatch**
   - Workflow currently assumes reports inside dashboard pages, while real working flow often starts with generated HTML artifacts and local iteration.
4. **Project cards lack operational affordances**
   - Need direct actions: open latest artifact, open repo, post checkpoint, create task.
5. **Mobile readability is weak**
   - Dense cards and multi-panel summaries are hard to scan quickly.

## Product direction (recommended)

### 1) Reframe Ops around an execution pipeline

Primary sections:
- **Now** (current project, blocker, next action)
- **Ship** (latest artifacts + publish controls)
- **Projects** (compact rows with quick actions)
- **History** (reports/checkpoints/task log)

### 2) Treat HTML artifacts as first-class outputs

For each project:
- `latest_artifact_url`
- `artifact_type` (html/md/link)
- `artifact_status` (draft/published/stale)
- optional `render_hint` (embed/raw/open)

This supports your current "generate local HTML then open" flow while still integrating with dashboard visibility.

### 3) Replace static KPI cards with action cards

Example:
- "2 projects missing checkpoint in 48h" -> button: "Post checkpoint"
- "1 project has stale report (>7d)" -> button: "Generate report"

### 4) Prioritize project table over decorative overview

Suggested project row fields:
- Project name
- Status
- Last checkpoint age
- Latest artifact link
- Repo link
- Next action
- Quick buttons: `Checkpoint`, `Task`, `Open`, `Archive`

### 5) Mobile-first mode

- Single-column project feed
- Sticky top action bar (`+ Checkpoint`, `+ Task`, `Open latest`)
- Condense metadata to one line per project

## Concrete implementation plan

### Phase 1 (fast, 1 pass)
- Compress top summary cards into one slim strip.
- Move "Active Projects" to top and make it dominant.
- Add per-project quick actions for checkpoint/task/open latest report.

### Phase 2
- Add first-class artifact fields and "latest artifact" button in project rows.
- Add stale/at-risk badges (no checkpoint >48h, no report >7d).

### Phase 3
- Add timeline feed per project (artifact, checkpoint, task events in one stream).
- Add "decision mode" summary card that only shows items requiring action.

## Notes on your concern (dependencies on dashboard)

You are right: if artifact rendering depends on dashboard wiring/deps, it creates friction.
Best path is:
- Keep generated HTML as independent artifact (open directly).
- Store link + metadata in Ops for tracking/communication.
- Dashboard should index and route, not tightly own rendering.
