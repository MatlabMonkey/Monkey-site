import { type NextRequest, NextResponse } from "next/server";
import { getLocalDateString, normalizeIsoDate } from "../../../../lib/date";
import { supabase } from "../../../../lib/supabaseClient";

type CalendarEntryRow = {
  id: string;
  date: string;
  is_draft: boolean;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function monthBounds(dateStr: string): { from: string; to: string } {
  const [year, month] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

/**
 * GET /api/journal/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Lightweight month/range lookup for journal coverage.
 */
export async function GET(request: NextRequest) {
  try {
    const today = getLocalDateString();
    const fallback = monthBounds(today);
    const from = normalizeIsoDate(request.nextUrl.searchParams.get("from")) ?? fallback.from;
    const to = normalizeIsoDate(request.nextUrl.searchParams.get("to")) ?? fallback.to;

    const { data, error } = await supabase
      .from("journal_entry")
      .select("id, date, is_draft, completed_at, created_at, updated_at")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries = (data ?? []) as CalendarEntryRow[];
    const submittedCount = entries.filter((entry) => !entry.is_draft).length;
    const draftCount = entries.filter((entry) => entry.is_draft).length;

    return NextResponse.json({
      from,
      to,
      entries,
      counts: {
        total: entries.length,
        submitted: submittedCount,
        drafts: draftCount,
      },
    });
  } catch (error) {
    console.error("GET /api/journal/calendar:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
