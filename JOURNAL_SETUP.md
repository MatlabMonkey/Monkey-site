# Journal setup (new flexible schema)

The journal uses a **flexible schema** in the **new** Supabase project: `journal_entry`, `question_catalog`, and `journal_answer`. The `question_catalog` is the source of truth for prompts; answers are stored by `question_id` so wording can change without breaking data.

## 1. Apply the migration

Run the migration on your **new** Supabase project (the one configured in `NEXT_PUBLIC_SUPABASE_URL`):

**Option A – Supabase SQL Editor**

1. Open your project → SQL Editor.
2. Paste and run the contents of `supabase/migrations/002_journal_schema.sql`.

**Option B – Supabase CLI**

```bash
npx supabase db push
```

This applies both `001_create_todos.sql` and `002_journal_schema.sql`. Ensure the project is linked (`npx supabase link --project-ref YOUR_REF`).

## 2. Smoke test

After the migration:

```
GET /api/journal/smoke
```

You should get `{ "ok": true, "message": "Journal smoke test passed: write and read succeeded.", ... }`.  
If `ok: false`, check that `question_catalog` is seeded and RLS allows the operations used by the app.

## 3. Journal flow

- **New entry:** `/journal` (defaults to today) or `/journal?date=YYYY-MM-DD`.
- **Date picker:** use the “Entry date” control to change the date.
- **Draft:** autosave to `journal_entry` (is_draft=true) and `journal_answer`.
- **Submit:** POST to submit sets `is_draft=false` and `completed_at`. Submitting again for the same date overwrites (edit after submit).
- **Load:** GET `/api/journal/entry?date=...` returns draft or submitted entry and answers; the form prefills and shows “Resuming draft” or “Editing submitted entry”.
- **Search:** `/journal/search` — date range and optional text search in answers. Results link to `/journal?date=...`.

## 4. Question set

- **Code:** `lib/journalSchema.ts` is the source of truth for the active question set.
- **DB:** `question_catalog` is seeded by the migration. To change questions: update `journalSchema.ts` and either re-run a seed or manually `INSERT`/`UPDATE` in `question_catalog`.

## 5. Dashboard (phase 2)

The existing dashboard still reads the **old** flat `journal_entries` table. It is unchanged and will be adapted to the new `journal_entry` + `journal_answer` model in a later phase. Until then, the dashboard may error or show no data if the new project has no `journal_entries` table.
