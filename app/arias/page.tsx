"use client"

import { Inter, JetBrains_Mono } from "next/font/google"
import { useEffect, useMemo, useState } from "react"
import Card from "../components/Card"

type TimePeriod = "daily" | "weekly" | "monthly"

interface UsageRecord {
  date: string
  provider: string
  model: string
  tokens_in: number
  tokens_out: number
  cost_usd: number
}

interface UsageApiResponse {
  daily: UsageRecord[]
  summary: {
    provider: string
    model: string
    tokens_in: number
    tokens_out: number
    cost_usd: number
  }[]
  total_tokens_in: number
  total_tokens_out: number
  total_cost: number
}

interface ModelDisplay {
  name: string
  provider: string
  tokensIn: number
  tokensOut: number
  cost: number
}

type SortKey = "name" | "provider" | "tokensIn" | "tokensOut" | "totalTokens" | "cost"
type SortDirection = "asc" | "desc"

const inter = Inter({ subsets: ["latin"] })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] })

// Map API model names to display names
const DISPLAY_NAMES: Record<string, string> = {
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-opus-4-6': 'Opus 4.6',
  'kimi-k2.5': 'Kimi K2.5',
  'qwen2.5-coder:7b': 'Ollama',
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
}

function getNextSortDirection(currentKey: SortKey, nextKey: SortKey, direction: SortDirection): SortDirection {
  if (currentKey === nextKey) return direction === "asc" ? "desc" : "asc"
  return "desc"
}

function aggregateByPeriod(data: UsageRecord[], period: TimePeriod): ModelDisplay[] {
  const now = new Date()
  const cutoff = new Date()
  
  if (period === "daily") cutoff.setDate(now.getDate() - 1)
  else if (period === "weekly") cutoff.setDate(now.getDate() - 7)
  else cutoff.setDate(now.getDate() - 30)

  const filtered = data.filter(r => new Date(r.date) >= cutoff)
  
  // Aggregate by model
  const grouped = filtered.reduce((acc, r) => {
    const key = `${r.provider}/${r.model}`
    if (!acc[key]) {
      acc[key] = {
        name: DISPLAY_NAMES[r.model] || r.model,
        provider: r.provider === 'anthropic' ? 'Anthropic' : r.provider === 'moonshot' ? 'Moonshot' : 'Local',
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
      }
    }
    acc[key].tokensIn += r.tokens_in
    acc[key].tokensOut += r.tokens_out
    acc[key].cost += r.cost_usd
    return acc
  }, {} as Record<string, ModelDisplay>)

  return Object.values(grouped)
}

