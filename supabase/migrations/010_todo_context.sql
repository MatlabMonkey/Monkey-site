-- Work/Personal context split for todos
ALTER TABLE todos
ADD COLUMN IF NOT EXISTS context TEXT DEFAULT 'personal';

-- Backfill existing rows into personal context.
UPDATE todos
SET context = 'personal'
WHERE context IS NULL
   OR context NOT IN ('personal', 'work');

ALTER TABLE todos
ALTER COLUMN context SET DEFAULT 'personal';

ALTER TABLE todos
ALTER COLUMN context SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'todos_context_check'
  ) THEN
    ALTER TABLE todos
    ADD CONSTRAINT todos_context_check
    CHECK (context IN ('personal', 'work'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_todos_context_folder
  ON todos(context, folder);
