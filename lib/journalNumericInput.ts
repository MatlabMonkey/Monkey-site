export function normalizeJournalNumericInput(rawValue: string, max: number): number | null {
  const value = rawValue.trim()
  if (value === "") return null

  if (max === 10 && /^\d{2,}$/.test(value) && value !== "10") {
    return Number(value.at(-1))
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
