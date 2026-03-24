# Reporting Policy (MVP)

This document defines when **Run Log drafts** are auto-created, how to force creation manually, and how slugs are generated.

## Two-layer reporting model

1. **Ops Run Log (`ops_runs`)**
   - Lightweight execution log for a work cycle.
   - Tracks status (`draft` / `published`), trigger metadata, checks, metrics, artifacts, and next steps.
   - Can link to a deeper technical report.

2. **Deep Report (`project_reports` + `work_reports`)**
   - Rich technical report (HTML/MD/PDF/link), typically with detailed analysis, figures, and methods.
   - Canonical site route: `/reports/{slug}` when slugged.

---

## Auto-draft timing policy (for `ops_runs`)

Policy module: `lib/server/reportPolicy.ts`

Primary entrypoints:
- `scoreRunLogDraftPolicy(...)`
- `evaluateUpdateAsRunLogCandidate(...)`

### Inputs
From recent `work_updates` rows:
- `status` (especially `shipped`, `needs_review`)
- commit range presence (`commit_start` + `commit_end`)
- `files_touched` count
- `project_key` presence
- elapsed hours since last run log for the same project

### Scoring rules (confidence 0–100)

Base from status:
- `shipped`: **+45**
- `needs_review`: **+32**
- other statuses: informational only (outside auto policy)

Additional signals:
- commit range present: **+15**
- files touched:
  - >=12: **+18**
  - >=6: **+12**
  - >=1: **+6**
  - none: +0 with reason note
- project key present: **+12**
- project key missing: **-25** (blocks auto-draft)

Time since last run log:
- none exists: **+18**
- >=72h: **+20**
- >=24h: **+12**
- >=8h: **+5**
- <8h: **-8**

Final confidence is clamped to `[0,100]`.

### Auto-create decision
`shouldCreateDraft = true` iff:
- status is in `{shipped, needs_review}`
- `project_key` exists
- `confidence >= 60`
- no existing run log already tied to that `work_updates.id`

---

## Candidate evaluation endpoint

`GET /api/ops/runs/candidates`

Returns:
- evaluated updates
- policy metadata (`eligible_statuses`, threshold)
- candidate rows with:
  - `shouldCreateDraft`
  - `confidence`
  - `reasons[]`
  - proposed draft payload

Query params:
- `project` (optional)
- `limit` (optional)

---

## Manual force creation

Use:

`POST /api/ops/runs/from-update`

Body:
```json
{
  "update_id": "<work_update_uuid>",
  "force": true,
  "trigger_source": "manual"
}
```

- With `force: true`, a draft run log is created even if policy confidence is below threshold.
- Without force, endpoint returns conflict when policy rejects.

---

## Slug strategy

Slug util: `lib/server/slugStrategy.ts`

### Base format

`{projectKey}-{date}-{shortTitle}`

Example:

`koopman-mpc-2026-03-21-actuator-lag-sweep`

### Rules
- lowercase
- dash-separated
- non-alphanumeric collapsed to `-`
- trimmed to max length

### Collision handling
If slug already exists:
- append numeric suffix: `-2`, `-3`, ...
- keep uniqueness checks deterministic with bounded attempts

Used by:
- run logs (`ops_runs.slug`)
- deep/site reports (`work_reports.slug`)

---

## Publishing flow in UI

Project page (`/usage/projects/[projectKey]`):
- Run Logs section shows Draft vs Published state.
- Draft rows include **Quick publish** action.
- Trigger confidence + trigger reasons are shown.
- If linked deep report exists, row shows deep report link.

Report page (`/reports/{slug}`):
- HTML reports include an **Open raw HTML view** link.
- Raw mode route is `/reports/raw/{slug}` and serves the stored `html_content` full-page (no dashboard wrapper), using `asset_base_url` for relative asset resolution.
