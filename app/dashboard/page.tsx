'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PinGate from '../components/PinGate';
import Card from '../components/Card';
import ProgressBar from "../components/ProgressBar"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';



import {
  TrendingUp,
  Wine,
  Heart,
  Target,
  Activity,
  Calendar,
  BarChart3,
  Zap,
  Sun,
  Music,
  Eye,
  EyeOff,
} from "lucide-react"

// Keep all the existing utility functions
function gaussianSmooth(data: number[], sigma = 2): number[] {
  const kernelSize = Math.ceil(sigma * 3) * 2 + 1
  const kernel: number[] = []
  const mid = Math.floor(kernelSize / 2)
  let sum = 0
  for (let i = 0; i < kernelSize; i++) {
    const x = i - mid
    const g = Math.exp(-(x * x) / (2 * sigma * sigma))
    kernel.push(g)
    sum += g
  }
  const normalized = kernel.map((v) => v / sum)
  return data.map((_, i) => {
    let acc = 0
    for (let j = 0; j < kernelSize; j++) {
      const idx = i + j - mid
      if (idx >= 0 && idx < data.length) {
        acc += data[idx] * normalized[j]
      }
    }
    return acc
  })
}

function formatTick(dateStr: string, index: number, showAllDays: boolean) {
  const [y, m, d] = dateStr.split("-")
  const day = Number.parseInt(d, 10)
  if (showAllDays) return `${Number.parseInt(m, 10)}/${d}`
  return day === 1 ? new Date(dateStr).toLocaleString("default", { month: "short" }) : ""
}

function formatTooltipLabel(value: string) {
  return new Date(value).toISOString().split("T")[0]
}

function formatTooltipValue(value: number, name: string, props: any) {
  const raw = props?.payload?.[0]?.payload
  if (!raw) return [`${value.toFixed(1)}`, name]
  const lookup: Record<string, number> = {
    "How Good": raw.actual_how_good,
    Productivity: raw.actual_productivity,
    Drinks: raw.actual_drinks,
  }
  const val = lookup[name] ?? value
  return [`${val.toFixed(1)}`, name]
}

const colorMap: Record<string, string> = {
  Push: "#ef4444",
  Pull: "#f97316",
  Legs: "#eab308",
  Surfing: "#22c55e",
  "Full body": "#3b82f6",
  Core: "#8b5cf6",
  Cardio: "#ec4899",
}

type Entry = {
  date: string
  how_good: number
  productivity: number
  drinks: number
  scount: number
  rose: string
  gratitude: string
  thought_of_day: string
  booleans: string[]
}

