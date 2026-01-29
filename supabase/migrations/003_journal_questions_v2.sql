-- Clear old journal data and seed new 21-question set.
-- Order: answers first (FK to entry and question), then entries, then questions.

DELETE FROM journal_answer;
DELETE FROM journal_entry;
DELETE FROM question_catalog;

-- Section 1 — Basic Metadata (Fast)
-- Section 2 — Factual Summary (Memory Recall)
-- Section 3 — Internal State (Pattern Detection)
-- Section 4 — Emotional Reflection
-- Section 5 — Evaluation (Wins, Misses, Learning)
-- Section 6 — Forward-Looking (Behavior Change)

INSERT INTO question_catalog (key, question_type, wording, description, display_order, metadata) VALUES
  ('day_date', 'date', 'Date', 'Use the actual date the day occurred (not when you''re filling this out).', 1, '{}'),
  ('day_quality', 'rating', 'Day Quality', 'Overall, how "good" did the day feel? 0 = awful, 10 = amazing.', 2, '{"min":0,"max":10,"step":1}'),
  ('productivity', 'rating', 'Productivity', 'How productive were you relative to what was realistically possible today? 0 = nothing meaningful, 10 = excellent execution.', 3, '{"min":0,"max":10,"step":1}'),
  ('daily_timeline_summary', 'text', 'What did you do today? (Daily timeline summary)', 'What were the main events and activities? Where were you, and who were you with? What was the rough order of the day (morning / afternoon / night)? Include concrete cues (names, places, "first/then/after").', 4, '{}'),
  ('anchor_memory', 'text', 'The "anchor memory" of the day', 'What is the one thing you most want to remember about today? If future-you could only read one line, what should it be?', 5, '{}'),
  ('energy', 'rating', 'Energy', '0 = depleted, 10 = energized. Consider your average energy across the day.', 6, '{"min":0,"max":10,"step":1}'),
  ('stress_calm', 'rating', 'Stress / Calm', '0 = very calm, 10 = very stressed.', 7, '{"min":0,"max":10,"step":1}'),
  ('focus_presence', 'rating', 'Focus / Presence', '0 = scattered/distracted, 10 = deeply focused/present.', 8, '{"min":0,"max":10,"step":1}'),
  ('sleep', 'text', 'Sleep (last night)', 'Hours slept (estimate). Optional: quality note (e.g., "7.5h, restless").', 9, '{}'),
  ('alcohol', 'number', 'Alcohol', 'Number of drinks today. (0 if none.)', 10, '{"min":0,"max":50,"step":1}'),
  ('movement_training', 'text', 'Movement / Training (optional but high value)', 'What did you do? (e.g., "lift," "run 4mi," "walk 30m," "none"). Optional: intensity (easy/moderate/hard).', 11, '{}'),
  ('social_connection', 'rating', 'Social Connection', '0 = isolated, 10 = socially fulfilled/connected today.', 12, '{"min":0,"max":10,"step":1}'),
  ('emotions_triggers', 'text', 'Emotions & triggers', 'What emotions showed up today (name 2–5)? What triggered them? Any "emotional spikes" (positive or negative)?', 13, '{}'),
  ('meaningful_moment', 'text', 'Most meaningful moment', 'What moment felt most emotionally significant, and why? What did it reveal about what you care about?', 14, '{}'),
  ('cope_reframe', 'text', 'If something was hard: cope / reframe (optional)', 'What did you do that helped? What would you tell a friend in the same situation? What''s a more useful framing than the first one your brain offered?', 15, '{}'),
  ('wins_proud', 'text', 'Wins / what you''re proud of', 'What did you accomplish (big or small)? What choice are you glad you made? What did you do today that aligns with the person you want to be?', 16, '{}'),
  ('misses_friction', 'text', 'Misses / friction', 'What didn''t go as planned? Where did you waste time, avoid something, or act out of alignment?', 17, '{}'),
  ('lesson_next_time', 'text', 'Lesson + next time (turn the miss into data)', 'What''s the lesson in one sentence? What will you do differently next time? (Keep it specific.)', 18, '{}'),
  ('tomorrow_priority', 'text', 'Tomorrow''s #1 priority', 'If tomorrow only goes well in one way, what should it be? Phrase as an action, not a vibe.', 19, '{}'),
  ('implementation_intention', 'text', 'Implementation intention (high leverage)', '"If [time/situation], then I will [specific action]." Example: "If it''s 9:00am, then I start deep work for 60 minutes (phone away)."', 20, '{}'),
  ('looking_forward', 'text', 'Something you''re looking forward to', 'What''s one thing tomorrow has that you can savor in advance?', 21, '{}'),
  -- Added v2.1: rose / bud / thorn + workouts
  ('rose', 'text', 'Rose', 'Highlight of the day.', 22, '{}'),
  ('bud', 'text', 'Bud', 'Something you''re looking forward to.', 23, '{}'),
  ('thorn', 'text', 'Thorn', 'Something that could have been better today.', 24, '{}'),
  ('workouts', 'multiselect', 'Workouts / movement types', 'Select all that apply for today''s movement.', 25, '{"options":["Push","Pull","Legs","Full body","Surfing","Core","Cardio"]}');
