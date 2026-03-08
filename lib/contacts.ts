export type ContactDraft = {
  name: string
  job_title: string
  company: string
  industry: string
  location: string
  where_met: string
  interests: string[]
  past_companies: string[]
  email: string
  phone: string
  linkedin_url: string
  tags: string[]
  notes: string
  raw_transcript: string
}

export type ContactRecord = ContactDraft & {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

export type ContactSearchResult = ContactRecord & {
  similarity?: number
  source?: "semantic" | "text"
}

export const EMBEDDING_RELEVANT_FIELDS: Array<keyof ContactDraft> = [
  "name",
  "job_title",
  "company",
  "industry",
  "location",
  "where_met",
  "interests",
  "past_companies",
  "tags",
  "notes",
  "raw_transcript",
]

export const EMPTY_CONTACT_DRAFT: ContactDraft = {
  name: "",
  job_title: "",
  company: "",
  industry: "",
  location: "",
  where_met: "",
  interests: [],
  past_companies: [],
  email: "",
  phone: "",
  linkedin_url: "",
  tags: [],
  notes: "",
  raw_transcript: "",
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const unique = new Set<string>()
  for (const item of value) {
    if (typeof item !== "string") continue
    const trimmed = item.trim()
    if (!trimmed) continue
    unique.add(trimmed)
  }
  return Array.from(unique)
}

export function coerceContactDraft(value: Partial<Record<keyof ContactDraft, unknown>>): ContactDraft {
  return {
    name: normalizeString(value.name),
    job_title: normalizeString(value.job_title),
    company: normalizeString(value.company),
    industry: normalizeString(value.industry),
    location: normalizeString(value.location),
    where_met: normalizeString(value.where_met),
    interests: normalizeStringArray(value.interests),
    past_companies: normalizeStringArray(value.past_companies),
    email: normalizeString(value.email),
    phone: normalizeString(value.phone),
    linkedin_url: normalizeString(value.linkedin_url),
    tags: normalizeStringArray(value.tags),
    notes: normalizeString(value.notes),
    raw_transcript: normalizeString(value.raw_transcript),
  }
}
