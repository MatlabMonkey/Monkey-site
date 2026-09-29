BEGIN;

UPDATE public.question_catalog
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{max}', '20'::jsonb, true)
WHERE key = 'alcohol';

COMMIT;
