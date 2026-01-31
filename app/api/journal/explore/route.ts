import { NextRequest, NextResponse } from "next/server";
import { exploreEntries, type ExploreParams } from "../../../../lib/journalDb";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "";

    const params: ExploreParams = {
      type,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    };

    if (type === "numeric") {
      params.question_key = searchParams.get("question_key") || undefined;
      params.operator = (searchParams.get("operator") as any) || undefined;
      const val = searchParams.get("value");
      params.value = val ? Number(val) : undefined;
      const val2 = searchParams.get("value2");
      params.value2 = val2 ? Number(val2) : undefined;
    } else if (type === "people" || type === "people_count") {
      params.person_name = searchParams.get("person_name") || undefined;
      const fields = searchParams.get("search_fields");
      params.search_fields = fields ? fields.split(",") : undefined;
    } else if (type === "activity") {
      params.search_text = searchParams.get("search_text") || undefined;
      const fields = searchParams.get("search_fields");
      params.search_fields = fields ? fields.split(",") : undefined;
    } else if (type === "workout") {
      const workouts = searchParams.get("workout_types");
      params.workout_types = workouts ? workouts.split(",") : undefined;
    } else if (type === "habit") {
      const habits = searchParams.get("habit_types");
      params.habit_types = habits ? habits.split(",") : undefined;
    } else if (type === "text_search") {
      params.search_text = searchParams.get("search_text") || undefined;
      const fields = searchParams.get("search_fields");
      params.search_fields = fields ? fields.split(",") : undefined;
    } else if (type === "rbt") {
      params.rbt_field = (searchParams.get("rbt_field") as any) || undefined;
      params.rbt_search = searchParams.get("rbt_search") || undefined;
    } else if (type === "date_pattern") {
      const dow = searchParams.get("day_of_week");
      params.day_of_week = dow ? Number(dow) : undefined;
      const month = searchParams.get("month");
      params.month = month ? Number(month) : undefined;
      const year = searchParams.get("year");
      params.year = year ? Number(year) : undefined;
    } else if (type === "combination") {
      const conditionsStr = searchParams.get("conditions");
      if (conditionsStr) {
        try {
          params.conditions = JSON.parse(conditionsStr);
        } catch {
          // Invalid JSON, ignore
        }
      }
      params.logic = (searchParams.get("logic") as "AND" | "OR") || "AND";
    } else if (type === "streak") {
      const conditionStr = searchParams.get("streak_condition");
      if (conditionStr) {
        try {
          params.streak_condition = JSON.parse(conditionStr);
        } catch {
          // Invalid JSON, ignore
        }
      }
    }

    const entries = await exploreEntries(params);

    return NextResponse.json({ entries, count: entries.length });
  } catch (error: any) {
    console.error("Explore error:", error);
    return NextResponse.json({ error: error.message || "Explore failed" }, { status: 500 });
  }
}
