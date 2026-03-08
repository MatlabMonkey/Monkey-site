"use client"

import { useState } from "react"
import { X } from "lucide-react"

type TagInputProps = {
  label: string
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
}

function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

export default function TagInput({ label, value, onChange, placeholder, disabled = false }: TagInputProps) {
  const [input, setInput] = useState("")

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw)
    if (!tag) return
    if (value.includes(tag)) {
      setInput("")
      return
    }
    onChange([...value, tag])
    setInput("")
  }

  const removeTag = (index: number) => {
    onChange(value.filter((_, idx) => idx !== index))
  }

  return (
    <div className="space-y-2">
      <label className="text-sm text-[rgb(var(--text-muted))]">{label}</label>
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] px-3 py-2">
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((tag, index) => (
            <button
              key={`${tag}-${index}`}
              type="button"
              disabled={disabled}
              onClick={() => removeTag(index)}
              className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.8)] px-2.5 py-1 text-xs hover:bg-[rgb(var(--surface-2))] disabled:opacity-60"
            >
              <span>{tag}</span>
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <input
          value={input}
          disabled={disabled}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
              event.preventDefault()
              addTag(input)
              return
            }
            if (event.key === "Backspace" && !input && value.length > 0) {
              removeTag(value.length - 1)
            }
          }}
          onBlur={() => addTag(input)}
          placeholder={placeholder || "Type and press Enter"}
          className="w-full bg-transparent text-sm outline-none placeholder:text-[rgb(var(--text-muted))]"
        />
      </div>
    </div>
  )
}
