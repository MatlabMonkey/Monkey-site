-- Ops dashboard schema (work focus, updates, and tasks)

CREATE TABLE IF NOT EXISTS work_focus (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  now_working_on TEXT,
  next_up TEXT,
  blocked_on TEXT,
  last_checkpoint_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO work_focus (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS work_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  commit_start TEXT,
  commit_end TEXT,
  commit_url TEXT,
  pr_url TEXT,
  files_touched JSONB NOT NULL DEFAULT '[]'::jsonb,
  why_it_matters TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'needs_review', 'blocked', 'shipped')),
  checkpoint_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_updates_checkpoint_at ON work_updates (checkpoint_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_updates_status ON work_updates (status);
CREATE INDEX IF NOT EXISTS idx_work_updates_repo_branch ON work_updates (repo, branch);

CREATE TABLE IF NOT EXISTS work_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'med' CHECK (priority IN ('low', 'med', 'high')),
  status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'planned', 'in_progress', 'review', 'done')),
  repo_target TEXT,
  due_date DATE,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_tasks_status ON work_tasks (status);
CREATE INDEX IF NOT EXISTS idx_work_tasks_priority ON work_tasks (priority);
CREATE INDEX IF NOT EXISTS idx_work_tasks_due_date ON work_tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_work_tasks_created_at ON work_tasks (created_at DESC);

ALTER TABLE work_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on work_focus (v1)"
  ON work_focus FOR ALL USING (true);

CREATE POLICY "Allow all on work_updates (v1)"
  ON work_updates FOR ALL USING (true);

CREATE POLICY "Allow all on work_tasks (v1)"
  ON work_tasks FOR ALL USING (true);
