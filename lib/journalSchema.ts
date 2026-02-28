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
  { key: "day_date", question_type: "date", wording: "Date", description: "Use the actual date the day occurred (not when you're filling this out).", display_order: 1, metadata: {} },
  { key: "daily_timeline_summary", question_type: "text", wording: "What did you do today?", description: "What were the main events and activities? Where were you, and who were you with? What was the rough order of the day (morning / afternoon / night)? Include concrete cues (names, places, first/then/after).", display_order: 2, metadata: {} },
  { key: "anchor_memory", question_type: "text", wording: "The anchor memory of the day", description: "What is the one thing you most want to remember about today? If future-you could only read one line, what should it be?", display_order: 3, metadata: {} },
  { key: "reflection", question_type: "text", wording: "Reflection", description: "How did you feel today? What emotions showed up and what triggered them? Any thoughts on the day, positive or negative emotional spikes, or things that don't fit elsewhere.", display_order: 4, metadata: {} },
  { key: "rose", question_type: "text", wording: "Rose (highlight / win)", description: "Highlight of the day. What went well? What are you proud of?", display_order: 5, metadata: {} },
  { key: "thorn", question_type: "text", wording: "Thorn (miss + lesson)", description: "What could have been better today? What is the takeaway or lesson?", display_order: 6, metadata: {} },
  { key: "day_quality", question_type: "rating", wording: "Day Quality", description: "Overall, how good did the day feel? 0 = awful, 10 = amazing.", display_order: 7, metadata: { min: 0, max: 10, step: 1 } },
  { key: "productivity", question_type: "rating", wording: "Productivity", description: "How productive were you relative to what was realistically possible today? 0 = nothing meaningful, 10 = excellent execution.", display_order: 8, metadata: { min: 0, max: 10, step: 1 } },
  { key: "day_impact", question_type: "rating", wording: "Plot (how impactful the day was)", description: "How impactful was this day? 0 = uneventful, 10 = very significant.", display_order: 9, metadata: { min: 0, max: 10, step: 1 } },
  { key: "energy", question_type: "rating", wording: "Energy", description: "0 = depleted, 10 = energized. Consider your average energy across the day.", display_order: 10, metadata: { min: 0, max: 10, step: 1 } },
  { key: "stress_calm", question_type: "rating", wording: "Stress / Calm", description: "0 = very calm, 10 = very stressed.", display_order: 11, metadata: { min: 0, max: 10, step: 1 } },
  { key: "focus_presence", question_type: "rating", wording: "Focus / Presence", description: "0 = scattered/distracted, 10 = deeply focused/present.", display_order: 12, metadata: { min: 0, max: 10, step: 1 } },
  { key: "social_connection", question_type: "rating", wording: "Social Connection", description: "0 = isolated, 10 = socially fulfilled/connected today.", display_order: 13, metadata: { min: 0, max: 10, step: 1 } },
  { key: "sleep", question_type: "text", wording: "Sleep (last night)", description: "Hours slept (estimate). Optional: quality note (e.g., 7.5h, restless).", display_order: 14, metadata: {} },
  { key: "alcohol", question_type: "number", wording: "Alcohol", description: "Number of drinks today. (0 if none.)", display_order: 15, metadata: { min: 0, max: 50, step: 1 } },
  { key: "tomorrow_priority", question_type: "text", wording: "Tomorrow's #1 priority", description: "If tomorrow only goes well in one way, what should it be? Phrase as an action, not a vibe.", display_order: 16, metadata: {} },
  {
    key: "workouts",
    question_type: "multiselect",
    wording: "Workouts / movement types",
    description: "Select all that apply for today's movement.",
    display_order: 17,
    metadata: { options: ["Push", "Pull", "Legs", "Full body", "Surfing", "Core", "Cardio"] },
  },
  {
    key: "daily_habits",
    question_type: "multiselect",
    wording: "Daily habits / checklist",
    description: "Daily habits and routines completed today.",
    display_order: 18,
    metadata: { options: ["Read ten pages", "Meditate", "In-person social time", "No Snooze", "Watch sunset", "Call parents or old friend", "Talked to a Stranger"] },
  },
];
