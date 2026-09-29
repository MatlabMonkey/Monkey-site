BEGIN;

UPDATE public.question_catalog
SET wording = 'Stress'
WHERE key = 'stress_calm';

COMMIT;
