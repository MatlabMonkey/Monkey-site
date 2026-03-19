-- Backfill + seed ops_projects catalog from existing data.
-- Run in Supabase SQL editor after migration 017_ops_projects.sql.

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
