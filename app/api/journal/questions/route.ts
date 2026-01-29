import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";
import { JOURNAL_QUESTION_SET } from "../../../../lib/journalSchema";

/**
 * GET /api/journal/questions?date=YYYY-MM-DD
 * Returns the active question set from question_catalog. Falls back to
 * journalSchema if the catalog is empty (e.g. before migration).
 */
export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];

    const { data: rows, error } = await supabase
      .from("question_catalog")
      .select("id, key, question_type, wording, description, display_order, metadata")
      .order("display_order", { ascending: true });

    if (error) {
      // If table does not exist yet, use schema fallback
      const fallback = JOURNAL_QUESTION_SET.map((q, i) => ({
        id: String(i + 1),
        key: q.key,
        question_type: q.question_type,
        wording: q.wording,
        description: q.description ?? undefined,
        display_order: q.display_order,
        metadata: q.metadata ?? {},
      }));
      return NextResponse.json({ questions: fallback, date, source: "schema_fallback" });
    }

    if (!rows || rows.length === 0) {
      const fallback = JOURNAL_QUESTION_SET.map((q, i) => ({
        id: String(i + 1),
        key: q.key,
        question_type: q.question_type,
        wording: q.wording,
        description: q.description ?? undefined,
        display_order: q.display_order,
        metadata: q.metadata ?? {},
      }));
      return NextResponse.json({ questions: fallback, date, source: "schema_fallback" });
    }

    const questions = rows.map((r) => ({
      id: r.id,
      key: r.key,
      question_type: r.question_type,
      wording: r.wording,
      description: r.description ?? undefined,
      display_order: r.display_order,
      metadata: r.metadata ?? {},
    }));

    return NextResponse.json({ questions, date, source: "database" });
  } catch (err) {
    console.error("GET /api/journal/questions:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
