"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { supabase } from "../../lib/supabaseClient"
import PinGate from "../components/PinGate"
import { Calendar, Heart, Zap, Activity, Brain, Target, Sparkles, ArrowRight } from "lucide-react"

type QuestionType = "text" | "number" | "rating" | "boolean" | "multiselect" | "date"

type AnswerRow = {
  entry_id: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_json: any
  question_catalog:
    | { key: string; question_type: QuestionType }
    | { key: string; question_type: QuestionType }[]
}

type JournalDay = {
  date: string // YYYY-MM-DD
  answers: Record<string, any>
}

type DashboardStats = {
  days: JournalDay[]
  avgDayQuality7: number
  avgProductivity7: number
  avgEnergy7: number
  avgStress7: number
  avgFocus7: number
  avgSocial7: number
  avgAlcohol7: number
  totalAlcohol30: number
  workoutCounts14: Record<string, number>
  roseHighlight: { date: string; value: string } | null
  budHighlight: { date: string; value: string } | null
  thornHighlight: { date: string; value: string } | null
  totalEntries: number
  daysBehind: number
  lastEntryStr: string
  chartData: Array<{
    date: string
    day_quality: number | null
    productivity: number | null
    energy: number | null
    stress: number | null
    focus: number | null
  }>
}

const WORKOUT_COLOR_MAP: Record<
  string,
  {
    from: string
    to: string
  }
> = {
  Push: { from: "#ef4444", to: "#f97373" }, // red
  Pull: { from: "#eab308", to: "#facc15" }, // yellow
  Legs: { from: "#a855f7", to: "#c4b5fd" }, // purple (chosen)
  "Full body": { from: "#22c55e", to: "#4ade80" }, // green
  Surfing: { from: "#3b82f6", to: "#60a5fa" }, // blue
  Core: { from: "#f97316", to: "#fdba74" }, // orange
  Cardio: { from: "#ec4899", to: "#f472b6" }, // pink
}

function answerValue(row: AnswerRow): any {
  const catalog = Array.isArray(row.question_catalog) ? row.question_catalog[0] : row.question_catalog
  const t = catalog?.question_type
  if (t === "number" || t === "rating") return row.value_number
  if (t === "boolean") return row.value_boolean
  if (t === "multiselect") return row.value_json
  return row.value_text
}

