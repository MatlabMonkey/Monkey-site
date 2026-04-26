export function getLocalDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function isIsoDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  return (
    local.getFullYear() === y &&
    local.getMonth() === m - 1 &&
    local.getDate() === d
  );
}

export function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!isIsoDateString(trimmed)) return null;
  return trimmed;
}

export function formatIsoDateForDisplay(value: string): string {
  const normalized = normalizeIsoDate(value);
  if (!normalized) return value;
  const [y, m, d] = normalized.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  return local.toLocaleDateString();
}