function TimePeriodToggle({
  period,
  onChange,
}: {
  period: TimePeriod
  onChange: (period: TimePeriod) => void
}) {
  const options: TimePeriod[] = ["daily", "weekly", "monthly"]

  return (
    <div className="inline-flex rounded-full border border-[rgb(34_48_66)] bg-[rgb(11_16_23)] p-1">
      {options.map((option) => {
        const active = option === period
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors duration-150 ${
              active
                ? "bg-[rgb(26_20_16)] text-[rgb(212_163_115)]"
                : "text-[rgb(180_189_200)] hover:bg-[rgb(16_24_36)] hover:text-[rgb(233_236_239)]"
            }`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function OverviewCard({
  title,
  value,
  hint,
  mono,
}: {
  title: string
  value: string
  hint: string
  mono?: boolean
}) {
  return (
    <Card
      title={title}
      gradient="gray"
      className="!rounded-2xl !border !border-[rgb(34_48_66)] !bg-[rgb(11_16_23)] !bg-none !shadow-none [&_h2]:!text-[rgb(180_189_200)] [&_h2]:!text-base [&_h2]:!font-semibold [&_div]:!text-[rgb(233_236_239)]"
    >
      <p className={`text-3xl leading-tight text-[rgb(233_236_239)] ${mono ? jetbrainsMono.className : ""}`}>{value}</p>
      <p className="mt-2 text-sm text-[rgb(180_189_200)]">{hint}</p>
    </Card>
  )
}

function UsageTable({
  data,
  sortKey,
  sortDirection,
  onSort,
}: {
  data: ModelDisplay[]
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
}) {
  const headers: { label: string; key: SortKey; align?: "left" | "right" }[] = [
    { label: "Model", key: "name", align: "left" },
    { label: "Provider", key: "provider", align: "left" },
    { label: "Input Tokens", key: "tokensIn", align: "right" },
    { label: "Output Tokens", key: "tokensOut", align: "right" },
    { label: "Total Tokens", key: "totalTokens", align: "right" },
    { label: "Cost", key: "cost", align: "right" },
  ]

  return (
    <Card
      title="Model Usage"
      gradient="gray"
      className="!rounded-2xl !border !border-[rgb(34_48_66)] !bg-[rgb(11_16_23)] !bg-none !shadow-none [&_h2]:!text-[rgb(233_236_239)] [&_h2]:!text-lg [&_h2]:!font-semibold [&_div]:!text-[rgb(233_236_239)]"
    >
      <div className="-mx-2 overflow-x-auto px-2">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-[rgb(11_16_23)]">
            <tr>
              {headers.map((header) => {
                const active = sortKey === header.key
                return (
                  <th
                    key={header.key}
                    className={`border-b border-[rgb(34_48_66)] px-3 py-3 text-xs uppercase tracking-wide text-[rgb(180_189_200)] ${
                      header.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(header.key)}
                      className={`inline-flex items-center gap-1 ${header.align === "right" ? "ml-auto" : ""} hover:text-[rgb(233_236_239)]`}
                    >
                      {header.label}
                      <span className="text-[rgb(212_163_115)]">
                        {active ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-[rgb(180_189_200)]">
                  No data yet. Run the backfill script to populate historical usage.
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const total = row.tokensIn + row.tokensOut
                return (
                  <tr key={row.name} className="transition-colors duration-150 hover:bg-[rgb(16_24_36)]">
                    <td className="border-b border-[rgb(34_48_66)] px-3 py-3 text-sm text-[rgb(233_236_239)]">{row.name}</td>
                    <td className="border-b border-[rgb(34_48_66)] px-3 py-3 text-sm text-[rgb(180_189_200)]">{row.provider}</td>
                    <td
                      className={`border-b border-[rgb(34_48_66)] px-3 py-3 text-right text-sm text-[rgb(233_236_239)] ${jetbrainsMono.className}`}
                    >
                      {formatNumber(row.tokensIn)}
                    </td>
                    <td
                      className={`border-b border-[rgb(34_48_66)] px-3 py-3 text-right text-sm text-[rgb(233_236_239)] ${jetbrainsMono.className}`}
                    >
                      {formatNumber(row.tokensOut)}
                    </td>
                    <td
                      className={`border-b border-[rgb(34_48_66)] px-3 py-3 text-right text-sm text-[rgb(233_236_239)] ${jetbrainsMono.className}`}
                    >
                      {formatNumber(total)}
                    </td>
                    <td
                      className={`border-b border-[rgb(34_48_66)] px-3 py-3 text-right text-sm text-[rgb(212_163_115)] ${jetbrainsMono.className}`}
                    >
                      {formatCurrency(row.cost)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function AriasPage() {
  const [period, setPeriod] = useState<TimePeriod>("daily")
  const [sortKey, setSortKey] = useState<SortKey>("cost")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [usageData, setUsageData] = useState<UsageApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUsage() {
      try {
        const response = await fetch('/api/usage?days=30')
        if (!response.ok) throw new Error('Failed to fetch usage data')
        const data = await response.json()
        setUsageData(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchUsage()
  }, [])

  const models = useMemo(() => {
    if (!usageData?.daily) return []
    return aggregateByPeriod(usageData.daily, period)
  }, [usageData, period])

  const sortedModels = useMemo(() => {
    const copy = [...models]
    copy.sort((a, b) => {
      const aTotal = a.tokensIn + a.tokensOut
      const bTotal = b.tokensIn + b.tokensOut

      const aValue = sortKey === "totalTokens" ? aTotal : sortKey === "name" || sortKey === "provider" ? a[sortKey] : a[sortKey]
      const bValue = sortKey === "totalTokens" ? bTotal : sortKey === "name" || sortKey === "provider" ? b[sortKey] : b[sortKey]

      if (typeof aValue === "string" && typeof bValue === "string") {
        const result = aValue.localeCompare(bValue)
        return sortDirection === "asc" ? result : -result
      }
      const result = Number(aValue) - Number(bValue)
      return sortDirection === "asc" ? result : -result
    })
    return copy
  }, [models, sortDirection, sortKey])

  const totals = useMemo(() => {
    if (!usageData) return { tokens: 0, cost: 0, count: 4 }
    const cutoff = new Date()
    if (period === "daily") cutoff.setDate(cutoff.getDate() - 1)
    else if (period === "weekly") cutoff.setDate(cutoff.getDate() - 7)
    else cutoff.setDate(cutoff.getDate() - 30)

    const filtered = usageData.daily?.filter(r => new Date(r.date) >= cutoff) || []
    return {
      tokens: filtered.reduce((sum, r) => sum + r.tokens_in + r.tokens_out, 0),
      cost: filtered.reduce((sum, r) => sum + r.cost_usd, 0),
      count: new Set(filtered.map(r => r.model)).size || 4,
    }
  }, [usageData, period])

  const maxModelTokens = useMemo(() => {
    if (!models.length) return 1
    return Math.max(...models.map((m) => m.tokensIn + m.tokensOut))
  }, [models])

  function handleSort(nextKey: SortKey) {
    const nextDirection = getNextSortDirection(sortKey, nextKey, sortDirection)
    setSortKey(nextKey)
    setSortDirection(nextDirection)
  }

  return (
    <main className={`${inter.className} min-h-screen bg-[rgb(5_7_11)] text-[rgb(233_236_239)] px-4 py-8 md:px-6 md:py-12`}>
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Arias</h1>
          <p className="max-w-3xl text-base leading-relaxed text-[rgb(180_189_200)]">OpenClaw Usage Dashboard</p>
        </header>

        <section className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-medium text-[rgb(233_236_239)]">Time Period</h2>
          <TimePeriodToggle period={period} onChange={setPeriod} />
        </section>

        {loading ? (
          <div className="text-center py-12 text-[rgb(180_189_200)]">Loading usage data...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">Error: {error}</div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <OverviewCard title="Total Tokens" value={formatNumber(totals.tokens)} hint={`${period} token spend`} mono />
              <OverviewCard title="Total Cost" value={formatCurrency(totals.cost)} hint="From Anthropic API" mono />
              <OverviewCard title="Active Models" value={String(totals.count)} hint="Sonnet, Opus, Kimi, Ollama" mono />
            </section>

            <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <UsageTable data={sortedModels} sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />

              <Card
                title="Token Distribution"
                gradient="gray"
                className="!rounded-2xl !border !border-[rgb(34_48_66)] !bg-[rgb(11_16_23)] !bg-none !shadow-none [&_h2]:!text-[rgb(233_236_239)] [&_h2]:!text-lg [&_h2]:!font-semibold [&_div]:!text-[rgb(233_236_239)]"
              >
                <div className="space-y-4">
                  {sortedModels.map((model) => {
                    const total = model.tokensIn + model.tokensOut
                    const width = Math.max(8, (total / maxModelTokens) * 100)
                    return (
                      <div key={`chart-${model.name}`} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-[rgb(180_189_200)]">{model.name}</span>
                          <span className={`text-sm text-[rgb(233_236_239)] ${jetbrainsMono.className}`}>{formatNumber(total)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[rgb(16_24_36)]">
                          <div className="h-2 rounded-full bg-[rgb(212_163_115)] transition-all duration-200" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
