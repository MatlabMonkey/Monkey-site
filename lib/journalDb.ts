/**
 * Journal database layer — Supabase CRUD for journal_entry, question_catalog, journal_answer.
 * Replaces localStorage-based journalStorage for the new flexible schema.
 */

import { supabase } from "./supabaseClient";

export type AnswerInput = {
  question_key: string;
  answer_value: unknown;
  answer_type: string;
};

export type JournalEntryRow = {
  id: string;
  date: string;
  is_draft: boolean;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AnswerOutput = {
  question_key: string;
  answer_value: unknown;
  answer_type: string;
};

export type EntryWithAnswers = {
  entry: JournalEntryRow | null;
  answers: AnswerOutput[];
};

// Map answer_value + answer_type into value_* columns
function toValueCols(
  value: unknown,
  answerType: string
): { value_text: string | null; value_number: number | null; value_boolean: boolean | null; value_json: unknown } {
  const out = { value_text: null as string | null, value_number: null as number | null, value_boolean: null as boolean | null, value_json: null as unknown };
  if (value === null || value === undefined) return out;

  switch (answerType) {
    case "text":
    case "date":
      out.value_text = typeof value === "string" ? value : String(value);
      break;
    case "number":
    case "rating":
      const n = typeof value === "number" ? value : Number(value);
      out.value_number = Number.isNaN(n) ? null : n;
      break;
    case "boolean":
      out.value_boolean = value === true || value === "true";
      break;
    case "multiselect":
      out.value_json = Array.isArray(value) ? value : value;
      break;
    default:
      out.value_text = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}

// Map value_* columns back to answer_value using question type
function fromValueCols(
  row: { value_text: string | null; value_number: number | null; value_boolean: boolean | null; value_json: unknown },
  answerType: string
): unknown {
  if (answerType === "text" || answerType === "date") return row.value_text ?? null;
  if (answerType === "number" || answerType === "rating") return row.value_number ?? null;
  if (answerType === "boolean") return row.value_boolean ?? null;
  if (answerType === "multiselect") return row.value_json ?? null;
  return row.value_text ?? row.value_number ?? row.value_boolean ?? row.value_json ?? null;
}

// Resolve question keys to ids
async function getQuestionIds(keys: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(keys)].filter(Boolean);
  if (uniq.length === 0) return new Map();
  const { data, error } = await supabase.from("question_catalog").select("id, key").in("key", uniq);
  if (error) throw error;
  const m = new Map<string, string>();
  for (const r of data || []) m.set(r.key, r.id);
  return m;
}

/**
 * Get entry and answers for a date (draft or submitted). Returns { entry: null, answers: [] } if none.
 */
export async function getEntry(date: string): Promise<EntryWithAnswers> {
  const dateStr = String(date).slice(0, 10);

  const { data: entryRow, error: eErr } = await supabase
    .from("journal_entry")
    .select("id, date, is_draft, completed_at, created_at, updated_at")
    .eq("date", dateStr)
    .maybeSingle();

  if (eErr) throw eErr;
  if (!entryRow) return { entry: null, answers: [] };

  const { data: answerRows, error: aErr } = await supabase
    .from("journal_answer")
    .select(`
      value_text, value_number, value_boolean, value_json,
      question_catalog!inner(key, question_type)
    `)
    .eq("entry_id", entryRow.id);

  if (aErr) throw aErr;

  const answers: AnswerOutput[] = (answerRows || []).map((r: any) => {
    const q = r.question_catalog || {};
    const qKey = q.key || "";
    const qType = q.question_type || "text";
    const val = fromValueCols(
      { value_text: r.value_text, value_number: r.value_number, value_boolean: r.value_boolean, value_json: r.value_json },
      qType
    );
    return { question_key: qKey, answer_value: val, answer_type: qType };
  });

  return {
    entry: {
      id: entryRow.id,
      date: entryRow.date,
      is_draft: entryRow.is_draft,
      completed_at: entryRow.completed_at,
      created_at: entryRow.created_at,
      updated_at: entryRow.updated_at,
    },
    answers,
  };
}

/**
 * Save or update a draft (is_draft=true, no completed_at).
 */
export async function saveDraft(date: string, answers: AnswerInput[]): Promise<EntryWithAnswers> {
  const dateStr = String(date).slice(0, 10);
  const keys = answers.map((a) => a.question_key);
  const keyToId = await getQuestionIds(keys);

  const { data: entryRow, error: uErr } = await supabase
    .from("journal_entry")
    .upsert(
      { date: dateStr, is_draft: true, completed_at: null, updated_at: new Date().toISOString() },
      { onConflict: "date", ignoreDuplicates: false }
    )
    .select("id, date, is_draft, completed_at, created_at, updated_at")
    .single();

  if (uErr) throw uErr;
  if (!entryRow) throw new Error("Upsert journal_entry did not return a row");

  // Replace answers: delete existing, insert current
  await supabase.from("journal_answer").delete().eq("entry_id", entryRow.id);

  const toInsert: Array<{ entry_id: string; question_id: string; value_text?: string; value_number?: number; value_boolean?: boolean; value_json?: unknown }> = [];
  for (const a of answers) {
    const qid = keyToId.get(a.question_key);
    if (!qid) continue;
    const { value_text, value_number, value_boolean, value_json } = toValueCols(a.answer_value, a.answer_type);
    const row: any = { entry_id: entryRow.id, question_id: qid };
    if (value_text != null) row.value_text = value_text;
    if (value_number != null) row.value_number = value_number;
    if (value_boolean != null) row.value_boolean = value_boolean;
    if (value_json != null) row.value_json = value_json;
    toInsert.push(row);
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from("journal_answer").insert(toInsert);
    if (insErr) throw insErr;
  }

  return getEntry(dateStr);
}

/**
 * Submit entry (is_draft=false, completed_at=now). Allows overwriting an existing submitted entry.
 */
export async function submitEntry(date: string, answers: AnswerInput[]): Promise<EntryWithAnswers> {
  const dateStr = String(date).slice(0, 10);
  const keys = answers.map((a) => a.question_key);
  const keyToId = await getQuestionIds(keys);

  const { data: entryRow, error: uErr } = await supabase
    .from("journal_entry")
    .upsert(
      {
        date: dateStr,
        is_draft: false,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "date", ignoreDuplicates: false }
    )
    .select("id, date, is_draft, completed_at, created_at, updated_at")
    .single();

  if (uErr) throw uErr;
  if (!entryRow) throw new Error("Upsert journal_entry did not return a row");

  await supabase.from("journal_answer").delete().eq("entry_id", entryRow.id);

  const toInsert: Array<{ entry_id: string; question_id: string; value_text?: string; value_number?: number; value_boolean?: boolean; value_json?: unknown }> = [];
  for (const a of answers) {
    const qid = keyToId.get(a.question_key);
    if (!qid) continue;
    const { value_text, value_number, value_boolean, value_json } = toValueCols(a.answer_value, a.answer_type);
    const row: any = { entry_id: entryRow.id, question_id: qid };
    if (value_text != null) row.value_text = value_text;
    if (value_number != null) row.value_number = value_number;
    if (value_boolean != null) row.value_boolean = value_boolean;
    if (value_json != null) row.value_json = value_json;
    toInsert.push(row);
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from("journal_answer").insert(toInsert);
    if (insErr) throw insErr;
  }

  return getEntry(dateStr);
}

/**
 * Check if an entry exists for the date and whether it is a draft.
 */
export async function entryExists(date: string): Promise<{ exists: boolean; is_draft: boolean }> {
  const dateStr = String(date).slice(0, 10);
  const { data, error } = await supabase
    .from("journal_entry")
    .select("is_draft")
    .eq("date", dateStr)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { exists: false, is_draft: false };
  return { exists: true, is_draft: !!data.is_draft };
}

export type SearchParams = { from?: string; to?: string; q?: string };

export type SearchResultItem = {
  id: string;
  date: string;
  is_draft: boolean;
  completed_at: string | null;
  answers: AnswerOutput[];
};

/**
 * Search entries by date range and optional text (ilike on value_text).
 */
export async function searchEntries(params: SearchParams): Promise<SearchResultItem[]> {
  const { from, to, q } = params;
  let entryIds: string[] | null = null;

  if (q && q.trim()) {
    const { data: ans, error: ae } = await supabase
      .from("journal_answer")
      .select("entry_id")
      .ilike("value_text", "%" + q.trim() + "%");
    if (!ae && ans && ans.length > 0) {
      entryIds = [...new Set(ans.map((a: { entry_id: string }) => a.entry_id))];
    } else {
      return [];
    }
  }

  let qb = supabase
    .from("journal_entry")
    .select("id, date, is_draft, completed_at")
    .order("date", { ascending: false })
    .limit(200);
  if (from) qb = qb.gte("date", from.slice(0, 10));
  if (to) qb = qb.lte("date", to.slice(0, 10));
  if (entryIds && entryIds.length > 0) qb = qb.in("id", entryIds);

  const { data: entries, error: eErr } = await qb;
  if (eErr) throw eErr;
  if (!entries || entries.length === 0) return [];

  const ids = entries.map((e) => e.id);
  const { data: answerRows, error: aErr } = await supabase
    .from("journal_answer")
    .select("entry_id, value_text, value_number, value_boolean, value_json, question_catalog!inner(key, question_type)")
    .in("entry_id", ids);

  if (aErr) throw aErr;

  const byEntry = new Map<string, AnswerOutput[]>();
  for (const r of answerRows || []) {
    const eid = (r as any).entry_id;
    const q = (r as any).question_catalog || {};
    const val = fromValueCols(
      { value_text: r.value_text, value_number: r.value_number, value_boolean: r.value_boolean, value_json: r.value_json },
      q.question_type || "text"
    );
    const list = byEntry.get(eid) || [];
    list.push({ question_key: q.key || "", answer_value: val, answer_type: q.question_type || "text" });
    byEntry.set(eid, list);
  }

  return entries.map((e) => ({
    id: e.id,
    date: e.date,
    is_draft: e.is_draft,
    completed_at: e.completed_at,
    answers: byEntry.get(e.id) || [],
  }));
}

export type ExploreParams = {
  type: string;
  // Numeric filter
  question_key?: string;
  operator?: ">=" | "<=" | "=" | "between";
  value?: number;
  value2?: number; // for "between"
  // Text search
  search_text?: string;
  search_fields?: string[]; // question keys to search in
  // People search/count
  person_name?: string;
  // Workout/habit filters
  workout_types?: string[];
  habit_types?: string[];
  // Rose/bud/thorn
  rbt_field?: "rose" | "bud" | "thorn";
  rbt_search?: string;
  // Date patterns
  day_of_week?: number; // 0-6 (Sunday-Saturday)
  month?: number; // 1-12
  year?: number;
  // Date range (always available)
  from?: string;
  to?: string;
  // Combination
  conditions?: Array<{
    question_key: string;
    operator: string;
    value: unknown;
    value2?: unknown; // for "between" operator
    question_type: string;
  }>;
  logic?: "AND" | "OR";
  // Streaks
  streak_condition?: {
    question_key: string;
    operator: string;
    value: unknown;
    question_type: string;
  };
};

/**
 * Advanced exploration of journal entries with various query types.
 */
export async function exploreEntries(params: ExploreParams): Promise<SearchResultItem[]> {
  const { type, from, to } = params;
  let entryIds: string[] | null = null;

  // Build query based on type
  if (type === "numeric") {
    const { question_key, operator, value, value2 } = params;
    if (!question_key || operator === undefined || value === undefined) return [];

    const qIds = await getQuestionIds([question_key]);
    const qId = qIds.get(question_key);
    if (!qId) return [];

    // Get question type to know which column to query
    const { data: qData } = await supabase.from("question_catalog").select("question_type").eq("id", qId).single();
    const qType = qData?.question_type || "number";

    let qb = supabase.from("journal_answer").select("entry_id");
    if (qType === "number" || qType === "rating") {
      if (operator === ">=") qb = qb.eq("question_id", qId).gte("value_number", value);
      else if (operator === "<=") qb = qb.eq("question_id", qId).lte("value_number", value);
      else if (operator === "=") qb = qb.eq("question_id", qId).eq("value_number", value);
      else if (operator === "between" && value2 !== undefined) {
        qb = qb.eq("question_id", qId).gte("value_number", value).lte("value_number", value2);
      }
    } else {
      return []; // Only numeric/rating supported
    }

    const { data: ans, error } = await qb;
    if (error || !ans || ans.length === 0) return [];
    entryIds = [...new Set(ans.map((a: { entry_id: string }) => a.entry_id))];
  } else if (type === "people" || type === "people_count") {
    const { person_name } = params;
    if (!person_name || !person_name.trim()) return [];

    // Search in text fields that might contain people names
    const searchFields = params.search_fields || [
      "daily_timeline_summary",
      "people_met",
      "reflection",
      "wins_proud",
      "meaningful_moment",
    ];
    const qIds = await getQuestionIds(searchFields);
    const qIdList = Array.from(qIds.values());

    if (qIdList.length === 0) return [];

    const { data: ans, error } = await supabase
      .from("journal_answer")
      .select("entry_id")
      .in("question_id", qIdList)
      .ilike("value_text", "%" + person_name.trim() + "%");

    if (error || !ans || ans.length === 0) return [];
    entryIds = [...new Set(ans.map((a: { entry_id: string }) => a.entry_id))];
  } else if (type === "activity") {
    const { search_text } = params;
    if (!search_text || !search_text.trim()) return [];

    const searchFields = params.search_fields || ["daily_timeline_summary", "reflection"];
    const qIds = await getQuestionIds(searchFields);
    const qIdList = Array.from(qIds.values());

    if (qIdList.length === 0) return [];

    const { data: ans, error } = await supabase
      .from("journal_answer")
      .select("entry_id")
      .in("question_id", qIdList)
      .ilike("value_text", "%" + search_text.trim() + "%");

    if (error || !ans || ans.length === 0) return [];
    entryIds = [...new Set(ans.map((a: { entry_id: string }) => a.entry_id))];
  } else if (type === "workout") {
    const { workout_types } = params;
    if (!workout_types || workout_types.length === 0) return [];

    const qIds = await getQuestionIds(["workouts"]);
    const qId = qIds.get("workouts");
    if (!qId) return [];

    // For multiselect, we need to check if value_json contains any of the workout types
    // Supabase JSONB contains operator: @>
    const { data: ans, error } = await supabase
      .from("journal_answer")
      .select("entry_id, value_json")
      .eq("question_id", qId);

    if (error || !ans || ans.length === 0) return [];

    // Filter entries where value_json array contains any workout type
    const matching = ans.filter((a: any) => {
      const arr = Array.isArray(a.value_json) ? a.value_json : [];
      return workout_types.some((wt) => arr.includes(wt));
    });

    entryIds = [...new Set(matching.map((a: { entry_id: string }) => a.entry_id))];
  } else if (type === "habit") {
    const { habit_types } = params;
    if (!habit_types || habit_types.length === 0) return [];

    const qIds = await getQuestionIds(["daily_habits"]);
    const qId = qIds.get("daily_habits");
    if (!qId) return [];

    const { data: ans, error } = await supabase
      .from("journal_answer")
      .select("entry_id, value_json")
      .eq("question_id", qId);

    if (error || !ans || ans.length === 0) return [];

    const matching = ans.filter((a: any) => {
      const arr = Array.isArray(a.value_json) ? a.value_json : [];
      return habit_types.some((ht) => arr.includes(ht));
    });

    entryIds = [...new Set(matching.map((a: { entry_id: string }) => a.entry_id))];
  } else if (type === "text_search") {
    const { search_text, search_fields } = params;
    if (!search_text || !search_text.trim()) return [];

    const fields = search_fields || [
      "daily_timeline_summary",
      "reflection",
      "wins_proud",
      "misses_friction",
      "rose",
      "bud",
      "thorn",
    ];
    const qIds = await getQuestionIds(fields);
    const qIdList = Array.from(qIds.values());

    if (qIdList.length === 0) return [];

    const { data: ans, error } = await supabase
      .from("journal_answer")
      .select("entry_id")
      .in("question_id", qIdList)
      .ilike("value_text", "%" + search_text.trim() + "%");

    if (error || !ans || ans.length === 0) return [];
    entryIds = [...new Set(ans.map((a: { entry_id: string }) => a.entry_id))];
  } else if (type === "rbt") {
    const { rbt_field, rbt_search } = params;
    if (!rbt_field) return [];

    const qIds = await getQuestionIds([rbt_field]);
    const qId = qIds.get(rbt_field);
    if (!qId) return [];

    let qb = supabase.from("journal_answer").select("entry_id").eq("question_id", qId);
    if (rbt_search && rbt_search.trim()) {
      qb = qb.ilike("value_text", "%" + rbt_search.trim() + "%");
    } else {
      // Just check that field is non-empty
      qb = qb.not("value_text", "is", null).neq("value_text", "");
    }

    const { data: ans, error } = await qb;
    if (error || !ans || ans.length === 0) return [];
    entryIds = [...new Set(ans.map((a: { entry_id: string }) => a.entry_id))];
  } else if (type === "date_pattern") {
    // Filter by day of week, month, or year
    const { day_of_week, month, year } = params;

    // We'll filter entries by date, then check if they match the pattern
    let qb = supabase.from("journal_entry").select("id, date");
    if (from) qb = qb.gte("date", from.slice(0, 10));
    if (to) qb = qb.lte("date", to.slice(0, 10));

    const { data: entries, error } = await qb;
    if (error || !entries || entries.length === 0) return [];

    const matching = entries.filter((e: any) => {
      const d = new Date(e.date + "T00:00:00");
      if (day_of_week !== undefined && d.getDay() !== day_of_week) return false;
      if (month !== undefined && d.getMonth() + 1 !== month) return false;
      if (year !== undefined && d.getFullYear() !== year) return false;
      return true;
    });

    entryIds = matching.map((e: any) => e.id);
  } else if (type === "combination") {
    const { conditions, logic } = params;
    if (!conditions || conditions.length === 0) return [];

    const logicOp = logic || "AND";
    const allEntryIds: string[][] = [];

    for (const cond of conditions) {
      const { question_key, operator, value, question_type } = cond;
      if (!question_key || operator === undefined) continue;

      const qIds = await getQuestionIds([question_key]);
      const qId = qIds.get(question_key);
      if (!qId) continue;

      let qb = supabase.from("journal_answer").select("entry_id").eq("question_id", qId);

      if (question_type === "number" || question_type === "rating") {
        if (operator === ">=") qb = qb.gte("value_number", Number(value));
        else if (operator === "<=") qb = qb.lte("value_number", Number(value));
        else if (operator === "=") qb = qb.eq("value_number", Number(value));
        else if (operator === "between" && cond.value2 !== undefined) {
          qb = qb.gte("value_number", Number(value)).lte("value_number", Number(cond.value2));
        }
      } else if (question_type === "text") {
        if (operator === "contains") {
          qb = qb.ilike("value_text", "%" + String(value) + "%");
        } else if (operator === "=") {
          qb = qb.eq("value_text", String(value));
        }
      } else if (question_type === "multiselect") {
        if (operator === "contains") {
          const { data: ans } = await supabase
            .from("journal_answer")
            .select("entry_id, value_json")
            .eq("question_id", qId);
          if (ans) {
            const matching = ans.filter((a: any) => {
              const arr = Array.isArray(a.value_json) ? a.value_json : [];
              return arr.includes(String(value));
            });
            allEntryIds.push(matching.map((a: { entry_id: string }) => a.entry_id));
            continue;
          }
        }
      }

      const { data: ans, error } = await qb;
      if (error || !ans || ans.length === 0) {
        if (logicOp === "AND") return [];
        continue;
      }
      allEntryIds.push(ans.map((a: { entry_id: string }) => a.entry_id));
    }

    if (allEntryIds.length === 0) return [];

    if (logicOp === "AND") {
      // Intersection: entries that match ALL conditions
      if (allEntryIds.length === 0) return [];
      entryIds = allEntryIds.reduce((acc, ids) => {
        if (acc.length === 0) return [];
        return acc.filter((id) => ids.includes(id));
      }, allEntryIds[0] || []);
    } else {
      // Union: entries that match ANY condition
      entryIds = [...new Set(allEntryIds.flat())];
    }
  } else if (type === "streak") {
    const { streak_condition } = params;
    if (!streak_condition) return [];

    // First get all entries matching the condition
    const { question_key, operator, value, question_type } = streak_condition;
    const qIds = await getQuestionIds([question_key]);
    const qId = qIds.get(question_key);
    if (!qId) return [];

    let qb = supabase.from("journal_answer").select("entry_id").eq("question_id", qId);

    if (question_type === "number" || question_type === "rating") {
      if (operator === ">=") qb = qb.gte("value_number", Number(value));
      else if (operator === "<=") qb = qb.lte("value_number", Number(value));
      else if (operator === "=") qb = qb.eq("value_number", Number(value));
    } else if (question_type === "multiselect" && operator === "contains") {
      const { data: ans } = await supabase
        .from("journal_answer")
        .select("entry_id, value_json")
        .eq("question_id", qId);
      if (ans) {
        const matching = ans.filter((a: any) => {
          const arr = Array.isArray(a.value_json) ? a.value_json : [];
          return arr.includes(String(value));
        });
        entryIds = [...new Set(matching.map((a: { entry_id: string }) => a.entry_id))];
      }
    } else {
      const { data: ans, error } = await qb;
      if (error || !ans || ans.length === 0) return [];
      entryIds = [...new Set(ans.map((a: { entry_id: string }) => a.entry_id))];
    }

    // For streaks, we need to get entries in date order and find consecutive sequences
    // This will be handled in the API layer after fetching entries
  }

  // Now fetch entries matching the filters
  let qb = supabase
    .from("journal_entry")
    .select("id, date, is_draft, completed_at")
    .order("date", { ascending: false })
    .limit(500);

  if (from) qb = qb.gte("date", from.slice(0, 10));
  if (to) qb = qb.lte("date", to.slice(0, 10));
  if (entryIds && entryIds.length > 0) {
    qb = qb.in("id", entryIds);
  } else if (entryIds !== null && entryIds.length === 0) {
    // No matching entries found
    return [];
  }

  const { data: entries, error: eErr } = await qb;
  if (eErr) throw eErr;
  if (!entries || entries.length === 0) return [];

  // For streaks, detect consecutive sequences
  if (type === "streak" && entries.length > 0) {
    // Sort by date ascending for streak detection
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const streaks: SearchResultItem[][] = [];
    let currentStreak: typeof entries = [];

    for (let i = 0; i < sorted.length; i++) {
      const curr = sorted[i];
      if (currentStreak.length === 0) {
        currentStreak.push(curr);
      } else {
        const prev = currentStreak[currentStreak.length - 1];
        const prevDate = new Date(prev.date + "T00:00:00");
        const currDate = new Date(curr.date + "T00:00:00");
        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
          // Consecutive day
          currentStreak.push(curr);
        } else {
          // Break in streak
          if (currentStreak.length > 1) {
            streaks.push(currentStreak as any);
          }
          currentStreak = [curr];
        }
      }
    }
    if (currentStreak.length > 1) {
      streaks.push(currentStreak as any);
    }

    // Return only entries that are part of streaks (length > 1)
    const streakEntryIds = new Set(streaks.flat().map((e: any) => e.id));
    const filtered = entries.filter((e) => streakEntryIds.has(e.id));
    if (filtered.length === 0) return [];

    const ids = filtered.map((e) => e.id);
    const { data: answerRows, error: aErr } = await supabase
      .from("journal_answer")
      .select("entry_id, value_text, value_number, value_boolean, value_json, question_catalog!inner(key, question_type)")
      .in("entry_id", ids);

    if (aErr) throw aErr;

    const byEntry = new Map<string, AnswerOutput[]>();
    for (const r of answerRows || []) {
      const eid = (r as any).entry_id;
      const q = (r as any).question_catalog || {};
      const val = fromValueCols(
        { value_text: r.value_text, value_number: r.value_number, value_boolean: r.value_boolean, value_json: r.value_json },
        q.question_type || "text"
      );
      const list = byEntry.get(eid) || [];
      list.push({ question_key: q.key || "", answer_value: val, answer_type: q.question_type || "text" });
      byEntry.set(eid, list);
    }

    return filtered.map((e) => ({
      id: e.id,
      date: e.date,
      is_draft: e.is_draft,
      completed_at: e.completed_at,
      answers: byEntry.get(e.id) || [],
    }));
  }

  // Standard path: fetch answers for matching entries
  const ids = entries.map((e) => e.id);
  const { data: answerRows, error: aErr } = await supabase
    .from("journal_answer")
    .select("entry_id, value_text, value_number, value_boolean, value_json, question_catalog!inner(key, question_type)")
    .in("entry_id", ids);

  if (aErr) throw aErr;

  const byEntry = new Map<string, AnswerOutput[]>();
  for (const r of answerRows || []) {
    const eid = (r as any).entry_id;
    const q = (r as any).question_catalog || {};
    const val = fromValueCols(
      { value_text: r.value_text, value_number: r.value_number, value_boolean: r.value_boolean, value_json: r.value_json },
      q.question_type || "text"
    );
    const list = byEntry.get(eid) || [];
    list.push({ question_key: q.key || "", answer_value: val, answer_type: q.question_type || "text" });
    byEntry.set(eid, list);
  }

  return entries.map((e) => ({
    id: e.id,
    date: e.date,
    is_draft: e.is_draft,
    completed_at: e.completed_at,
    answers: byEntry.get(e.id) || [],
  }));
}