function avg(values: Array<number | null | undefined>): number {
  const nums = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // 1) Get submitted entries (non-drafts)
        const { data: entryRows, error: entryError } = await supabase
          .from("journal_entry")
          .select("id, date, is_draft, completed_at")
          .eq("is_draft", false)
          .order("date", { ascending: true })

        if (entryError) {
          console.error("Supabase error (journal_entry):", entryError)
          setStats(null)
          return
        }

        if (!entryRows || entryRows.length === 0) {
          // Empty state: initialize all metrics to safe defaults so UI can render.
          const WORKOUT_OPTIONS = ["Push", "Pull", "Legs", "Full body", "Surfing", "Core", "Cardio"]
          const workoutCounts14: Record<string, number> = Object.fromEntries(
            WORKOUT_OPTIONS.map((k) => [k, 0]),
          ) as Record<string, number>

          setStats({
            days: [],
            avgDayQuality7: 0,
            avgProductivity7: 0,
            avgEnergy7: 0,
            avgStress7: 0,
            avgFocus7: 0,
            avgSocial7: 0,
            avgAlcohol7: 0,
            totalAlcohol30: 0,
            workoutCounts14,
            roseHighlight: null,
            budHighlight: null,
            thornHighlight: null,
            totalEntries: 0,
            daysBehind: 0,
            lastEntryStr: "No entries yet",
            chartData: [],
          })
          return
        }

        const ids = entryRows.map((e: any) => e.id as string)

        // 2) Get answers + question keys
        const { data: answerRows, error: answerError } = await supabase
          .from("journal_answer")
          .select(
            "entry_id, value_text, value_number, value_boolean, value_json, question_catalog!inner(key, question_type)",
          )
          .in("entry_id", ids)

        if (answerError) {
          console.error("Supabase error (journal_answer):", answerError)
          setStats(null)
          return
        }

        const byEntry: Map<string, Record<string, any>> = new Map()

        ;(answerRows as unknown as AnswerRow[]).forEach((row) => {
          const catalog = Array.isArray(row.question_catalog) ? row.question_catalog[0] : row.question_catalog
          const key = catalog?.key
          if (!key) return
          const value = answerValue(row)
          const map = byEntry.get(row.entry_id) ?? {}
          map[key] = value
          byEntry.set(row.entry_id, map)
        })

        const days: JournalDay[] = (entryRows as any[]).map((e) => ({
          date: e.date,
          answers: byEntry.get(e.id) ?? {},
        }))

        const today = new Date()
        const lastEntryRow = entryRows[entryRows.length - 1] as any
        const lastDateObj = new Date(lastEntryRow.date + "T00:00:00")
        const diffDays = Math.floor(
          (today.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24),
        )

        const last7 = days.slice(-7)
        const last30 = days.slice(-30)

        const getNum = (d: JournalDay, key: string): number | null => {
          const v = d.answers[key]
          if (typeof v === "number") return v
          if (typeof v === "string" && v.trim() !== "") {
            const n = Number(v)
            return Number.isNaN(n) ? null : n
          }
          return null
        }

        const avgDayQuality7 = avg(last7.map((d) => getNum(d, "day_quality")))
        const avgProductivity7 = avg(last7.map((d) => getNum(d, "productivity")))
        const avgEnergy7 = avg(last7.map((d) => getNum(d, "energy")))
        const avgStress7 = avg(last7.map((d) => getNum(d, "stress_calm")))
        const avgFocus7 = avg(last7.map((d) => getNum(d, "focus_presence")))
        const avgSocial7 = avg(last7.map((d) => getNum(d, "social_connection")))
        const avgAlcohol7 = avg(last7.map((d) => getNum(d, "alcohol")))
        const totalAlcohol30 = last30
          .map((d) => getNum(d, "alcohol") || 0)
          .reduce((a, b) => a + b, 0)

        // Workouts (multiselect) over last 14 days
        const WORKOUT_OPTIONS = ["Push", "Pull", "Legs", "Full body", "Surfing", "Core", "Cardio"]
        const workoutCounts14: Record<string, number> = Object.fromEntries(
          WORKOUT_OPTIONS.map((k) => [k, 0]),
        ) as Record<string, number>

        const last14 = days.slice(-14)
        last14.forEach((d) => {
          const vals = d.answers["workouts"]
          if (Array.isArray(vals)) {
            vals.forEach((v: string) => {
              if (WORKOUT_OPTIONS.includes(v)) {
                workoutCounts14[v] = (workoutCounts14[v] || 0) + 1
              }
            })
          }
        })

        // Rose / bud / thorn highlights – latest non-empty values
        const latestWith = (key: string): { date: string; value: string } | null => {
          for (let i = days.length - 1; i >= 0; i--) {
            const d = days[i]
            const v = d.answers[key]
            if (typeof v === "string" && v.trim() !== "") {
              return { date: d.date, value: v }
            }
          }
          return null
        }

        const roseHighlight = latestWith("rose")
        const budHighlight = latestWith("bud")
        const thornHighlight = latestWith("thorn")

        const chartData = days.map((d) => ({
          date: d.date,
          day_quality: getNum(d, "day_quality"),
          productivity: getNum(d, "productivity"),
          energy: getNum(d, "energy"),
          stress: getNum(d, "stress_calm"),
          focus: getNum(d, "focus_presence"),
        }))

        const lastEntryStr = lastDateObj.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        setStats({
          days,
          avgDayQuality7,
          avgProductivity7,
          avgEnergy7,
          avgStress7,
          avgFocus7,
          avgSocial7,
          avgAlcohol7,
          totalAlcohol30,
          workoutCounts14,
          roseHighlight,
          budHighlight,
          thornHighlight,
          totalEntries: days.length,
          daysBehind: Math.max(diffDays, 0),
          lastEntryStr,
          chartData,
        })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading || !stats) {
    return (
      <PinGate>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center text-slate-100">
          <div className="text-center space-y-6">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-800 border-t-purple-400 mx-auto" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 opacity-30 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-50">Loading dashboard</h2>
              <p className="text-slate-300">Fetching your journal insights…</p>
            </div>
          </div>
        </div>
      </PinGate>
    )
  }

  const latestDay = stats.days[stats.days.length - 1]
  const maxWorkoutCount = Math.max(
    1,
    ...Object.values(stats.workoutCounts14).map((c) => (typeof c === "number" ? c : 0)),
  )

  return (
    <PinGate>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        {/* Header */}
        <div className="bg-slate-950/80 backdrop-blur-sm border-b border-slate-800/60 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-300 via-indigo-300 to-sky-300 bg-clip-text text-transparent">
                Journal dashboard
              </h1>
              <p className="text-slate-300 mt-1">
                Overview of your days, energy, and reflection patterns
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/journal"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-sm font-medium shadow-md hover:from-purple-400 hover:to-indigo-400 transition-all"
              >
                <ArrowRight className="w-4 h-4" />
                New entry
              </Link>
              <div className="px-4 py-2 rounded-full border border-slate-700 bg-slate-900/70 text-xs font-medium">
                {stats.daysBehind === 0
                  ? "Up to date"
                  : `${stats.daysBehind} day${stats.daysBehind === 1 ? "" : "s"} since last entry`}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Top metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard
              title="Day quality"
              value={stats.avgDayQuality7.toFixed(1)}
              subtitle="7‑day avg (0–10)"
              icon={<Heart className="w-5 h-5" />}
              gradient="from-pink-500 to-rose-500"
            />
            <MetricCard
              title="Productivity"
              value={stats.avgProductivity7.toFixed(1)}
              subtitle="7‑day avg (0–10)"
              icon={<Zap className="w-5 h-5" />}
              gradient="from-sky-500 to-indigo-500"
            />
            <MetricCard
              title="Energy"
              value={stats.avgEnergy7.toFixed(1)}
              subtitle="7‑day avg (0–10)"
              icon={<Activity className="w-5 h-5" />}
              gradient="from-emerald-500 to-teal-500"
            />
            <MetricCard
              title="Stress"
              value={stats.avgStress7.toFixed(1)}
              subtitle="7‑day avg (0–10)"
              icon={<Brain className="w-5 h-5" />}
              gradient="from-amber-500 to-orange-500"
            />
            <MetricCard
              title="Focus"
              value={stats.avgFocus7.toFixed(1)}
              subtitle="7‑day avg (0–10)"
              icon={<Target className="w-5 h-5" />}
              gradient="from-violet-500 to-purple-500"
            />
            <MetricCard
              title="Social"
              value={stats.avgSocial7.toFixed(1)}
              subtitle="7‑day avg (0–10)"
              icon={<Sparkles className="w-5 h-5" />}
              gradient="from-fuchsia-500 to-pink-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Trends */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 rounded-3xl border border-slate-800/70 shadow-lg shadow-black/40 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-300" />
                    <h2 className="text-lg font-semibold text-slate-50">Trends over time</h2>
                  </div>
                  <span className="text-xs text-slate-400">
                    {stats.totalEntries} entries · latest {stats.lastEntryStr}
                  </span>
                </div>

                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={stats.chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#9ca3af" }}
                    />
                    <YAxis
                      domain={[0, 10]}
                      ticks={[0, 2.5, 5, 7.5, 10]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#9ca3af" }}
                    />
                    <Tooltip
                      labelFormatter={(v) =>
                        new Date(v + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      }
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid #1e293b",
                        borderRadius: 16,
                        color: "#e5e7eb",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#e5e7eb" }} />
                    <Line
                      type="monotone"
                      dataKey="day_quality"
                      name="Day quality"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="productivity"
                      name="Productivity"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="energy"
                      name="Energy"
                      stroke="#22c55e"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Latest entry summary */}
            <div className="space-y-6">
              <div className="bg-slate-900 rounded-3xl border border-slate-800/70 shadow-lg shadow-black/40 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-sky-300" />
                    <h2 className="text-lg font-semibold text-slate-50">Latest entry</h2>
                  </div>
                  <span className="text-xs text-slate-400">
                    {latestDay
                      ? new Date(latestDay.date + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </span>
                </div>

                {latestDay ? (
                  <div className="space-y-4 text-sm">
                    <FieldBlock
                      label="Anchor memory"
                      value={latestDay.answers["anchor_memory"]}
                      placeholder="No anchor memory captured."
                    />
                    <FieldBlock
                      label="Wins / proud of"
                      value={latestDay.answers["wins_proud"]}
                      placeholder="No wins recorded."
                    />
                    <FieldBlock
                      label="Misses / friction"
                      value={latestDay.answers["misses_friction"]}
                      placeholder="No misses recorded."
                    />
                    <FieldBlock
                      label="Lesson"
                      value={latestDay.answers["lesson_next_time"]}
                      placeholder="No explicit lesson written."
                    />
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">No entries yet.</p>
                )}
              </div>

              <div className="bg-slate-900 rounded-3xl border border-slate-800/70 shadow-lg shadow-black/40 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-emerald-300" />
                  <h2 className="text-lg font-semibold text-slate-50">Tomorrow focus</h2>
                </div>
                {latestDay ? (
                  <div className="space-y-3 text-sm">
                    <FieldBlock
                      label="Tomorrow's #1 priority"
                      value={latestDay.answers["tomorrow_priority"]}
                      placeholder="No priority set."
                    />
                    <FieldBlock
                      label="Implementation intention"
                      value={latestDay.answers["implementation_intention"]}
                      placeholder="No implementation intention set."
                    />
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Fill in today's entry to seed tomorrow.</p>
                )}
              </div>

              {/* Alcohol */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800/70 shadow-lg shadow-black/40 p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-300" />
                    <h2 className="text-lg font-semibold text-slate-50">Alcohol</h2>
                  </div>
                  <span className="text-xs text-slate-400">last 7 / 30 days</span>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">7‑day avg</div>
                    <div className="text-xl font-semibold text-slate-100">
                      {stats.avgAlcohol7.toFixed(1)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">drinks per day</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-400">30‑day total</div>
                    <div className="text-xl font-semibold text-slate-100">
                      {stats.totalAlcohol30.toFixed(1)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">drinks</div>
                  </div>
                </div>
              </div>

              {/* Rose / Bud / Thorn */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800/70 shadow-lg shadow-black/40 p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-pink-300" />
                  <h2 className="text-lg font-semibold text-slate-50">Daily highlights</h2>
                </div>
                <div className="space-y-3 text-sm">
                  <FieldBlock
                    label="Rose"
                    value={stats.roseHighlight?.value}
                    placeholder="No recent rose captured."
                  />
                  <FieldBlock
                    label="Bud"
                    value={stats.budHighlight?.value}
                    placeholder="No recent bud captured."
                  />
                  <FieldBlock
                    label="Thorn"
                    value={stats.thornHighlight?.value}
                    placeholder="No recent thorn captured."
                  />
                </div>
              </div>

              {/* Workouts */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800/70 shadow-lg shadow-black/40 p-6 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-5 h-5 text-emerald-300" />
                  <h2 className="text-lg font-semibold text-slate-50">Workouts (last 14 days)</h2>
                </div>
                <div className="space-y-2 text-xs text-slate-200">
                  {Object.entries(stats.workoutCounts14).map(([name, count]) => {
                    const n = typeof count === "number" ? count : 0
                    const width = maxWorkoutCount > 0 ? (n / maxWorkoutCount) * 100 : 0
                    const colors = WORKOUT_COLOR_MAP[name] ?? { from: "#22c55e", to: "#4ade80" }
                    return (
                      <div key={name} className="relative h-6 flex items-center">
                        {/* Bar behind text */}
                        <div className="absolute inset-y-1 left-0 right-0 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${width}%`,
                              backgroundImage: `linear-gradient(to right, ${colors.from}, ${colors.to})`,
                            }}
                          />
                        </div>
                        {/* Text + number on top */}
                        <div className="relative z-10 flex justify-between w-full px-1">
                          <span className="font-medium">{name}</span>
                          <span className="font-mono">{n}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PinGate>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  gradient: string
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${gradient} shadow-lg shadow-black/40`}
    >
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#fff,_transparent_60%)]" />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/70 mb-1">{title}</div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-xs text-white/70 mt-1">{subtitle}</div>
        </div>
        <div className="p-2 bg-black/20 rounded-xl text-white">{icon}</div>
      </div>
    </div>
  )
}

function FieldBlock({
  label,
  value,
  placeholder,
}: {
  label: string
  value: any
  placeholder: string
}) {
  const text =
    value == null || (typeof value === "string" && value.trim() === "")
      ? null
      : Array.isArray(value)
        ? value.join(", ")
        : String(value)

  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-100 text-sm leading-relaxed">
        {text ?? <span className="text-slate-500 italic">{placeholder}</span>}
      </div>
    </div>
  )
}

