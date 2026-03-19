CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key TEXT NOT NULL CHECK (
    char_length(btrim(project_key)) > 0
    AND project_key = lower(project_key)
    AND project_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  project_label TEXT NOT NULL CHECK (char_length(btrim(project_label)) > 0),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) > 0),
  summary TEXT NOT NULL CHECK (char_length(btrim(summary)) > 0),
  report_type TEXT NOT NULL CHECK (report_type IN ('html', 'md', 'pdf', 'link')),
  report_url TEXT NOT NULL CHECK (char_length(btrim(report_url)) > 0),
  artifact_path TEXT,
  commit_ref TEXT,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  published_by TEXT NOT NULL DEFAULT 'agent',
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_reports_project_key
  ON work_reports(project_key);

CREATE INDEX IF NOT EXISTS idx_work_reports_published_at_desc
  ON work_reports(published_at DESC);

CREATE OR REPLACE FUNCTION public.set_work_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_reports_set_updated_at ON work_reports;
CREATE TRIGGER work_reports_set_updated_at
BEFORE UPDATE ON work_reports
FOR EACH ROW
EXECUTE FUNCTION public.set_work_reports_updated_at();

ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_reports'
      AND policyname = 'work_reports_all_v1'
  ) THEN
    CREATE POLICY work_reports_all_v1
      ON work_reports FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
