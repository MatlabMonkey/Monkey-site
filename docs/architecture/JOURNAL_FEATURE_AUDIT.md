# Journal Feature Audit

Last reviewed: 2026-07-03

## Current Mental Model

The journal has three primary surfaces:

- `/journal`: write, resume, view, or edit one entry.
- `/dashboard`: submitted-entry analytics and trend summaries.
- `/journal/calendar`: operational coverage view for submitted, draft, and empty dates.

The canonical date is always `journal_entry.date`. It means the day the entry is about.

## Active Features

### Journal Entry

Files:

- `app/journal/page.tsx`
- `app/api/journal/entry/route.ts`
- `app/api/journal/draft/route.ts`
- `app/api/journal/submit/route.ts`
- `app/api/journal/questions/route.ts`
- `lib/journalDb.ts`

Status: active.

Purpose: one entry editor. It opens today by default, lets the first date step choose another canonical entry date, autosaves drafts, opens submitted entries in read-only mode, and submits through a review modal.

Notes:

- The date step is not a question-catalog answer.
- `journal_answer` should contain only normal journal answers.
- `day_date` is legacy-only compatibility and should not re-enter normal app flow.

### Journal Dashboard

Files:

- `app/dashboard/page.tsx`
- `app/api/journal/dashboard/route.ts`

Status: active.

Purpose: submitted-entry analytics. It intentionally reads only rows where `is_draft=false`.

Notes:

- It should stay analytics-focused.
- It should not become the draft/completion management surface. That is the calendar's job.

### Journal Calendar

Files:

- `app/journal/calendar/page.tsx`
- `app/api/journal/calendar/route.ts`

Status: active.

Purpose: month grid showing whether each date has a submitted entry, draft entry, or no entry.

Behavior:

- Submitted dates are marked complete.
- Draft dates are marked draft.
- Empty dates are muted.
- Today gets a visible marker.
- Any day links to `/journal?date=YYYY-MM-DD`.

Notes:

- The API reads only `journal_entry` rows in the requested date range.
- It does not fetch answers, which keeps it cheap and independent from question schema changes.

### Search

Files:

- `app/journal/search/page.tsx`
- `app/api/journal/search/route.ts`

Status: active but narrower than Explorer.

Purpose: simple date range and text search.

Notes:

- This is useful for quick lookup.
- It overlaps with Explorer text/date functionality, but it is much simpler and may be worth keeping.

### Explorer

Files:

- `app/journal/explorer/page.tsx`
- `app/api/journal/explore/route.ts`

Status: active/advanced.

Purpose: richer query surface for numeric patterns, people, activities, workouts, habits, text, date patterns, combinations, and streaks.

Half-feature/overlap note:

- Explorer has a `ResultsCalendar` mode, but it only visualizes the current query result set.
- It is not a complete journal coverage calendar because it does not show submitted vs draft vs empty status across all dates.
- Keep it as a query-result view for now. Do not treat it as the main calendar.

## Cleanup Candidates

### `/api/journal/exists`

File: `app/api/journal/exists/route.ts`

Status: active but simplifiable.

The journal page currently calls it before moving an entry date. `PATCH /api/journal/entry` already detects conflicts when moving dates, so this can probably be folded into one endpoint later.

Suggested cleanup:

- Replace the client preflight check with a single move/open-intent call.
- Delete `/api/journal/exists` after confirming no other callers.

### `PATCH /api/journal/draft`

File: `app/api/journal/draft/route.ts`

Status: appears unused by the app.

The app uses `POST /api/journal/draft` for autosave. The PATCH handler appears to be older update scaffolding.

Suggested cleanup:

- Confirm no external automation or old client calls it.
- Delete the PATCH handler if unused.

### `lib/journalStorage.ts`

File: `lib/journalStorage.ts`

Status: unused legacy localStorage implementation.

`rg` shows no current imports. The Supabase-backed `lib/journalDb.ts` replaced it.

Suggested cleanup:

- Delete after one final import check.

### `day_date`

Files:

- `lib/journalDb.ts`
- `app/api/journal/questions/route.ts`
- Supabase `question_catalog` data

Status: legacy compatibility.

The app filters `day_date` out of active question lists and ignores it when saving answers.

Suggested cleanup:

- Leave code guards in place until old data/import paths are understood.
- Later, clean the old `question_catalog` row if desired.

### Smoke Endpoint

File: `app/api/journal/smoke/route.ts`

Status: dev/test helper.

It writes a fixed smoke-test entry and includes legacy `day_date` in its sample answers.

Suggested cleanup:

- Decide whether this endpoint is still needed.
- If kept, update the sample payload so it matches the current architecture.
- If not needed, remove it.

## Design Boundaries

- Dashboard: insight and trends for submitted entries.
- Calendar: coverage and operational state across all entry dates.
- Journal Entry: write or view a single date.
- Search: quick lookup.
- Explorer: advanced analysis and filtering.

Future agents should preserve these boundaries unless intentionally redesigning the journal section.
