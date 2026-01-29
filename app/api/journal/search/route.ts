import { type NextRequest, NextResponse } from "next/server";
import { searchEntries } from "../../../../lib/journalDb";

/**
 * GET /api/journal/search?from=YYYY-MM-DD&to=YYYY-MM-DD&q=...
 * Search entries by date range and optional text (value_text ilike).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const q = searchParams.get("q") || undefined;
    const entries = await searchEntries({ from, to, q });
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("GET /api/journal/search:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
