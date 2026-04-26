import { type NextRequest, NextResponse } from "next/server";
import { saveDraft } from "../../../../lib/journalDb";
import { getLocalDateString, normalizeIsoDate } from "../../../../lib/date";
import { normalizeJournalAnswers } from "../../../../lib/journalValidation";

/**
 * POST /api/journal/draft
 * Create or update a draft entry
 * Body: { date: "YYYY-MM-DD", answers: Array<{ question_key, answer_value, answer_type }> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, answers } = body
    const normalizedDate = normalizeIsoDate(date)

    if (!normalizedDate || !answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "Invalid request body. Expected { date, answers }" },
        { status: 400 }
      )
    }

    const normalizedAnswers = normalizeJournalAnswers(answers)
    const result = await saveDraft(normalizedDate, normalizedAnswers)

    return NextResponse.json(
      {
        draft: result.entry,
        answers: result.answers,
      },
      { status: result.entry?.id ? 200 : 201 }
    )
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/journal/draft?date=YYYY-MM-DD
 * Update a draft entry. Body: { answers }.
 */
export async function PATCH(request: NextRequest) {
  try {
    const dateStr = normalizeIsoDate(request.nextUrl.searchParams.get("date")) ?? getLocalDateString();
    const body = await request.json();
    const { answers } = body;

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid request body. Expected { answers }" }, { status: 400 });
    }

    const normalizedAnswers = normalizeJournalAnswers(answers);
    const result = await saveDraft(dateStr, normalizedAnswers);
    return NextResponse.json({ entry: result.entry, answers: result.answers });
  } catch (error) {
    console.error("PATCH /api/journal/draft:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
