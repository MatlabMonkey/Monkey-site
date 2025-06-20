"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import PinGate from "../components/PinGate"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts"
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
  Sparkles,
  Clock,
  TrendingDown,
  BookOpen,
  RotateCcw,
  Flame,
  Award,
} from "lucide-react"

// Enhanced smoothing functions with different sigma values
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

// Streak calculation function
function calculateStreak(
  entries: any[],
  habitKey: string,
  isBoolean = true,
): { current: number; longest: number; lastDate: string | null } {
  if (entries.length === 0) return { current: 0, longest: 0, lastDate: null }

  // Sort entries by date (most recent first)
  const sortedEntries = [...entries].sort((a, b) => b.date.getTime() - a.date.getTime())

  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  let lastStreakDate = null

  // Check if we should count today/yesterday for current streak
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  for (let i = 0; i < sortedEntries.length; i++) {
    const entry = sortedEntries[i]
    const hasHabit = isBoolean ? entry.booleans?.includes(habitKey) : entry[habitKey] > 0 // For non-boolean habits like productivity > 7

    if (hasHabit) {
      tempStreak++

      // For current streak, only count if it's recent (today or consecutive days leading to today/yesterday)
      if (i === 0 && (isSameDay(entry.date, today) || isSameDay(entry.date, yesterday))) {
        currentStreak = 1
        lastStreakDate = entry.date

        // Continue counting backwards for consecutive days
        for (let j = 1; j < sortedEntries.length; j++) {
          const prevEntry = sortedEntries[j]
          const expectedDate = new Date(sortedEntries[j - 1].date)
          expectedDate.setDate(expectedDate.getDate() - 1)

          if (
            isSameDay(prevEntry.date, expectedDate) &&
            (isBoolean ? prevEntry.booleans?.includes(habitKey) : prevEntry[habitKey] > 0)
          ) {
            currentStreak++
          } else {
            break
          }
        }
      }

      longestStreak = Math.max(longestStreak, tempStreak)
    } else {
      tempStreak = 0
    }
  }

  return {
    current: currentStreak,
    longest: longestStreak,
    lastDate: lastStreakDate ? lastStreakDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null,
  }
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function formatTick(dateStr: string, index: number, showAllDays: boolean) {
  const [y, m, d] = dateStr.split("-")
  const day = Number.parseInt(d, 10)
  if (showAllDays) return `${Number.parseInt(m, 10)}/${d}`
  return day === 1 ? new Date(dateStr).toLocaleString("default", { month: "short" }) : ""
}

function formatTooltipLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
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
  "Full body": "#22c55e",
  Surfing: "#3b82f6",
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

// Streak Card Component
function StreakCard({
  title,
  icon,
  current,
  longest,
  lastDate,
  color,
}: {
  title: string
  icon: React.ReactNode
  current: number
  longest: number
  lastDate: string | null
  color: string
}) {
  const isActive = current > 0

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ${
        isActive ? `bg-gradient-to-br ${color} shadow-lg` : "bg-gray-50 border border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl ${isActive ? "bg-white/20" : "bg-gray-200"}`}>{icon}</div>
        {isActive && <Flame className="w-5 h-5 text-orange-300 animate-pulse" />}
      </div>

      <div className="space-y-1">
        <h3 className={`text-sm font-medium ${isActive ? "text-white/90" : "text-gray-600"}`}>{title}</h3>
        <div className={`text-2xl font-bold ${isActive ? "text-white" : "text-gray-800"}`}>
          {current} {current === 1 ? "day" : "days"}
        </div>
        <div className={`text-xs ${isActive ? "text-white/70" : "text-gray-500"}`}>
          Best: {longest} days
          {lastDate && current > 0 && <span className="block">Last: {lastDate}</span>}
        </div>
      </div>

      {current >= 7 && (
        <div className="absolute top-2 right-2">
          <Award className="w-4 h-4 text-yellow-300" />
        </div>
      )}
    </div>
  )
}

// Flippable Metric Card Component
function FlippableMetricCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  trend,
  yearValue,
  yearSubtitle,
  children,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  gradient: string
  trend?: "up" | "down" | "neutral"
  yearValue: string | number
  yearSubtitle: string
  children?: React.ReactNode
}) {
  const [isFlipped, setIsFlipped] = useState(false)

  return (
    <div className="relative h-48 perspective-1000">
      <div
        className={`relative w-full h-full transition-transform duration-700 transform-style-preserve-3d cursor-pointer ${
          isFlipped ? "rotate-y-180" : ""
        }`}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Front Side */}
        <div
          className={`absolute inset-0 w-full h-full backface-hidden overflow-hidden rounded-3xl p-6 ${gradient} shadow-lg hover:shadow-xl transition-all duration-300 group`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10 transform translate-x-8 -translate-y-8">
            <div className="w-full h-full rounded-full bg-white"></div>
          </div>

          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">{icon}</div>
              <div className="flex items-center gap-2">
                {trend && (
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      trend === "up"
                        ? "bg-green-100 text-green-700"
                        : trend === "down"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {trend === "up" ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : trend === "down" ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                  </div>
                )}
                <RotateCcw className="w-4 h-4 text-white/60" />
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-1">
              <h3 className="text-white/80 text-sm font-medium">{title}</h3>
              <div className="text-3xl font-bold text-white">{value}</div>
              {subtitle && <p className="text-white/70 text-sm">{subtitle}</p>}
            </div>

            {children && <div className="mt-4">{children}</div>}
          </div>
        </div>

        {/* Back Side */}
        <div
          className={`absolute inset-0 w-full h-full backface-hidden rotate-y-180 overflow-hidden rounded-3xl p-6 ${gradient} shadow-lg hover:shadow-xl transition-all duration-300 group`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10 transform translate-x-8 -translate-y-8">
            <div className="w-full h-full rounded-full bg-white"></div>
          </div>

          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">{icon}</div>
              <RotateCcw className="w-4 h-4 text-white/60" />
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-1">
              <h3 className="text-white/80 text-sm font-medium">{title}</h3>
              <div className="text-3xl font-bold text-white">{yearValue}</div>
              <p className="text-white/70 text-sm">{yearSubtitle}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Progress Ring Component
function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "#3b82f6",
}: {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = `${circumference} ${circumference}`
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-gray-700">{Math.round(progress)}%</span>
      </div>
    </div>
  )
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

      // Enhanced random function that returns both value and date
      const randWithDate = (arr: any[], field: string) => {
        const validEntries = arr.filter((e) => e[field]?.trim())
        if (validEntries.length === 0) return { value: "—", date: null }
        const randomEntry = validEntries.sort(() => 0.5 - Math.random())[0]
        return {
          value: randomEntry[field],
          date: randomEntry.date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        }
      }

      const workouts = ["Push", "Pull", "Legs", "Full body", "Surfing", "Core", "Cardio"]
      const workoutCounts: Record<string, number> = Object.fromEntries(workouts.map((type) => [type, 0]))
      let other = 0
      let sunsets = 0
      let guitar = 0
      let reading = 0
      let totalWorkouts14 = 0
      let totalWorkoutsYear = 0

      last14.forEach((e) => {
        e.booleans?.forEach((val: string) => {
          if (workouts.includes(val)) {
            workoutCounts[val]++
            totalWorkouts14++
          }
        })
        other += e.scount || 0
      })

      thisYearEntries.forEach((e) => {
        e.booleans?.forEach((val: string) => {
          if (val === "Watch sunset") sunsets++
          if (val === "Guitar") guitar++
          if (val === "Read ten pages") reading++
          if (workouts.includes(val)) totalWorkoutsYear++
        })
      })

      // Calculate streaks for various habits
      const streaks = {
        workout: calculateStreak(thisYearEntries, "workout", false), // Any workout
        reading: calculateStreak(thisYearEntries, "Read ten pages", true),
        guitar: calculateStreak(thisYearEntries, "Guitar", true),
        sunset: calculateStreak(thisYearEntries, "Watch sunset", true),
        highProductivity: calculateStreak(thisYearEntries, "productivity", false), // productivity > 7
        goodDay: calculateStreak(thisYearEntries, "how_good", false), // how_good > 7
      }

      // Custom streak calculation for workouts (any workout type)
      streaks.workout = calculateStreak(
        thisYearEntries.map((e) => ({
          ...e,
          workout: e.booleans?.some((b: string) => workouts.includes(b)) ? 1 : 0,
        })),
        "workout",
        false,
      )

      // Custom streak calculation for high productivity (>= 7)
      streaks.highProductivity = calculateStreak(
        thisYearEntries.map((e) => ({
          ...e,
          productivity: e.productivity >= 7 ? 1 : 0,
        })),
        "productivity",
        false,
      )

      // Custom streak calculation for good days (>= 7)
      streaks.goodDay = calculateStreak(
        thisYearEntries.map((e) => ({
          ...e,
          how_good: e.how_good >= 7 ? 1 : 0,
        })),
        "how_good",
        false,
      )

      const pieData = Object.entries(workoutCounts)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({
          name,
          value,
          color: colorMap[name] || "#6b7280",
        }))

      // Use different sigma values based on time range
      const sigma = timeRange === "30days" ? 0.8 : 2
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
        avgQualityYear: avg(thisYearEntries.map((e) => e.how_good)),
        avgProductivity7: avg(last7.map((e) => e.productivity)),
        avgProductivityYear: avg(thisYearEntries.map((e) => e.productivity)),
        totalDrinksYear: sum(thisYearEntries.map((e) => e.drinks)),
        drinks14: sum(last14.map((e) => e.drinks)),
        discreetCount: other,
        rose: randWithDate(parsed, "rose"),
        gratitude: randWithDate(parsed, "gratitude"),
        thought: randWithDate(parsed, "thought_of_day"),
        workoutCounts,
        totalWorkouts14,
        totalWorkoutsYear,
        sunsets,
        guitar,
        reading,
        streaks,
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 opacity-20 animate-pulse"></div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">Loading Dashboard</h2>
            <p className="text-gray-600">Preparing your personal insights...</p>
          </div>
        </div>
      </div>
    )
  }

  const chartData = showSmoothed ? stats.chartData : stats.rawChartData
  const filteredData = chartData.slice(timeRange === "year" ? 0 : -30)

  return (
    <PinGate>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Life Dashboard
                </h1>
                <p className="text-gray-600 mt-1">Your personal journey insights and analytics</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full">
                  <span className="text-sm font-medium text-green-700">
                    {stats.daysBehind === 0 ? "Up to date!" : `${stats.daysBehind} days behind`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Key Metrics Row - Now Flippable */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FlippableMetricCard
              title="Quality of Life"
              value={stats.avgQuality7.toFixed(1)}
              subtitle="7-day average"
              yearValue={stats.avgQualityYear.toFixed(1)}
              yearSubtitle="Full year average"
              icon={<Heart className="w-6 h-6 text-white" />}
              gradient="bg-gradient-to-br from-pink-500 to-rose-600"
              trend="up"
            />

            <FlippableMetricCard
              title="Productivity"
              value={stats.avgProductivity7.toFixed(1)}
              subtitle="7-day average"
              yearValue={stats.avgProductivityYear.toFixed(1)}
              yearSubtitle="Full year average"
              icon={<Zap className="w-6 h-6 text-white" />}
              gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
              trend="neutral"
            />

            <FlippableMetricCard
              title="Total Workouts"
              value={stats.totalWorkouts14}
              subtitle="Last 14 days"
              yearValue={stats.totalWorkoutsYear}
              yearSubtitle="Full year total"
              icon={<Activity className="w-6 h-6 text-white" />}
              gradient="bg-gradient-to-br from-green-500 to-emerald-600"
              trend="up"
            />

            <FlippableMetricCard
              title="Drinks"
              value={stats.drinks14}
              subtitle="Last 14 days"
              yearValue={stats.totalDrinksYear}
              yearSubtitle="Full year total"
              icon={<Wine className="w-6 h-6 text-white" />}
              gradient="bg-gradient-to-br from-orange-500 to-red-600"
              trend="down"
            />
          </div>

          {/* Habit Streaks Section */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-200/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-100 rounded-xl">
                <Flame className="w-5 h-5 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Habit Streaks</h2>
              <span className="text-sm text-gray-500">Current consecutive days</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StreakCard
                title="Workouts"
                icon={<Activity className="w-5 h-5 text-white" />}
                current={stats.streaks.workout.current}
                longest={stats.streaks.workout.longest}
                lastDate={stats.streaks.workout.lastDate}
                color="from-green-500 to-emerald-600"
              />

              <StreakCard
                title="Reading"
                icon={<BookOpen className="w-5 h-5 text-white" />}
                current={stats.streaks.reading.current}
                longest={stats.streaks.reading.longest}
                lastDate={stats.streaks.reading.lastDate}
                color="from-blue-500 to-indigo-600"
              />

              <StreakCard
                title="Guitar"
                icon={<Music className="w-5 h-5 text-white" />}
                current={stats.streaks.guitar.current}
                longest={stats.streaks.guitar.longest}
                lastDate={stats.streaks.guitar.lastDate}
                color="from-purple-500 to-violet-600"
              />

              <StreakCard
                title="Sunsets"
                icon={<Sun className="w-5 h-5 text-white" />}
                current={stats.streaks.sunset.current}
                longest={stats.streaks.sunset.longest}
                lastDate={stats.streaks.sunset.lastDate}
                color="from-orange-500 to-red-600"
              />

              <StreakCard
                title="High Productivity"
                icon={<Zap className="w-5 h-5 text-white" />}
                current={stats.streaks.highProductivity.current}
                longest={stats.streaks.highProductivity.longest}
                lastDate={stats.streaks.highProductivity.lastDate}
                color="from-cyan-500 to-blue-600"
              />

              <StreakCard
                title="Good Days"
                icon={<Heart className="w-5 h-5 text-white" />}
                current={stats.streaks.goodDay.current}
                longest={stats.streaks.goodDay.longest}
                lastDate={stats.streaks.goodDay.lastDate}
                color="from-pink-500 to-rose-600"
              />
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-8">
              {/* Chart Section */}
              <div className="bg-white rounded-3xl shadow-lg border border-gray-200/50 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 rounded-xl">
                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                      </div>
                      <h2 className="text-xl font-bold text-gray-800">Trends Over Time</h2>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowSmoothed(!showSmoothed)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          showSmoothed
                            ? "bg-purple-100 text-purple-700 border border-purple-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <Sparkles className="w-4 h-4 inline mr-1" />
                        {showSmoothed ? "Smoothed" : "Raw"}
                      </button>

                      <button
                        onClick={() => setTimeRange(timeRange === "year" ? "30days" : "year")}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all"
                      >
                        {timeRange === "year" ? "Full Year" : "30 Days"}
                      </button>
                    </div>
                  </div>

                  {/* Line Toggles */}
                  <div className="flex flex-wrap gap-3 mt-4">
                    {Object.entries(visibleLines).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() =>
                          setVisibleLines((prev) => ({
                            ...prev,
                            [key as keyof typeof prev]: !prev[key as keyof typeof prev],
                          }))
                        }
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                          value
                            ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {value ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        {key.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={filteredData} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => formatTick(d, 0, timeRange !== "year")}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        interval={timeRange === "year" ? "preserveStartEnd" : 0}
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
                          border: "none",
                          borderRadius: "16px",
                          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                          fontSize: "14px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "14px", paddingTop: "20px" }} iconType="rect" iconSize={12} />
                      {visibleLines.how_good && (
                        <Line
                          type="monotone"
                          dataKey="how_good"
                          stroke="#eab308"
                          name="How Good"
                          dot={false}
                          strokeWidth={3}
                          activeDot={{ r: 6, fill: "#eab308", strokeWidth: 2, stroke: "#fff" }}
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
                          activeDot={{ r: 6, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
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
                          activeDot={{ r: 6, fill: "#ef4444", strokeWidth: 2, stroke: "#fff" }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Highlights Section with Dates */}
              <div className="bg-white rounded-3xl shadow-lg border border-gray-200/50 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-pink-100 rounded-xl">
                    <Sparkles className="w-5 h-5 text-pink-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Random Highlights</h2>
                </div>

                <div className="grid gap-4">
                  <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 rounded-2xl border border-rose-100">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🌹</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-rose-800">Highlight</h3>
                          <span className="text-xs text-rose-600 bg-rose-100 px-2 py-1 rounded-full">
                            {stats.rose.date}
                          </span>
                        </div>
                        <p className="text-rose-700 text-sm leading-relaxed">{stats.rose.value}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border border-emerald-100">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🙏</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-emerald-800">Gratitude</h3>
                          <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                            {stats.gratitude.date}
                          </span>
                        </div>
                        <p className="text-emerald-700 text-sm leading-relaxed">{stats.gratitude.value}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">💭</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-blue-800">Thought</h3>
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                            {stats.thought.date}
                          </span>
                        </div>
                        <p className="text-blue-700 text-sm leading-relaxed">{stats.thought.value}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Goals Progress - Now with Reading and Total Workouts */}
              <div className="bg-white rounded-3xl shadow-lg border border-gray-200/50 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <Target className="w-5 h-5 text-amber-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Goals Progress</h2>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      <Sun className="w-4 h-4 text-orange-500 mr-2" />
                      <span className="font-semibold text-gray-700 text-sm">Sunsets</span>
                    </div>
                    <ProgressRing progress={(stats.sunsets / 100) * 100} color="#f97316" size={80} strokeWidth={6} />
                    <p className="text-xs text-gray-600 mt-2">{stats.sunsets}/100</p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      <Music className="w-4 h-4 text-purple-500 mr-2" />
                      <span className="font-semibold text-gray-700 text-sm">Guitar</span>
                    </div>
                    <ProgressRing progress={(stats.guitar / 200) * 100} color="#8b5cf6" size={80} strokeWidth={6} />
                    <p className="text-xs text-gray-600 mt-2">{stats.guitar}/200</p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      <BookOpen className="w-4 h-4 text-blue-500 mr-2" />
                      <span className="font-semibold text-gray-700 text-sm">Reading</span>
                    </div>
                    <ProgressRing progress={(stats.reading / 200) * 100} color="#3b82f6" size={80} strokeWidth={6} />
                    <p className="text-xs text-gray-600 mt-2">{stats.reading}/200</p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      <Activity className="w-4 h-4 text-green-500 mr-2" />
                      <span className="font-semibold text-gray-700 text-sm">Workouts</span>
                    </div>
                    <ProgressRing
                      progress={(stats.totalWorkoutsYear / 300) * 100}
                      color="#22c55e"
                      size={80}
                      strokeWidth={6}
                    />
                    <p className="text-xs text-gray-600 mt-2">{stats.totalWorkoutsYear}/300</p>
                  </div>
                </div>
              </div>

              {/* Workout Distribution */}
              <div className="bg-white rounded-3xl shadow-lg border border-gray-200/50 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 rounded-xl">
                    <Activity className="w-5 h-5 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Workouts (14 days)</h2>
                </div>

                <div className="space-y-4">
                  {["Push", "Pull", "Legs", "Full body", "Surfing", "Core", "Cardio"].map((workout) => (
                    <div key={workout} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: colorMap[workout] }}></div>
                        <span className="text-sm font-medium text-gray-700">{workout}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-800">{stats.workoutCounts[workout]}</span>
                    </div>
                  ))}

                  {stats.pieData.length > 0 && (
                    <div className="flex justify-center mt-6">
                      <PieChart width={160} height={160}>
                        <Pie
                          data={stats.pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          innerRadius={30}
                        >
                          {stats.pieData.map((entry: { color: string }, idx: number) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </div>
                  )}
                </div>
              </div>

              {/* Last Entry Status */}
              <div
                className={`rounded-3xl shadow-lg border p-6 ${
                  stats.daysBehind > 3
                    ? "bg-gradient-to-br from-red-50 to-orange-50 border-red-200/50"
                    : "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/50"
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-xl ${stats.daysBehind > 3 ? "bg-red-100" : "bg-green-100"}`}>
                    <Calendar className={`w-5 h-5 ${stats.daysBehind > 3 ? "text-red-600" : "text-green-600"}`} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Journal Status</h2>
                </div>

                <div className="space-y-3">
                  <div className={`text-3xl font-bold ${stats.daysBehind > 3 ? "text-red-700" : "text-green-700"}`}>
                    {stats.daysBehind === 0 ? "✅ Current" : `${stats.daysBehind} days behind`}
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Last entry:</span>
                    <br />
                    {stats.lastEntryStr}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </PinGate>
  )
}

// Utility functions
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
