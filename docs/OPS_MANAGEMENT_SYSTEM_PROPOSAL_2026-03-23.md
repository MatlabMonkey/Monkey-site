# Ops Management System Proposal (OpenClaw + Project Dashboard)

Date: 2026-03-23
Owner: Arias

## Why this proposal
Current state gives visibility but still mixes:
- quick execution updates,
- deep technical/research reporting,
- and planning/project lifecycle.

Result: too much context switching and poor mobile readability for big outputs.

This proposal defines a **sophisticated but practical ops system** that supports both fast execution and deep review.

---

## Research grounding (what good teams do)

## 1) SRE-style reliability framing
From Google SRE guidance:
- Measure reliability and alert on meaningful events (not noise)
- Track precision/recall of alerting logic
- Use structured incident/postmortem flows

Ops implication for us:
- Report trigger engine should optimize for **high precision** (few useless reports) and acceptable recall.
- Use confidence + reason traces for every auto-generated run report candidate.

## 2) DevOps measurement discipline
Common high-performing teams track deployment and recovery metrics (DORA-style patterns), and separate operational status from deep technical docs.

Ops implication for us:
- Distinct layers:
  - run logs (ops telemetry)
  - deep reports (project/research narratives)
- Tie every run to concrete artifacts: commits, checks, metrics, plots.

## 3) OpenClaw-specific orchestration best practices
From OpenClaw docs and operating behavior:
- Subagents are great for long async tasks, but must report completion with useful summary.
- Parallel work should remain traceable across sessions.

Ops implication for us:
- Standardized completion payload from Codex/subagents should feed run-log drafting.
- Keep explicit project context (`project_key`) across tasks/updates/reports.

---

## Proposed system architecture

## Layer A: Project Index (command surface)
Route: `/usage`

Purpose:
- Active/archived project lifecycle
- Project health snapshot
- Fast navigation

Each project card shows:
- status (active/archived)
- last activity
- open tasks count
- latest run log status
- latest deep report timestamp

## Layer B: Project Workspace (execution view)
Route: `/usage/projects/[projectKey]`

Purpose:
- day-to-day execution and review in one project scope

Sections:
1. Recent Run Logs (ops telemetry)
2. Published Reports (deep outputs)
3. Tasks board (inbox/planned/in_progress/review/done)
4. Checkpoints timeline
5. Git activity panel

## Layer C: Report Viewer (deep context)
Route: `/reports/[slug]`

Purpose:
- full-page, readable report rendering (markdown/html)
- charts and figures visible at native width

Requirements:
- never rely on private GitHub raw image links for core visuals
- use site-hosted assets or report-embedded assets

---

## Two report types (must coexist)

## 1) Run Log (auto + lightweight)
Used for: “what got done this run?”

Data:
- summary
- commit refs
- pass/fail checks
- key metrics
- artifacts
- next steps
- trigger reason + confidence

Creation:
- auto-draft via policy engine after meaningful work
- quick publish/edit controls

## 2) Deep Report (manual/intentional)
Used for: “teach me what this project found/means”

Data:
- full technical narrative
- method, trials, results
- limitations and research context
- rich figures and interpretation

Creation:
- explicit publish action (agent or user request)
- linked to one or more run logs

---

## Auto-generation policy (when to draft run logs)

Create draft if score >= threshold (e.g., 60/100):
- +30 update status is `shipped` or `needs_review`
- +20 commit refs present
- +15 files_touched >= 3
- +15 project_key present
- +10 elapsed >= 4h since last run log in project
- -20 if near-duplicate summary within 2h

Outputs:
- `shouldCreateDraft`
- confidence score
- human-readable trigger reasons

Policy goal:
- high precision first (avoid spam)
- then tune recall

---

## Communication protocol (you + me)

Telegram:
- short status + links only
- approvals/decisions

Ops Dashboard:
- run logs + task state + project tracking

Deep Report page:
- full technical reading mode for large work outputs

GitHub:
- source-of-truth for code and diff history
- supplemental long-form docs if needed

---

## UX standards for readability
- Default to read-only polished cards
- Small edit/publish toggles (hidden by default)
- Mobile-first typography and spacing
- Visual hierarchy: project > run > deep report

---

## 14-day build plan (suggested)

### Phase 1 (days 1–3): Core data + policy
- finalize ops_runs schema
- trigger candidate endpoint
- deterministic slug + collision handling

### Phase 2 (days 4–7): Project workspace hardening
- run-log list/detail UX
- draft→publish flow
- run↔deep report linkage

### Phase 3 (days 8–11): Deep report quality
- robust HTML/MD rendering
- asset hosting strategy
- chart rendering QA on mobile

### Phase 4 (days 12–14): Reliability + tuning
- policy precision/recall review
- duplicate suppression
- operator feedback loop

---

## Risks + mitigations
1. **Report spam** -> confidence threshold + dedupe + user mute controls
2. **Broken figures** -> store assets on-site, not external private links
3. **Context bloat** -> keep run logs concise, deep reports separate
4. **Manual overhead** -> auto-draft run logs, manual deep reports only when needed

---

## Immediate actions (this week)
1. Create dedicated `ops-dashboard-system` project in dashboard
2. Publish this proposal as first deep report in that project
3. Wire run-log policy endpoint and start collecting trigger stats
4. Move all major work updates to run-log-first process

---

## Recommendation
Adopt the **three-layer model (Project Index / Project Workspace / Deep Report Viewer)** with a strict two-report-type contract:
- **Run logs for operations**
- **Deep reports for understanding**

This gives speed, traceability, and technical depth without mixing formats.
