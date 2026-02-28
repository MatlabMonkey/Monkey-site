ALTER TABLE todos
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_todos_folder_sort_order
  ON todos(folder, sort_order);
