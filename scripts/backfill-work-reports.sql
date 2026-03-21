-- Backfill template for work_reports.
-- Run in Supabase SQL editor after migrations 016_work_reports.sql + 018_report_content_on_site.sql.
-- Replace bracketed values before executing.

INSERT INTO work_reports (
  project_key,
  project_label,
  title,
  summary,
  report_type,
  report_url,
  slug,
  html_content,
  content_md,
  content_json,
  asset_base_url,
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
    '/reports/[optional-slug]',
    '[optional-slug]',
    '[optional-full-html-content]',
    NULL,
    NULL,
    '[optional-asset-base-url]',
    '[optional/internal/artifact/path.html]',
    '[optional-commit-sha]',
    ARRAY['controls', 'report'],
    'agent',
    NOW()
  )
ON CONFLICT DO NOTHING;
