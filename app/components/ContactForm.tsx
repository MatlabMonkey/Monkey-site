"use client"

import type { ContactDraft } from "../../lib/contacts"
import TagInput from "./TagInput"

type ContactFormProps = {
  value: ContactDraft
  onChange: (next: ContactDraft) => void
  disabled?: boolean
}

function InputRow({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm text-[rgb(var(--text-muted))]">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--brand))] disabled:opacity-70"
      />
    </label>
  )
}

export default function ContactForm({ value, onChange, disabled = false }: ContactFormProps) {
  const update = <K extends keyof ContactDraft>(field: K, nextValue: ContactDraft[K]) => {
    onChange({ ...value, [field]: nextValue })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <InputRow label="Name" value={value.name} disabled={disabled} onChange={(next) => update("name", next)} />
        <InputRow
          label="Job title"
          value={value.job_title}
          disabled={disabled}
          onChange={(next) => update("job_title", next)}
        />
        <InputRow
          label="Company"
          value={value.company}
          disabled={disabled}
          onChange={(next) => update("company", next)}
        />
        <InputRow
          label="Industry"
          value={value.industry}
          disabled={disabled}
          onChange={(next) => update("industry", next)}
        />
        <InputRow
          label="Location"
          value={value.location}
          disabled={disabled}
          onChange={(next) => update("location", next)}
        />
        <InputRow
          label="Where met"
          value={value.where_met}
          disabled={disabled}
          onChange={(next) => update("where_met", next)}
          placeholder="Conference, meetup, intro..."
        />
        <InputRow label="Email" value={value.email} disabled={disabled} onChange={(next) => update("email", next)} />
        <InputRow label="Phone" value={value.phone} disabled={disabled} onChange={(next) => update("phone", next)} />
        <InputRow
          label="LinkedIn URL"
          value={value.linkedin_url}
          disabled={disabled}
          onChange={(next) => update("linkedin_url", next)}
          placeholder="https://www.linkedin.com/in/..."
        />
      </div>

      <TagInput
        label="Interests"
        value={value.interests}
        disabled={disabled}
        onChange={(next) => update("interests", next)}
        placeholder="AI, running, startups..."
      />

      <TagInput
        label="Past companies"
        value={value.past_companies}
        disabled={disabled}
        onChange={(next) => update("past_companies", next)}
        placeholder="Acme Corp, Globex..."
      />

      <TagInput
        label="Tags"
        value={value.tags}
        disabled={disabled}
        onChange={(next) => update("tags", next)}
        placeholder="investor, friend, design..."
      />

      <label className="space-y-2 block">
        <span className="text-sm text-[rgb(var(--text-muted))]">Notes</span>
        <textarea
          rows={5}
          value={value.notes}
          disabled={disabled}
          onChange={(event) => update("notes", event.target.value)}
          placeholder="Anything else worth remembering..."
          className="w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--brand))] disabled:opacity-70"
        />
      </label>
    </div>
  )
}
