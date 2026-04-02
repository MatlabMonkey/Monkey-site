-- Update journal plot score scale from 0-10 to 0-5.
UPDATE question_catalog
SET
  description = 'How impactful was this day? 0 = uneventful, 5 = very significant.',
  metadata = jsonb_set(
    jsonb_set(COALESCE(metadata, '{}'::jsonb), '{min}', '0'::jsonb, true),
    '{max}',
    '5'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE key = 'day_impact';

-- Backfill existing values into the new range.
UPDATE journal_answer ja
SET value_number = 5
FROM question_catalog qc
WHERE ja.question_id = qc.id
  AND qc.key = 'day_impact'
  AND ja.value_number > 5;
