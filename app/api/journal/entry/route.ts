import { type NextRequest, NextResponse } from "next/server";
import { getEntry, moveEntryDate } from "../../../../lib/journalDb";
import { getLocalDateString, normalizeIsoDate } from "../../../../lib/date";

/**
 * GET /api/journal/entry?date=YYYY-MM-DD
 * Get entry and answers for a date (draft or submitted). Returns { entry, answers }.
 * entry is null if none exists.
 */
export async function GET(request: NextRequest) {
  try {
    const requestedDate = request.nextUrl.searchParams.get("date");
    const dateStr = normalizeIsoDate(requestedDate) ?? getLocalDateString();
    const { entry, answers } = await getEntry(dateStr);
    return NextResponse.json({ entry, answers, date: dateStr });
  } catch (error) {
    console.error("GET /api/journal/entry:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/journal/entry
 * Move an existing entry from one canonical date to another.
 * Body: { fromDate: "YYYY-MM-DD", toDate: "YYYY-MM-DD" }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const fromDate = normalizeIsoDate(body?.fromDate);
    const toDate = normalizeIsoDate(body?.toDate);

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: "Invalid request body. Expected { fromDate, toDate }" }, { status: 400 });
    }

    const result = await moveEntryDate(fromDate, toDate);
    return NextResponse.json({ entry: result.entry, answers: result.answers });
  } catch (error) {
    if (error instanceof Error && error.name === "JournalDateConflictError") {
      return NextResponse.json({ error: error.message, code: "date_conflict" }, { status: 409 });
    }

    console.error("PATCH /api/journal/entry:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
