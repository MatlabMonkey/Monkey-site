-- Trim journal questions to the new 18-question set.
-- Keeps/updates current keys, inserts missing keys, and removes deprecated keys.

BEGIN;

INSERT INTO question_catalog (key, question_type, wording, description, display_order, metadata)
VALUES
  ('day_date', 'date', 'Date', 'Use the actual date the day occurred (not when you''re filling this out).', 1, '{}'::jsonb),
  ('daily_timeline_summary', 'text', 'What did you do today?', 'What were the main events and activities? Where were you, and who were you with? What was the rough order of the day (morning / afternoon / night)? Include concrete cues (names, places, first/then/after).', 2, '{}'::jsonb),
  ('anchor_memory', 'text', 'The anchor memory of the day', 'What is the one thing you most want to remember about today? If future-you could only read one line, what should it be?', 3, '{}'::jsonb),
  ('reflection', 'text', 'Reflection', 'How did you feel today? What emotions showed up and what triggered them? Any thoughts on the day, positive or negative emotional spikes, or things that don''t fit elsewhere.', 4, '{}'::jsonb),
  ('rose', 'text', 'Rose (highlight / win)', 'Highlight of the day. What went well? What are you proud of?', 5, '{}'::jsonb),
  ('thorn', 'text', 'Thorn (miss + lesson)', 'What could have been better today? What is the takeaway or lesson?', 6, '{}'::jsonb),
  ('day_quality', 'rating', 'Day Quality', 'Overall, how good did the day feel? 0 = awful, 10 = amazing.', 7, '{"min":0,"max":10,"step":1}'::jsonb),
  ('productivity', 'rating', 'Productivity', 'How productive were you relative to what was realistically possible today? 0 = nothing meaningful, 10 = excellent execution.', 8, '{"min":0,"max":10,"step":1}'::jsonb),
  ('day_impact', 'rating', 'Plot (how impactful the day was)', 'How impactful was this day? 0 = uneventful, 10 = very significant.', 9, '{"min":0,"max":10,"step":1}'::jsonb),
  ('energy', 'rating', 'Energy', '0 = depleted, 10 = energized. Consider your average energy across the day.', 10, '{"min":0,"max":10,"step":1}'::jsonb),
  ('stress_calm', 'rating', 'Stress / Calm', '0 = very calm, 10 = very stressed.', 11, '{"min":0,"max":10,"step":1}'::jsonb),
  ('focus_presence', 'rating', 'Focus / Presence', '0 = scattered/distracted, 10 = deeply focused/present.', 12, '{"min":0,"max":10,"step":1}'::jsonb),
  ('social_connection', 'rating', 'Social Connection', '0 = isolated, 10 = socially fulfilled/connected today.', 13, '{"min":0,"max":10,"step":1}'::jsonb),
  ('sleep', 'text', 'Sleep (last night)', 'Hours slept (estimate). Optional: quality note (e.g., 7.5h, restless).', 14, '{}'::jsonb),
  ('alcohol', 'number', 'Alcohol', 'Number of drinks today. (0 if none.)', 15, '{"min":0,"max":50,"step":1}'::jsonb),
  ('tomorrow_priority', 'text', 'Tomorrow''s #1 priority', 'If tomorrow only goes well in one way, what should it be? Phrase as an action, not a vibe.', 16, '{}'::jsonb),
  ('workouts', 'multiselect', 'Workouts / movement types', 'Select all that apply for today''s movement.', 17, '{"options":["Push","Pull","Legs","Full body","Surfing","Core","Cardio"]}'::jsonb),
  ('daily_habits', 'multiselect', 'Daily habits / checklist', 'Daily habits and routines completed today.', 18, '{"options":["Read ten pages","Meditate","In-person social time","No Snooze","Watch sunset","Call parents or old friend","Talked to a Stranger"]}'::jsonb)
ON CONFLICT (key) DO UPDATE
SET
  question_type = EXCLUDED.question_type,
  wording = EXCLUDED.wording,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata,
  updated_at = now();

WITH removed_questions AS (
  SELECT id
  FROM question_catalog
  WHERE key IN (
    'meaningful_moment',
    'cope_reframe',
    'wins_proud',
    'misses_friction',
    'lesson_next_time',
    'emotions_triggers',
    'movement_training',
    'bud',
    'implementation_intention',
    'looking_forward'
  )
)
DELETE FROM journal_answer
WHERE question_id IN (SELECT id FROM removed_questions);

DELETE FROM question_catalog
WHERE key IN (
  'meaningful_moment',
  'cope_reframe',
  'wins_proud',
  'misses_friction',
  'lesson_next_time',
  'emotions_triggers',
  'movement_training',
  'bud',
  'implementation_intention',
  'looking_forward'
);

COMMIT;
