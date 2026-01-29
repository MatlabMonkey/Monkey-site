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
