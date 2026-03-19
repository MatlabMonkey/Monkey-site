CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ops_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key TEXT NOT NULL UNIQUE CHECK (
    char_length(btrim(project_key)) > 0
    AND project_key = lower(project_key)
    AND project_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  project_label TEXT NOT NULL CHECK (char_length(btrim(project_label)) > 0),
  description TEXT,
  repo_full_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_projects_status ON ops_projects(status);
CREATE INDEX IF NOT EXISTS idx_ops_projects_sort_order ON ops_projects(sort_order);
CREATE INDEX IF NOT EXISTS idx_ops_projects_updated_at_desc ON ops_projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_projects_repo_full_name ON ops_projects(repo_full_name);

CREATE OR REPLACE FUNCTION public.set_ops_projects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ops_projects_set_updated_at ON ops_projects;
CREATE TRIGGER ops_projects_set_updated_at
BEFORE UPDATE ON ops_projects
FOR EACH ROW
EXECUTE FUNCTION public.set_ops_projects_updated_at();

ALTER TABLE ops_projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_projects'
      AND policyname = 'ops_projects_all_v1'
  ) THEN
    CREATE POLICY ops_projects_all_v1
      ON ops_projects FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS project_key TEXT;

ALTER TABLE work_updates
  ADD COLUMN IF NOT EXISTS project_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_tasks_project_key_slug'
      AND conrelid = 'work_tasks'::regclass
  ) THEN
    ALTER TABLE work_tasks
      ADD CONSTRAINT work_tasks_project_key_slug
      CHECK (
        project_key IS NULL
        OR (
          char_length(btrim(project_key)) > 0
          AND project_key = lower(project_key)
          AND project_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_updates_project_key_slug'
      AND conrelid = 'work_updates'::regclass
  ) THEN
    ALTER TABLE work_updates
      ADD CONSTRAINT work_updates_project_key_slug
      CHECK (
        project_key IS NULL
        OR (
          char_length(btrim(project_key)) > 0
          AND project_key = lower(project_key)
          AND project_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_work_tasks_project_key
  ON work_tasks(project_key);

CREATE INDEX IF NOT EXISTS idx_work_updates_project_key
  ON work_updates(project_key);

INSERT INTO ops_projects (project_key, project_label, sort_order)
VALUES
  ('koopman-mpc', 'Koopman MPC', 10),
  ('customer-agent-projects', 'Customer Agent Projects', 20)
ON CONFLICT (project_key) DO NOTHING;

INSERT INTO ops_projects (project_key, project_label)
SELECT DISTINCT
  wr.project_key,
  COALESCE(NULLIF(btrim(wr.project_label), ''), initcap(replace(wr.project_key, '-', ' ')))
FROM work_reports wr
WHERE wr.project_key IS NOT NULL
  AND btrim(wr.project_key) <> ''
ON CONFLICT (project_key) DO NOTHING;

WITH task_candidates AS (
  SELECT
    t.id,
    p.project_key,
    ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY p.sort_order ASC, p.updated_at DESC) AS rank
  FROM work_tasks t
  JOIN ops_projects p
    ON t.project_key IS NULL
   AND (
     lower(regexp_replace(regexp_replace(coalesce(t.repo_target, ''), '^https?://github\\.com/', ''), '\\.git$', '')) = lower(coalesce(p.repo_full_name, ''))
     OR split_part(lower(regexp_replace(regexp_replace(coalesce(t.repo_target, ''), '^https?://github\\.com/', ''), '\\.git$', '')), '/', 2) = split_part(lower(coalesce(p.repo_full_name, '')), '/', 2)
     OR lower(btrim(coalesce(t.repo_target, ''))) = p.project_key
   )
)
UPDATE work_tasks t
SET project_key = c.project_key
FROM task_candidates c
WHERE t.id = c.id
  AND c.rank = 1;

WITH update_candidates AS (
  SELECT
    u.id,
    p.project_key,
    ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY p.sort_order ASC, p.updated_at DESC) AS rank
  FROM work_updates u
  JOIN ops_projects p
    ON u.project_key IS NULL
   AND (
     lower(regexp_replace(regexp_replace(coalesce(u.repo, ''), '^https?://github\\.com/', ''), '\\.git$', '')) = lower(coalesce(p.repo_full_name, ''))
     OR split_part(lower(regexp_replace(regexp_replace(coalesce(u.repo, ''), '^https?://github\\.com/', ''), '\\.git$', '')), '/', 2) = split_part(lower(coalesce(p.repo_full_name, '')), '/', 2)
     OR lower(btrim(coalesce(u.repo, ''))) = p.project_key
   )
)
UPDATE work_updates u
SET project_key = c.project_key
FROM update_candidates c
WHERE u.id = c.id
  AND c.rank = 1;
