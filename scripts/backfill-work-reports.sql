-- Backfill template for work_reports.
-- Run in Supabase SQL editor after migration 016_work_reports.sql.
-- Replace bracketed values before executing.

INSERT INTO work_reports (
  project_key,
  project_label,
  title,
  summary,
  report_type,
  report_url,
  artifact_path,
  commit_ref,
  tags,
  published_by,
  published_at
)
VALUES
  (
    'koopman-mpc',
    'Koopman MPC',
    '[Report title]',
    '[Short summary of outcomes and decisions]',
    'html',
    '[https://<host>/path/to/koopman-report.html]',
    '[optional/internal/artifact/path.html]',
    '[optional-commit-sha]',
    ARRAY['controls', 'report'],
    'agent',
    NOW()
  )
ON CONFLICT DO NOTHING;
