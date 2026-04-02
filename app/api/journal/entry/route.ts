import { type NextRequest, NextResponse } from "next/server";
import { getEntry } from "../../../../lib/journalDb";
import { getLocalDateString } from "../../../../lib/date";

/**
 * GET /api/journal/entry?date=YYYY-MM-DD
 * Get entry and answers for a date (draft or submitted). Returns { entry, answers }.
 * entry is null if none exists.
 */
export async function GET(request: NextRequest) {
  try {
    const dateStr = request.nextUrl.searchParams.get("date") || getLocalDateString();
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
