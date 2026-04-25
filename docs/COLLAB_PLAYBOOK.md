# Collaboration Playbook

## Purpose
A simple working system so Arias + Zach can collaborate from Telegram, phone, work computer, and GitHub without losing context.

## Channels and Roles

### Telegram (fast lane)
Use for:
- Requests
- Quick decisions
- Approvals (merge/push)
- Status updates

Expected format:
- "Do X"
- "Approve merge"
- "Blocked on Y"

### GitHub (source of truth)
Use for:
- Code
- Long-form docs/specs
- Task tracking
- Review and change history

Rule:
- If work matters later, it must exist in GitHub (issue, PR, or doc).

### Monkey-site / Ops pages (visibility layer)
Use for:
- Dashboards and summaries
- Progress visibility

Rule:
- Useful for reading, not primary source control.

---

## Standard Workflow

1. **Create issue** with scope + acceptance criteria.
2. **Create branch** from `main`:
   - `feature/<short-name>`
   - `fix/<short-name>`
   - `docs/<short-name>`
3. **Implement in small commits**.
4. **Open PR** linked to issue.
5. **Review + iterate**.
6. **Run checks** (`npm run lint`, `npm run build`).
7. **Approve in Telegram**.
8. **Merge + report result** with commit/PR links.

---

## Work Types

### A) Feature / Coding work
- Track via issue + PR.
- Include screenshots or API examples when relevant.

### B) Teaching / Notes / Explanations
- Create markdown under `docs/`.
- Suggested naming:
  - `docs/lessons/<topic>.md`
  - `docs/guides/<topic>.md`
- Send quick summary in Telegram + link to full doc.

### C) Large project planning (e.g., MATLAB project)
- Create an umbrella issue (project objective).
- Create child issues for milestones.
- Keep one living spec doc in `docs/specs/<project>.md`.
- Use PRs for each milestone; avoid giant one-shot PRs.

---

## Lightweight Task Template (when messaging in Telegram)

Use this format for clean handoffs:

- **Goal:**
- **Context:**
- **Definition of done:**
- **Deadline (if any):**
- **Constraints:**

---

## Done Criteria
Work is "done" when all are true:
- Implemented in code/docs
- Checks pass (or blocker explicitly documented)
- PR merged (or explicit pause decision)
- Final Telegram update includes links

---

## Access Across Devices
To keep work accessible on phone/work/home:
- Store durable artifacts in GitHub (not only chat)
- Prefer markdown docs in repo over long Telegram-only text
- Keep PR and issue descriptions self-contained

---

## First Operational Defaults
- Long-form plans/specs/reviews: **GitHub**
- Short decisions/status/approvals: **Telegram**
- Ongoing visibility: **Ops dashboard**

This is the default unless explicitly overridden.
