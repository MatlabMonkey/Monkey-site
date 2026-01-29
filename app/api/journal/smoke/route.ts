import { NextResponse } from "next/server";
import { saveDraft, getEntry } from "../../../../lib/journalDb";

const SMOKE_DATE = "2099-01-01"; // Unlikely to collide with real data

/**
 * GET /api/journal/smoke
 * Minimal smoke test: one write (draft) and one read against the new journal schema.
 * Run after applying 002_journal_schema.sql.
 */
export async function GET() {
  try {
    // Write: save a minimal draft
    const answers = [
      { question_key: "day_date", answer_value: SMOKE_DATE, answer_type: "date" },
      { question_key: "day_quality", answer_value: 7, answer_type: "rating" },
    ];
    await saveDraft(SMOKE_DATE, answers);

    // Read
    const { entry, answers: readAnswers } = await getEntry(SMOKE_DATE);
    if (!entry || readAnswers.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Read after write did not return entry or answers" },
        { status: 500 }
      );
    }

    // Best-effort delete of the smoke row (optional; avoids polluting)
    const { supabase } = await import("../../../../lib/supabaseClient");
    await supabase.from("journal_entry").delete().eq("date", SMOKE_DATE);

    return NextResponse.json({
      ok: true,
      message: "Journal smoke test passed: write and read succeeded.",
      entry_id: entry.id,
      answers_count: readAnswers.length,
    });
  } catch (error) {
    console.error("Journal smoke test failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
