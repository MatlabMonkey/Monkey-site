import type { AnswerInput } from "./journalDb";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeJournalAnswers(answers: unknown): AnswerInput[] {
  if (!Array.isArray(answers)) return [];

  return answers
    .filter((answer): answer is AnswerInput => Boolean(answer && typeof answer === "object"))
    .map((answer) => {
      const normalized: AnswerInput = {
        question_key: String(answer.question_key || ""),
        answer_type: String(answer.answer_type || "text"),
        answer_value: answer.answer_value,
      };

      if (normalized.question_key === "day_date" && typeof normalized.answer_value === "string") {
        normalized.answer_value = normalized.answer_value.slice(0, 10);
      }

      if (normalized.question_key === "day_impact") {
        const numeric = Number(normalized.answer_value);
        normalized.answer_type = "rating";
        normalized.answer_value = Number.isFinite(numeric) ? clamp(numeric, 0, 5) : 0;
      }

      return normalized;
    })
    .filter((answer) => answer.question_key.length > 0);
}
