import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

/**
 * GET /api/journal/dashboard
 * Returns submitted journal entries and their answers for the dashboard.
 * Fetches server-side to avoid client Supabase .in() 400 Bad Request issues.
 */
export async function GET() {
  try {
    const { data: entryRows, error: entryError } = await supabase
      .from("journal_entry")
      .select("id, date, is_draft, completed_at")
      .eq("is_draft", false)
      .order("date", { ascending: true });

    if (entryError) {
      console.error("Dashboard API: journal_entry error", entryError.message);
      return NextResponse.json(
        { error: entryError.message },
        { status: 500 }
      );
    }

    if (!entryRows || entryRows.length === 0) {
      return NextResponse.json({ entries: [], days: [] });
    }

    const ids = entryRows
      .map((e: { id: string }) => e.id)
      .filter((id: string) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id));

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/91d60c32-6f9a-4241-b639-622d722a080e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "app/api/journal/dashboard/route.ts:ids",
        message: "Entry IDs before journal_answer query",
        data: { entryCount: entryRows.length, idsLength: ids.length, firstId: ids[0] ?? null, idsOver100: ids.length > 100 },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "H1-H2",
      }),
    }).catch(() => {});
    // #endregion agent log

    if (ids.length === 0) {
      const days = entryRows.map((e: { id: string; date: string }) => ({
        date: e.date,
        answers: {} as Record<string, unknown>,
      }));
      return NextResponse.json({
        entries: entryRows,
        days,
      });
    }

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/91d60c32-6f9a-4241-b639-622d722a080e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "app/api/journal/dashboard/route.ts:before-answers",
        message: "About to query journal_answer",
        data: { idsLength: ids.length },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "H3",
      }),
    }).catch(() => {});
    // #endregion agent log

    const { data: answersData, error: answersError } = await supabase
      .from("journal_answer")
      .select("entry_id, question_id, value_text, value_number, value_boolean, value_json")
      .in("entry_id", ids);

    if (answersError) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/91d60c32-6f9a-4241-b639-622d722a080e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "app/api/journal/dashboard/route.ts:answersError",
          message: "journal_answer error details",
          data: {
            message: answersError.message,
            details: (answersError as any).details,
            code: (answersError as any).code,
            hint: (answersError as any).hint,
          },
          timestamp: Date.now(),
          sessionId: "debug-session",
          hypothesisId: "H3-H4",
        }),
      }).catch(() => {});
      // #endregion agent log
      console.error("Dashboard API: journal_answer error", answersError.message);
      return NextResponse.json(
        { error: answersError.message },
        { status: 500 }
      );
    }

    const answerRows = answersData || [];
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/91d60c32-6f9a-4241-b639-622d722a080e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "app/api/journal/dashboard/route.ts:answersOk",
        message: "journal_answer query succeeded",
        data: { answerRowsLength: answerRows.length },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "H5",
      }),
    }).catch(() => {});
    // #endregion agent log
    if (answerRows.length === 0) {
      const days = entryRows.map((e: { id: string; date: string }) => ({
        date: e.date,
        answers: {} as Record<string, unknown>,
      }));
      return NextResponse.json({
        entries: entryRows,
        days,
      });
    }

    const questionIds = [...new Set(answerRows.map((a: { question_id: string }) => a.question_id))];
    const { data: questionsData, error: questionsError } = await supabase
      .from("question_catalog")
      .select("id, key, question_type")
      .in("id", questionIds);

    if (questionsError) {
      console.error("Dashboard API: question_catalog error", questionsError.message);
      return NextResponse.json(
        { error: questionsError.message },
        { status: 500 }
      );
    }

    const questionMap = new Map(
      (questionsData || []).map((q: { id: string; key: string; question_type: string }) => [q.id, q])
    );

    function toValue(
      row: {
        value_text: string | null;
        value_number: number | null;
        value_boolean: boolean | null;
        value_json: unknown;
      },
      questionType: string
    ): unknown {
      if (questionType === "number" || questionType === "rating") return row.value_number ?? null;
      if (questionType === "boolean") return row.value_boolean ?? null;
      if (questionType === "multiselect") return row.value_json ?? null;
      return row.value_text ?? null;
    }

    const byEntry = new Map<string, Record<string, unknown>>();
    for (const a of answerRows) {
      const q = questionMap.get(a.question_id);
      if (!q?.key) continue;
      const value = toValue(a, q.question_type);
      const map = byEntry.get(a.entry_id) ?? {};
      map[q.key] = value;
      byEntry.set(a.entry_id, map);
    }

    const days = entryRows.map((e: { id: string; date: string }) => ({
      date: e.date,
      answers: byEntry.get(e.id) ?? {},
    }));

    return NextResponse.json({
      entries: entryRows,
      days,
    });
  } catch (err) {
    console.error("Dashboard API:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
