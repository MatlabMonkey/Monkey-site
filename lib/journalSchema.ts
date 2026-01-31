/**
 * Journal schema definition — single source of truth for the active question set.
 * Update this when adding/removing/editing questions. Run a migration to sync
 * question_catalog in the database.
 */

export type QuestionType = "text" | "number" | "rating" | "boolean" | "multiselect" | "date";

export type QuestionDef = {
  key: string;
  question_type: QuestionType;
  wording: string;
  description?: string;
  display_order: number;
  metadata?: Record<string, unknown>;
};

export const JOURNAL_QUESTION_SET: QuestionDef[] = [
  // Section 1 — Basic Metadata (Fast)
  { key: "day_date", question_type: "date", wording: "Date", description: "Use the actual date the day occurred (not when you're filling this out).", display_order: 1, metadata: {} },
  { key: "day_quality", question_type: "rating", wording: "Day Quality", description: "Overall, how \"good\" did the day feel? 0 = awful, 10 = amazing.", display_order: 2, metadata: { min: 0, max: 10, step: 1 } },
  { key: "productivity", question_type: "rating", wording: "Productivity", description: "How productive were you relative to what was realistically possible today? 0 = nothing meaningful, 10 = excellent execution.", display_order: 3, metadata: { min: 0, max: 10, step: 1 } },
  { key: "day_impact", question_type: "number", wording: "Plot (how impactful the day was)", description: "How impactful was this day? 0 = uneventful, higher = more significant.", display_order: 4, metadata: { min: 0, max: 10, step: 1 } },
  // Section 2 — Factual Summary (Memory Recall)
  { key: "daily_timeline_summary", question_type: "text", wording: "What did you do today? (Daily timeline summary)", description: "What were the main events and activities? Where were you, and who were you with? What was the rough order of the day (morning / afternoon / night)? Include concrete cues (names, places, \"first/then/after\").", display_order: 4, metadata: {} },
  { key: "anchor_memory", question_type: "text", wording: "The \"anchor memory\" of the day", description: "What is the one thing you most want to remember about today? If future-you could only read one line, what should it be?", display_order: 5, metadata: {} },
  // Section 3 — Internal State (Pattern Detection)
  { key: "energy", question_type: "rating", wording: "Energy", description: "0 = depleted, 10 = energized. Consider your average energy across the day.", display_order: 6, metadata: { min: 0, max: 10, step: 1 } },
  { key: "stress_calm", question_type: "rating", wording: "Stress / Calm", description: "0 = very calm, 10 = very stressed.", display_order: 7, metadata: { min: 0, max: 10, step: 1 } },
  { key: "focus_presence", question_type: "rating", wording: "Focus / Presence", description: "0 = scattered/distracted, 10 = deeply focused/present.", display_order: 8, metadata: { min: 0, max: 10, step: 1 } },
  { key: "sleep", question_type: "text", wording: "Sleep (last night)", description: "Hours slept (estimate). Optional: quality note (e.g., \"7.5h, restless\").", display_order: 9, metadata: {} },
  { key: "alcohol", question_type: "number", wording: "Alcohol", description: "Number of drinks today. (0 if none.)", display_order: 10, metadata: { min: 0, max: 50, step: 1 } },
  { key: "movement_training", question_type: "text", wording: "Movement / Training (optional but high value)", description: "What did you do? (e.g., \"lift,\" \"run 4mi,\" \"walk 30m,\" \"none\"). Optional: intensity (easy/moderate/hard).", display_order: 11, metadata: {} },
  { key: "social_connection", question_type: "rating", wording: "Social Connection", description: "0 = isolated, 10 = socially fulfilled/connected today.", display_order: 12, metadata: { min: 0, max: 10, step: 1 } },
  // Section 4 — Emotional Reflection
  { key: "emotions_triggers", question_type: "text", wording: "Emotions & triggers", description: "What emotions showed up today (name 2–5)? What triggered them? Any \"emotional spikes\" (positive or negative)?", display_order: 13, metadata: {} },
  { key: "reflection", question_type: "text", wording: "Reflection", description: "Any thoughts on the day or in general. Write down how you felt throughout the day. A space for thoughts that don't fit into other questions.", display_order: 14, metadata: {} },
  { key: "meaningful_moment", question_type: "text", wording: "Most meaningful moment", description: "What moment felt most emotionally significant, and why? What did it reveal about what you care about?", display_order: 15, metadata: {} },
  { key: "cope_reframe", question_type: "text", wording: "If something was hard: cope / reframe (optional)", description: "What did you do that helped? What would you tell a friend in the same situation? What's a more useful framing than the first one your brain offered?", display_order: 16, metadata: {} },
  // Section 5 — Evaluation (Wins, Misses, Learning)
  { key: "wins_proud", question_type: "text", wording: "Wins / what you're proud of", description: "What did you accomplish (big or small)? What choice are you glad you made? What did you do today that aligns with the person you want to be?", display_order: 17, metadata: {} },
  { key: "misses_friction", question_type: "text", wording: "Misses / friction", description: "What didn't go as planned? Where did you waste time, avoid something, or act out of alignment?", display_order: 18, metadata: {} },
  { key: "lesson_next_time", question_type: "text", wording: "Lesson + next time (turn the miss into data)", description: "What's the lesson in one sentence? What will you do differently next time? (Keep it specific.)", display_order: 19, metadata: {} },
  // Section 6 — Forward-Looking (Behavior Change)
  { key: "tomorrow_priority", question_type: "text", wording: "Tomorrow's #1 priority", description: "If tomorrow only goes well in one way, what should it be? Phrase as an action, not a vibe.", display_order: 20, metadata: {} },
  { key: "implementation_intention", question_type: "text", wording: "Implementation intention (high leverage)", description: "\"If [time/situation], then I will [specific action].\" Example: \"If it's 9:00am, then I start deep work for 60 minutes (phone away).\"", display_order: 21, metadata: {} },
  { key: "looking_forward", question_type: "text", wording: "Something you're looking forward to", description: "What's one thing tomorrow has that you can savor in advance?", display_order: 22, metadata: {} },
  // Extras: rose / bud / thorn + workouts + daily habits
  { key: "rose", question_type: "text", wording: "Rose", description: "Highlight of the day.", display_order: 23, metadata: {} },
  { key: "bud", question_type: "text", wording: "Bud", description: "Something you're looking forward to.", display_order: 24, metadata: {} },
  { key: "thorn", question_type: "text", wording: "Thorn", description: "Something that could have been better today.", display_order: 25, metadata: {} },
  {
    key: "workouts",
    question_type: "multiselect",
    wording: "Workouts / movement types",
    description: "Select all that apply for today's movement.",
    display_order: 26,
    metadata: { options: ["Push", "Pull", "Legs", "Full body", "Surfing", "Core", "Cardio"] },
  },
  {
    key: "daily_habits",
    question_type: "multiselect",
    wording: "Daily habits / checklist",
    description: "Daily habits and routines completed today.",
    display_order: 27,
    metadata: { options: ["Read ten pages", "Meditate", "In-person social time", "No Snooze", "Watch sunset", "Call parents or old friend", "Talked to a Stranger"] },
  },
];
