# Journal Date Flow

Last reviewed: 2026-07-03

## Core Model

The canonical journal date is `journal_entry.date`.

It means the day the entry is about, not the day the form was filled out. There is one `journal_entry` row per canonical date, enforced by `journal_entry.date DATE NOT NULL UNIQUE`.

System timestamps stay separate:

- `created_at`: when that date's entry row was first started.
- `updated_at`: when it was last edited or autosaved.
- `completed_at`: when it was submitted/finalized.

## UI Structure

The journal form has a dedicated date step before the normal question-catalog questions.

That date step is not a `question_catalog` row and is not saved as a `journal_answer`. It reads and writes only `journal_entry.date`.

Normal answers begin after the date step and come from `/api/journal/questions`.

`day_date` is a legacy question key from older question catalogs. New UI code filters it out of the question list, and `lib/journalDb.ts` still ignores it on save for backward compatibility with old clients or imported data.

## Load Flow

- `/journal` computes `entryDate` from `?date=YYYY-MM-DD`.
- If the URL has no valid date, the page defaults to today in `America/Los_Angeles`.
- `/api/journal/entry?date=<entryDate>` loads the matching draft/submitted entry if it exists.
- If no entry exists, the page starts a blank in-memory entry for that date.

## Date Change Flow

Changing the dedicated date step checks whether the destination date already has an entry.

- If the destination exists, the UI warns and offers to open the existing entry or keep the current date.
- If the destination does not exist and the current entry already exists, `PATCH /api/journal/entry` moves the current `journal_entry.date`.
- If the destination does not exist and no entry has been created yet, the page navigates to `/journal?date=<selected-date>`.
- If the user has unsaved in-memory answers while changing to an empty date, the app saves those answers under the destination date before navigating.

## Autosave Flow

Autosave posts to `/api/journal/draft` with:

```json
{
  "date": "YYYY-MM-DD",
  "answers": []
}
```

`saveDraft()` creates a draft row if no row exists. If a row already exists, it updates answers and `updated_at` without changing the row's submitted/draft state.

## Submit Flow

Submitting opens a review modal first. The review shows the canonical entry date and the normal answers that will be submitted.

After confirmation, `/api/journal/submit` calls `submitEntry()`, which:

- Upserts `journal_entry` by `date`.
- Sets `is_draft=false`.
- Sets `completed_at=now()`.
- Updates `updated_at`.
- Replaces linked `journal_answer` rows.

## Submitted Entries

Submitted entries open in view mode. The answers can be reviewed and navigated, but edits do not apply until "Edit submitted entry" is selected.

Once edit mode is enabled, autosave can update answers and `updated_at`, but it preserves `is_draft=false` and does not clear `completed_at`.

## Calendar Flow

`/journal/calendar` is the operational coverage view. It uses `/api/journal/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`, which reads only `journal_entry` rows for the requested date range.

Calendar status comes from entry metadata:

- `is_draft=false`: submitted entry.
- `is_draft=true`: draft entry.
- no row for that date: empty.

Each calendar date links to `/journal?date=YYYY-MM-DD`, so empty days start a new entry, draft days resume the draft, and submitted days open the read-only submitted entry.

## Future Simplification Notes

- `/api/journal/exists` can probably be removed later because `PATCH /api/journal/entry` already returns a conflict when the target date exists.
- `lib/journalStorage.ts` appears to be legacy localStorage code and can be deleted after confirming no external imports.
- `PATCH /api/journal/draft` appears unused by the app and can be removed after confirming no external callers.
- `saveDraft()` and `submitEntry()` share enough logic that they could become one data-layer helper with a mode argument.

## Relevant Files

- `app/journal/page.tsx`
- `app/api/journal/entry/route.ts`
- `app/api/journal/exists/route.ts`
- `app/api/journal/draft/route.ts`
- `app/api/journal/submit/route.ts`
- `app/api/journal/questions/route.ts`
- `app/journal/calendar/page.tsx`
- `app/api/journal/calendar/route.ts`
- `lib/journalDb.ts`
- `lib/date.ts`
- `lib/journalSchema.ts`
- `supabase/migrations/002_journal_schema.sql`

See also: `docs/architecture/JOURNAL_FEATURE_AUDIT.md`