export default function Dashboard() {
  const [stats, setStats] = useState<null | Record<string, any>>(null)
  const [timeRange, setTimeRange] = useState<"year" | "30days">("year")
  const [showSmoothed, setShowSmoothed] = useState(true)
  const [visibleLines, setVisibleLines] = useState<Record<"how_good" | "productivity" | "drinks", boolean>>({
    how_good: true,
    productivity: true,
    drinks: true,
  })

  useEffect(() => {
    async function fetchData() {
      const { data: entries, error } = await supabase.from("journal_entries").select("*")

      if (error) {
        console.error("Supabase error:", error)
        return
      }

      const parsed = entries
        .map((e: any) => ({
          ...e,
          date: new Date(e.date),
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime())

      const today = new Date()
      const thisYear = today.getFullYear()
      const last7 = parsed.filter((e) => dateDiff(e.date, today) <= 7)
      const last14 = parsed.filter((e) => dateDiff(e.date, today) <= 14)
      const thisYearEntries = parsed.filter((e) => e.date.getFullYear() === thisYear)
      const lastEntryDate = parsed.length > 0 ? parsed[parsed.length - 1].date : null
      const daysBehind = lastEntryDate ? dateDiff(lastEntryDate, today) - 1 : 0
      const lastEntryStr = lastEntryDate
        ? lastEntryDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "No entries yet"

      const rand = (arr: any[], field: string) =>
        arr.filter((e) => e[field]?.trim()).sort(() => 0.5 - Math.random())[0]?.[field] || "—"

      const workouts = ["Push", "Pull", "Legs", "Surfing", "Full body", "Core", "Cardio"]
      const workoutCounts: Record<string, number> = Object.fromEntries(workouts.map((type) => [type, 0]))
      let other = 0
      let sunsets = 0
      let guitar = 0

      last14.forEach((e) => {
        e.booleans?.forEach((val: string) => {
          if (workouts.includes(val)) workoutCounts[val]++
        })
        other += e.scount || 0
      })

      thisYearEntries.forEach((e) => {
        e.booleans?.forEach((val: string) => {
          if (val === "Watch sunset") sunsets++
          if (val === "Guitar") guitar++
        })
      })

      const pieData = Object.entries(workoutCounts)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({
          name,
          value,
          color: colorMap[name] || "#6b7280",
        }))

      const sigma = timeRange === "30days" ? 1.5 : 2
      const qualitySeries = gaussianSmooth(
        thisYearEntries.map((e) => e.how_good),
        sigma,
      )
      const productivitySeries = gaussianSmooth(
        thisYearEntries.map((e) => e.productivity),
        sigma,
      )
      const drinksSeries = gaussianSmooth(
        thisYearEntries.map((e) => e.drinks),
        sigma,
      )

      setStats({
        avgQuality7: avg(last7.map((e) => e.how_good)),
        avgProductivity7: avg(last7.map((e) => e.productivity)),
        totalDrinksYear: sum(thisYearEntries.map((e) => e.drinks)),
        drinks14: sum(last14.map((e) => e.drinks)),
        discreetCount: other,
        rose: rand(parsed, "rose"),
        gratitude: rand(parsed, "gratitude"),
        thought: rand(parsed, "thought_of_day"),
        workoutCounts,
        sunsets,
        guitar,
        pieData,
        lastEntryDate,
        daysBehind,
        lastEntryStr,
        chartData: thisYearEntries.map((e, i) => ({
          date: e.date.toISOString().split("T")[0],
          how_good: qualitySeries[i],
          productivity: productivitySeries[i],
          drinks: drinksSeries[i],
          actual_how_good: e.how_good,
          actual_productivity: e.productivity,
          actual_drinks: e.drinks,
        })),
        rawChartData: thisYearEntries.map((e) => ({
          date: e.date.toISOString().split("T")[0],
          how_good: e.how_good,
          productivity: e.productivity,
          drinks: e.drinks,
          actual_how_good: e.how_good,
          actual_productivity: e.productivity,
          actual_drinks: e.drinks,
        })),
      })
    }

    fetchData()
  }, [timeRange, showSmoothed])

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  const chartData = showSmoothed ? stats.chartData : stats.rawChartData
  const filteredData = chartData.slice(timeRange === "year" ? 0 : -30)

  return (
    <PinGate>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 md:p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-2">
            Life Dashboard
          </h1>
          <p className="text-gray-600 text-lg">Your personal journey insights and analytics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card
            title="Daily Averages (Last 7 Days)"
            gradient="blue"
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Quality of Life</span>
                <span className="text-2xl font-bold text-blue-700">{stats.avgQuality7.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Productivity</span>
                <span className="text-2xl font-bold text-blue-700">{stats.avgProductivity7.toFixed(1)}</span>
              </div>
            </div>
          </Card>

          <Card title="Drink Summary" gradient="orange" icon={<Wine className="w-5 h-5 text-orange-600" />}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total This Year</span>
                <span className="text-2xl font-bold text-orange-700">{stats.totalDrinksYear}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last 14 Days</span>
                <span className="text-2xl font-bold text-orange-700">{stats.drinks14}</span>
              </div>
            </div>
          </Card>

          <Card title="Random Highlights" gradient="pink" icon={<Heart className="w-5 h-5 text-pink-600" />}>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold text-pink-700">🌹 Highlight:</span>
                <p className="mt-1 text-gray-700 line-clamp-2">{stats.rose}</p>
              </div>
              <div>
                <span className="font-semibold text-pink-700">🙏 Gratitude:</span>
                <p className="mt-1 text-gray-700 line-clamp-2">{stats.gratitude}</p>
              </div>
              <div>
                <span className="font-semibold text-pink-700">💭 Thought:</span>
                <p className="mt-1 text-gray-700 line-clamp-2">{stats.thought}</p>
              </div>
            </div>
          </Card>

          <Card title="Goals Progress" gradient="green" icon={<Target className="w-5 h-5 text-green-600" />}>
            <div className="space-y-4">
              <ProgressBar
                label="Sunsets"
                value={stats.sunsets}
                goal={100}
                color="#f97316"
                icon={<Sun className="w-4 h-4" />}
              />
              <ProgressBar
                label="Guitar Practice"
                value={stats.guitar}
                goal={200}
                color="#8b5cf6"
                icon={<Music className="w-4 h-4" />}
              />
            </div>
          </Card>

          <Card
            title="Workout Tracker (Last 14 Days)"
            gradient="purple"
            icon={<Activity className="w-5 h-5 text-purple-600" />}
          >
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 space-y-2">
                {["Push", "Pull", "Legs", "Surfing", "Full body", "Core", "Cardio"].map((k) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap[k] }}></span>
                      <span>{k}</span>
                    </div>
                    <span className="font-semibold">{stats.workoutCounts[k]}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gray-600"></span>
                    <span>Other</span>
                  </div>
                  <span className="font-semibold">{stats.discreetCount}</span>
                </div>
              </div>

              {stats.pieData.length > 0 && (
                <div className="flex justify-center">
                  <PieChart width={120} height={120}>
                    <Pie
                      data={stats.pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={40}
                      innerRadius={20}
                    >
                      {stats.pieData.map((entry: { color: string }, idx: number) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </div>
              )}
            </div>
          </Card>

          <Card
            title={`Days Behind: ${stats.daysBehind}`}
            gradient={stats.daysBehind > 3 ? "orange" : "gray"}
            icon={<Calendar className="w-5 h-5 text-gray-600" />}
          >
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Last entry:</span>
              </p>
              <p className="font-semibold text-gray-800">{stats.lastEntryStr}</p>
              {stats.daysBehind > 0 && (
                <div className="mt-3 p-2 bg-orange-100 rounded-lg">
                  <p className="text-xs text-orange-800">
                    {stats.daysBehind === 1 ? "You're 1 day behind" : `You're ${stats.daysBehind} days behind`}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Chart Section */}
        <Card
          title="Yearly Trends"
          gradient="gray"
          icon={<BarChart3 className="w-5 h-5 text-gray-600" />}
          className="mb-6"
        >
          {/* Chart Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-wrap gap-3">
              {Object.entries(visibleLines).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() =>
                    setVisibleLines((prev) => ({
                      ...prev,
                      [key as keyof typeof prev]: !prev[key as keyof typeof prev],
                    }))
                  }
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${
                      value
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"
                    }
                  `}
                >
                  {value ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {key.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowSmoothed(!showSmoothed)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${
                    showSmoothed
                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                      : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                  }
                `}
              >
                <Zap className="w-4 h-4 inline mr-1" />
                {showSmoothed ? "Smoothed" : "Raw Data"}
              </button>

              <button
                onClick={() => setTimeRange(timeRange === "year" ? "30days" : "year")}
                className="px-4 py-2 bg-gray-100 text-gray-600 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
              >
                {timeRange === "year" ? "Full Year" : "Last 30 Days"}
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={filteredData} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatTick(d, 0, timeRange !== "year")}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                />
                <YAxis
                  domain={[0, 10]}
                  ticks={[0, 2.5, 5, 7.5, 10]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                />
                <Tooltip
                  labelFormatter={formatTooltipLabel}
                  formatter={formatTooltipValue}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    fontSize: "14px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "14px", paddingTop: "20px" }} iconType="line" />
                {visibleLines.how_good && (
                  <Line
                    type="monotone"
                    dataKey="how_good"
                    stroke="#eab308"
                    name="How Good"
                    dot={false}
                    strokeWidth={3}
                    activeDot={{ r: 6, fill: "#eab308" }}
                  />
                )}
                {visibleLines.productivity && (
                  <Line
                    type="monotone"
                    dataKey="productivity"
                    stroke="#3b82f6"
                    name="Productivity"
                    dot={false}
                    strokeWidth={3}
                    activeDot={{ r: 6, fill: "#3b82f6" }}
                  />
                )}
                {visibleLines.drinks && (
                  <Line
                    type="monotone"
                    dataKey="drinks"
                    stroke="#ef4444"
                    name="Drinks"
                    dot={false}
                    strokeWidth={3}
                    activeDot={{ r: 6, fill: "#ef4444" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </main>
    </PinGate>
  )
}

// Keep all existing utility functions
function avg(arr: number[]) {
  const valid = arr.filter((n) => typeof n === "number" && !isNaN(n))
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0)
}

function dateDiff(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}
