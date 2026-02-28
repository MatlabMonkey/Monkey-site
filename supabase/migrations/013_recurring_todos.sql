CREATE TABLE IF NOT EXISTS recurring_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'personal' CHECK (context IN ('personal', 'work')),
  folder TEXT NOT NULL DEFAULT 'inbox',
  rrule TEXT NOT NULL,
  next_run_at DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_todos_next_run ON recurring_todos(next_run_at) WHERE active = true;

ALTER TABLE recurring_todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recurring_todos_all" ON recurring_todos FOR ALL USING (true) WITH CHECK (true);
