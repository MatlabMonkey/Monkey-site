# Legacy journal import (Google Forms / CSV)

Import old journal data (e.g. Google Forms CSV export) into the existing Supabase journal schema so it appears in journal search and when opening a date.

## 1. Export from Google Forms

- Open your form → **Responses** → ⋮ (three dots) → **Download responses (.csv)**.
- You get one row per submission. **The first row is always headers** (question text or truncated labels). The script automatically treats the first row as column names and the rest as data rows.
- One column is usually the submission timestamp (often named "Timestamp").
- **Empty rows are automatically skipped** — if a row has no date/timestamp and all answer columns are empty, it won't create an entry.

## 2. Column → question mapping

The import script needs a **mapping file** (JSON) that tells it:

- Which CSV column (by exact header text) maps to which `question_catalog.key`
- Optional: `question_type` (text, number, rating, boolean, multiselect, date) — defaults to `text`
- Optional: `wording` — label used in the catalog and in the app (defaults to the CSV header)

### Mapping file format

**File:** `scripts/import-legacy-mapping.json` (or any path you pass to the script)

```json
{
  "Timestamp": "_timestamp",
  "Date of the day": {
    "key": "day_date",
    "type": "date",
    "wording": "Date"
  },
  "What did you do today?": {
    "key": "daily_timeline_summary",
    "type": "text",
    "wording": "What did you do today?"
  },
  "How was your day? (1-10)": {
    "key": "day_quality",
    "type": "rating",
    "wording": "Day quality (1-10)"
  },
  "Notes": "notes"
}
```

- **Key in the object** = exact CSV column header (as in the first row of your CSV).
- **Value** can be:
  - A **string**: shorthand for `{ "key": "<that string>", "type": "text" }`. The header is used as wording when the question is first inserted into the catalog.
  - An **object**:
    - `key` (required): `question_catalog.key` (e.g. `day_quality`, `daily_timeline_summary`).
    - `type` (optional): `text` | `number` | `rating` | `boolean` | `multiselect` | `date`. Default `text`.
    - `wording` (optional): label in the app. Defaults to the CSV header.

### Checklist / multiselect format

If your old form had **checklist questions** (multiple selections), Google Forms exports them as comma-separated text. To import these:

1. Map that column with `"type": "multiselect"` in your mapping JSON.
2. The script will automatically parse comma-separated values into an array:
   - `"No snooze, Workout or run, Get sun + hydrate"` → `["No snooze", "Workout or run", "Get sun + hydrate"]`
   - Also handles `{item1, item2}` format if present, but usually it's just plain comma-separated text
3. Example mapping:
   ```json
   {
     "Daily habits (check all)": {
       "key": "daily_habits",
       "type": "multiselect",
       "wording": "Daily habits"
     }
   }
   ```

### Special mapping key: date / timestamp

- **`_timestamp`**: column that contains the submission timestamp. The script will use its **date part** (YYYY-MM-DD) as `journal_entry.date` if you don’t provide a date column.
- **Date column**: if your CSV has a column like "Date of the day", map it to a question key (e.g. `day_date`) and also tell the script to use that column for the entry date (see script usage below).

## 3. Run the import script

From the project root:

```bash
node scripts/import-legacy-journal.js <path-to-responses.csv> <path-to-mapping.json> [options]
```

**Options (env or flags):**

- **Timestamp column:** If the column that holds submission time is not named `Timestamp`, set `IMPORT_TIMESTAMP_COLUMN` or use `--timestamp-column "Your column name"`.
- **Date column:** To use a specific CSV column (e.g. "Date of the day") as the entry date instead of the timestamp’s date, set `IMPORT_DATE_COLUMN` or `--date-column "Date of the day"`.
- **Supabase:** Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local` (or `.env`). Loaded via `dotenv`.

The script will:

1. Read the CSV and the mapping. **First row = headers** (column names), rest = data rows.
2. For each data row:
   - Derive `entry_date` (from date column or timestamp column).
   - **Skip if no date** or if all answer columns are empty.
   - Upsert `journal_entry` for that date (submitted, not draft).
   - For each mapped column (except `_timestamp`): ensure the question exists in `question_catalog` (insert if missing), then insert/update `journal_answer`.
3. Parse checklist format `{item1, item2, ...}` → array for `multiselect` type.
4. Show summary: entries created, answers written, rows skipped.

**You don't need to specify column/row counts** — the script reads the CSV structure automatically. Just make sure your mapping JSON keys match the exact CSV header text (case-sensitive).

## 4. After import

- Use **Journal → Search** and **open by date** on the site; legacy entries will appear.
- For dates that only have legacy (or different) questions, the journal page shows a **read-only view** of all answers (question label + value) instead of the current form.

## 5. Google Doc “what you did today”

Once you’ve turned the Doc into a spreadsheet with at least **date** and **one answer column** (e.g. “What you did today”):

1. Export that sheet as CSV.
2. Create a small mapping JSON (e.g. map the date column to `day_date`, the answer column to `daily_timeline_summary` or a key you add to the catalog).
3. Run the same import script on that CSV with that mapping.
