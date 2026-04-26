import { type NextRequest, NextResponse } from "next/server";
import { submitEntry } from "../../../../lib/journalDb";
import { normalizeJournalAnswers } from "../../../../lib/journalValidation";
import { normalizeIsoDate } from "../../../../lib/date";

/**
 * POST /api/journal/submit
 * Submit an entry (mark as completed). Overwrites existing submitted entry if present.
 * Body: { date: "YYYY-MM-DD", answers: Array<{ question_key, answer_value, answer_type }> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, answers } = body;
    const normalizedDate = normalizeIsoDate(date);

    if (!normalizedDate || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid request body. Expected { date, answers }" }, { status: 400 });
    }

    const normalizedAnswers = normalizeJournalAnswers(answers);
    const result = await submitEntry(normalizedDate, normalizedAnswers);
    return NextResponse.json({ entry: result.entry, answers: result.answers }, { status: 200 });
  } catch (error) {
    console.error("POST /api/journal/submit:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
