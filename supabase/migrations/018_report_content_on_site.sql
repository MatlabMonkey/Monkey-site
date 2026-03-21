ALTER TABLE work_reports
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS html_content TEXT,
  ADD COLUMN IF NOT EXISTS content_md TEXT,
  ADD COLUMN IF NOT EXISTS content_json JSONB,
  ADD COLUMN IF NOT EXISTS asset_base_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_reports_slug_format'
      AND conrelid = 'work_reports'::regclass
  ) THEN
    ALTER TABLE work_reports
      ADD CONSTRAINT work_reports_slug_format
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_reports_slug_unique
  ON work_reports(slug)
  WHERE slug IS NOT NULL;

-- If a report already has a slug, ensure report_url points to its on-site route.
UPDATE work_reports
SET report_url = '/reports/' || slug,
    updated_at = NOW()
WHERE slug IS NOT NULL
  AND btrim(slug) <> ''
  AND report_url <> ('/reports/' || slug);
