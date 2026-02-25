-- GTD expansion for todos table
ALTER TABLE todos ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'task';
ALTER TABLE todos ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS waiting_for TEXT;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS clarified_at TIMESTAMP WITH TIME ZONE;

-- Ensure backfill before stricter constraints
UPDATE todos
SET folder = 'inbox'
WHERE folder IS NULL
  OR folder NOT IN ('inbox', 'next_action', 'project', 'waiting_for', 'calendar', 'someday_maybe', 'reference', 'trash');

UPDATE todos
SET item_type = 'task'
WHERE item_type IS NULL
   OR item_type NOT IN ('task', 'project');

ALTER TABLE todos ALTER COLUMN item_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'todos_project_id_fkey'
  ) THEN
    ALTER TABLE todos
      ADD CONSTRAINT todos_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES todos(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'todos_folder_gtd_check'
  ) THEN
    ALTER TABLE todos
      ADD CONSTRAINT todos_folder_gtd_check
      CHECK (folder IN ('inbox', 'next_action', 'project', 'waiting_for', 'calendar', 'someday_maybe', 'reference', 'trash'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'todos_item_type_check'
  ) THEN
    ALTER TABLE todos
      ADD CONSTRAINT todos_item_type_check
      CHECK (item_type IN ('task', 'project'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_todos_folder_completed_created_at
  ON todos(folder, completed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_todos_project_completed
  ON todos(project_id, completed);

CREATE INDEX IF NOT EXISTS idx_todos_calendar_scheduled
  ON todos(scheduled_for)
  WHERE folder = 'calendar';
