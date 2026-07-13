import { type NextRequest, NextResponse } from "next/server";
import { entryExists } from "../../../../lib/journalDb";
import { normalizeIsoDate } from "../../../../lib/date";

/**
 * GET /api/journal/exists?date=YYYY-MM-DD
 * Checks whether a canonical journal date already has an entry.
 */
export async function GET(request: NextRequest) {
  try {
    const date = normalizeIsoDate(request.nextUrl.searchParams.get("date"));
    if (!date) {
      return NextResponse.json({ error: "Missing or invalid date" }, { status: 400 });
    }

    const result = await entryExists(date);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/journal/exists:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
