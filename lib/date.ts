export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
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

export function shiftLocalDateString(baseDate: string, offsetDays: number): string {
  const normalized = normalizeIsoDate(baseDate);
  const seed = normalized ? new Date(`${normalized}T12:00:00`) : new Date();
  seed.setDate(seed.getDate() + offsetDays);
  return getLocalDateString(seed);
}

export function formatIsoDateForDisplay(value: string): string {
  const normalized = normalizeIsoDate(value);
  if (!normalized) return value;
  const [y, m, d] = normalized.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  return local.toLocaleDateString();
}
