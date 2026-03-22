CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS project_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key TEXT NOT NULL CHECK (
    char_length(btrim(project_key)) > 0
    AND project_key = lower(project_key)
    AND project_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) > 0),
  summary TEXT,
  kind TEXT NOT NULL DEFAULT 'deep_report' CHECK (kind IN ('deep_report')),
  report_url TEXT NOT NULL CHECK (char_length(btrim(report_url)) > 0),
  slug TEXT,
  source_work_report_id UUID UNIQUE REFERENCES work_reports(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_reports_slug_format'
      AND conrelid = 'project_reports'::regclass
  ) THEN
    ALTER TABLE project_reports
      ADD CONSTRAINT project_reports_slug_format
      CHECK (
        slug IS NULL
        OR (
          char_length(btrim(slug)) > 0
          AND slug = lower(slug)
          AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_project_reports_project_key
  ON project_reports(project_key);

CREATE INDEX IF NOT EXISTS idx_project_reports_created_at_desc
  ON project_reports(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_reports_slug_unique
  ON project_reports(slug)
  WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_project_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_reports_set_updated_at ON project_reports;
CREATE TRIGGER project_reports_set_updated_at
BEFORE UPDATE ON project_reports
FOR EACH ROW
EXECUTE FUNCTION public.set_project_reports_updated_at();

ALTER TABLE project_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_reports'
      AND policyname = 'project_reports_all_v1'
  ) THEN
    CREATE POLICY project_reports_all_v1
      ON project_reports FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

INSERT INTO project_reports (
  project_key,
  title,
  summary,
  kind,
  report_url,
  slug,
  source_work_report_id,
  metadata,
  created_at,
  updated_at
)
SELECT
  wr.project_key,
  wr.title,
  wr.summary,
  'deep_report',
  wr.report_url,
  wr.slug,
  wr.id,
  jsonb_build_object(
    'report_type', wr.report_type,
    'published_at', wr.published_at,
    'published_by', wr.published_by
  ),
  wr.created_at,
  wr.updated_at
FROM work_reports wr
WHERE wr.project_key IS NOT NULL
  AND btrim(wr.project_key) <> ''
ON CONFLICT (source_work_report_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ops_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_update_id UUID REFERENCES work_updates(id) ON DELETE SET NULL,
  project_key TEXT NOT NULL CHECK (
    char_length(btrim(project_key)) > 0
    AND project_key = lower(project_key)
    AND project_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) > 0),
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  trigger_source TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('auto_policy', 'manual', 'subagent', 'push')),
  trigger_confidence INT NOT NULL DEFAULT 0 CHECK (trigger_confidence >= 0 AND trigger_confidence <= 100),
  trigger_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  run_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  commit_refs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  checks_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  artifacts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_steps TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  deep_report_id UUID REFERENCES project_reports(id) ON DELETE SET NULL,
  deep_report_url TEXT,
  deep_report_slug TEXT,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ops_runs_slug_format'
      AND conrelid = 'ops_runs'::regclass
  ) THEN
    ALTER TABLE ops_runs
      ADD CONSTRAINT ops_runs_slug_format
      CHECK (
        slug IS NULL
        OR (
          char_length(btrim(slug)) > 0
          AND slug = lower(slug)
          AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
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
    WHERE conname = 'ops_runs_deep_report_slug_format'
      AND conrelid = 'ops_runs'::regclass
  ) THEN
    ALTER TABLE ops_runs
      ADD CONSTRAINT ops_runs_deep_report_slug_format
      CHECK (
        deep_report_slug IS NULL
        OR (
          char_length(btrim(deep_report_slug)) > 0
          AND deep_report_slug = lower(deep_report_slug)
          AND deep_report_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_ops_runs_project_key_run_date_desc
  ON ops_runs(project_key, run_date DESC);

CREATE INDEX IF NOT EXISTS idx_ops_runs_status
  ON ops_runs(status);

CREATE INDEX IF NOT EXISTS idx_ops_runs_source_update_id
  ON ops_runs(source_update_id);

CREATE INDEX IF NOT EXISTS idx_ops_runs_deep_report_id
  ON ops_runs(deep_report_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_runs_slug_unique
  ON ops_runs(slug)
  WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_runs_source_update_unique
  ON ops_runs(source_update_id)
  WHERE source_update_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_ops_runs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ops_runs_set_updated_at ON ops_runs;
CREATE TRIGGER ops_runs_set_updated_at
BEFORE UPDATE ON ops_runs
FOR EACH ROW
EXECUTE FUNCTION public.set_ops_runs_updated_at();

ALTER TABLE ops_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_runs'
      AND policyname = 'ops_runs_all_v1'
  ) THEN
    CREATE POLICY ops_runs_all_v1
      ON ops_runs FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

WITH candidates AS (
  SELECT
    u.id,
    u.project_key,
    u.summary,
    u.why_it_matters,
    u.status,
    u.checkpoint_at,
    u.commit_start,
    u.commit_end,
    u.commit_url,
    u.pr_url,
    COALESCE(jsonb_array_length(u.files_touched), 0) AS files_touched_count,
    (
      CASE WHEN u.status = 'shipped' THEN 45 ELSE 32 END
      + CASE WHEN u.commit_start IS NOT NULL AND u.commit_end IS NOT NULL THEN 15 ELSE 0 END
      + CASE
          WHEN COALESCE(jsonb_array_length(u.files_touched), 0) >= 12 THEN 18
          WHEN COALESCE(jsonb_array_length(u.files_touched), 0) >= 6 THEN 12
          WHEN COALESCE(jsonb_array_length(u.files_touched), 0) >= 1 THEN 6
          ELSE 0
        END
      + 12
      + CASE
          WHEN lr.run_date IS NULL THEN 18
          WHEN EXTRACT(EPOCH FROM (u.checkpoint_at - lr.run_date)) / 3600 >= 72 THEN 20
          WHEN EXTRACT(EPOCH FROM (u.checkpoint_at - lr.run_date)) / 3600 >= 24 THEN 12
          WHEN EXTRACT(EPOCH FROM (u.checkpoint_at - lr.run_date)) / 3600 >= 8 THEN 5
          ELSE -8
        END
    ) AS confidence
  FROM work_updates u
  LEFT JOIN LATERAL (
    SELECT r.run_date
    FROM ops_runs r
    WHERE r.project_key = u.project_key
    ORDER BY r.run_date DESC
    LIMIT 1
  ) lr ON true
  WHERE u.status IN ('shipped', 'needs_review')
    AND u.project_key IS NOT NULL
    AND btrim(u.project_key) <> ''
),
selected AS (
  SELECT *
  FROM candidates c
  WHERE c.confidence >= 60
    AND NOT EXISTS (
      SELECT 1
      FROM ops_runs r
      WHERE r.source_update_id = c.id
    )
  ORDER BY c.checkpoint_at DESC
  LIMIT 8
)
INSERT INTO ops_runs (
  source_update_id,
  project_key,
  title,
  summary,
  status,
  trigger_source,
  trigger_confidence,
  trigger_reasons,
  run_date,
  commit_refs,
  checks_json,
  metrics_json,
  artifacts_json,
  next_steps,
  slug,
  created_at,
  updated_at
)
SELECT
  s.id,
  s.project_key,
  left('Run log: ' || s.summary, 180),
  COALESCE(NULLIF(btrim(s.why_it_matters), ''), s.summary),
  'draft',
  'auto_policy',
  LEAST(100, GREATEST(0, s.confidence)),
  array_remove(
    ARRAY[
      'Backfilled from shipped/needs_review update',
      'status=' || s.status,
      CASE WHEN s.commit_start IS NOT NULL AND s.commit_end IS NOT NULL THEN 'Commit range present' ELSE NULL END,
      CASE WHEN s.files_touched_count > 0 THEN 'files_touched_count=' || s.files_touched_count::text ELSE NULL END
    ]::TEXT[],
    NULL
  ),
  s.checkpoint_at,
  array_remove(ARRAY[s.commit_start, s.commit_end]::TEXT[], NULL),
  jsonb_build_object('source', 'migration_019', 'status', s.status),
  jsonb_build_object('files_touched_count', s.files_touched_count),
  jsonb_build_object('commit_url', s.commit_url, 'pr_url', s.pr_url),
  ARRAY[]::TEXT[],
  NULL,
  NOW(),
  NOW()
FROM selected s
ON CONFLICT (source_update_id) DO NOTHING;

WITH required_projects AS (
  SELECT
    p.project_key,
    p.project_label
  FROM ops_projects p
  WHERE p.project_key IN ('koopman-mpc', 'customer-agent-projects')
),
missing AS (
  SELECT
    rp.project_key,
    rp.project_label
  FROM required_projects rp
  WHERE NOT EXISTS (
    SELECT 1
    FROM ops_runs r
    WHERE r.project_key = rp.project_key
  )
)
INSERT INTO ops_runs (
  project_key,
  title,
  summary,
  status,
  trigger_source,
  trigger_confidence,
  trigger_reasons,
  run_date,
  commit_refs,
  checks_json,
  metrics_json,
  artifacts_json,
  next_steps,
  slug,
  created_at,
  updated_at
)
SELECT
  m.project_key,
  left(m.project_label || ' baseline run log', 180),
  'Initial draft run log seeded to bootstrap reporting visibility. Update this draft with latest shipped work.',
  'draft',
  'subagent',
  55,
  ARRAY['Baseline seed run log (migration_019)']::TEXT[],
  NOW(),
  ARRAY[]::TEXT[],
  jsonb_build_object('source', 'migration_019_seed'),
  '{}'::jsonb,
  '{}'::jsonb,
  ARRAY[]::TEXT[],
  m.project_key || '-' || to_char(NOW(), 'YYYY-MM-DD') || '-baseline-run-log',
  NOW(),
  NOW()
FROM missing m;
