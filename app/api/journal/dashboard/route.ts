import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

type EntryRow = {
  id: string;
  date: string;
};

type AnswerRow = {
  entry_id: string;
  question_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_json: unknown;
};

type QuestionRow = {
  id: string;
  key: string;
  question_type: string;
};

function toValue(row: AnswerRow, questionType: string): unknown {
  if (questionType === "number" || questionType === "rating") return row.value_number ?? null;
  if (questionType === "boolean") return row.value_boolean ?? null;
  if (questionType === "multiselect") return row.value_json ?? null;
  return row.value_text ?? null;
}

/**
 * GET /api/journal/dashboard
 * Returns submitted journal entries and answers grouped by day.
 */
export async function GET() {
  try {
    const { data: entryRows, error: entryError } = await supabase
      .from("journal_entry")
      .select("id, date, is_draft")
      .eq("is_draft", false)
      .order("date", { ascending: true });

    if (entryError) {
      console.error("Dashboard API: journal_entry error", entryError.message);
      return NextResponse.json({ error: entryError.message }, { status: 500 });
    }

    if (!entryRows || entryRows.length === 0) {
      return NextResponse.json({ entries: [], days: [] });
    }

    const ids = entryRows
      .map((e: EntryRow) => e.id)
      .filter((id: string) => typeof id === "string" && id.length > 0);

    if (ids.length === 0) {
      const days = entryRows.map((e: EntryRow) => ({ date: e.date, answers: {} }));
      return NextResponse.json({ entries: entryRows, days });
    }

    const { data: answersData, error: answersError } = await supabase
      .from("journal_answer")
      .select("entry_id, question_id, value_text, value_number, value_boolean, value_json")
      .in("entry_id", ids);

    if (answersError) {
      console.error("Dashboard API: journal_answer error", answersError.message);
      return NextResponse.json({ error: answersError.message }, { status: 500 });
    }

    const answerRows: AnswerRow[] = answersData ?? [];
    if (answerRows.length === 0) {
      const days = entryRows.map((e: EntryRow) => ({ date: e.date, answers: {} }));
      return NextResponse.json({ entries: entryRows, days });
    }

    const questionIds = [...new Set(answerRows.map((a) => a.question_id))];
    const { data: questionsData, error: questionsError } = await supabase
      .from("question_catalog")
      .select("id, key, question_type")
      .in("id", questionIds);

    if (questionsError) {
      console.error("Dashboard API: question_catalog error", questionsError.message);
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    const questionMap = new Map(
      (questionsData ?? []).map((q: QuestionRow) => [q.id, q])
    );

    const byEntry = new Map<string, Record<string, unknown>>();
    for (const answer of answerRows) {
      const question = questionMap.get(answer.question_id);
      if (!question?.key) continue;

      const value = toValue(answer, question.question_type);
      const current = byEntry.get(answer.entry_id) ?? {};
      current[question.key] = value;
      byEntry.set(answer.entry_id, current);
    }

    const days = entryRows.map((entry: EntryRow) => ({
      date: entry.date,
      answers: byEntry.get(entry.id) ?? {},
    }));

    return NextResponse.json({ entries: entryRows, days });
  } catch (err) {
    console.error("Dashboard API:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
