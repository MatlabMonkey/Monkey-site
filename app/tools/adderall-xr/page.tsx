"use client"

import { type ReactNode, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Brain,
  Clock3,
  FlaskConical,
  Moon,
  Pill,
  Sun,
  TrendingUp,
} from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { simulateAdderallXR } from "../../../lib/tools/adderallXrModel"

const DAYS = 5

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function formatClockHour(hour: number) {
  const normalized = ((hour % 24) + 24) % 24
  const h = Math.floor(normalized)
  const m = Math.round((normalized - h) * 60)
  const date = new Date(Date.UTC(2020, 0, 1, h, m))
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

function formatBedtime(hour: number) {
  if (hour < 24) return formatClockHour(hour)
  return `${formatClockHour(hour)} (+1d)`
}

type RangeProps = {
  label: string
  icon?: ReactNode
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  valueLabel: string
}

function RangeInput({ label, icon, value, min, max, step = 0.5, onChange, valueLabel }: RangeProps) {
  return (
    <label className="block rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          {icon}
          {label}
        </span>
        <span className="text-sm text-[rgb(var(--text-muted))]">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </label>
  )
}

export default function AdderallXRPage() {
  const [doseMg, setDoseMg] = useState(10)
  const [firstDoseHour, setFirstDoseHour] = useState(7.5)
  const [secondDoseHour, setSecondDoseHour] = useState(12)
  const [vitaminCEnabled, setVitaminCEnabled] = useState(false)
  const [vitaminCHour, setVitaminCHour] = useState(17)
  const [vitaminCIntensity, setVitaminCIntensity] = useState(0.5)
  const [wakeHour, setWakeHour] = useState(7.5)
  const [bedHour, setBedHour] = useState(24)

  const safeSecondDose = clamp(secondDoseHour, firstDoseHour + 1, 20)

  const model = useMemo(
    () =>
      simulateAdderallXR({
        days: DAYS,
        dtMinutes: 10,
        doseMg,
        firstDoseHour,
        secondDoseHour: safeSecondDose,
        vitaminCEnabled,
        vitaminCHour,
        vitaminCIntensity,
        wakeHour,
        bedHour,
      }),
    [bedHour, doseMg, firstDoseHour, safeSecondDose, vitaminCEnabled, vitaminCHour, vitaminCIntensity, wakeHour],
  )

  const chartData = useMemo(
    () =>
      model.points.map((point) => {
        const day = Math.floor(point.tHours / 24) + 1
        const hour = point.tHours % 24
        return {
          x: point.tHours,
          concentration: Number(point.concentration.toFixed(4)),
          effect: Number(point.effect.toFixed(2)),
          day,
          clock: formatClockHour(hour),
          label: `Day ${day} • ${formatClockHour(hour)}`,
        }
      }),
    [model.points],
  )

  const latestDay = model.dayScores[model.dayScores.length - 1]

  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tools
        </Link>

        <header className="mt-6 mb-6 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Adderall XR Schedule Visualizer</h1>
              <p className="mt-2 text-[rgb(var(--text-muted))] max-w-3xl">
                Educational PK/PD simulator with XR split-dose release, effect delay, 5-day carryover, and optional
                vitamin C elimination boost.
              </p>
            </div>
            <div className="rounded-2xl border border-[rgb(180_83_9_/_0.45)] bg-[rgb(120_53_15_/_0.2)] px-4 py-3 text-xs max-w-xs">
              Not medical advice. Use this for schedule intuition only, and confirm decisions with your clinician.
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
            <p className="text-xs text-[rgb(var(--text-muted))] uppercase tracking-wide">Focus score (5-day avg)</p>
            <p className="mt-1 text-3xl font-semibold">{model.summary.focusScore.toFixed(0)}</p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
            <p className="text-xs text-[rgb(var(--text-muted))] uppercase tracking-wide">Sleep score (5-day avg)</p>
            <p className="mt-1 text-3xl font-semibold">{model.summary.sleepScore.toFixed(0)}</p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
            <p className="text-xs text-[rgb(var(--text-muted))] uppercase tracking-wide">Composite score</p>
            <p className="mt-1 text-3xl font-semibold">{model.summary.compositeScore.toFixed(0)}</p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
            <p className="text-xs text-[rgb(var(--text-muted))] uppercase tracking-wide">Latest day wake/sleep effect</p>
            <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">
              {latestDay ? `${latestDay.wakeEffectMean.toFixed(1)} / ${latestDay.sleepEffectMean.toFixed(1)}` : "-"}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <aside className="space-y-4">
            <RangeInput
              label="Dose per XR capsule"
              icon={<Pill className="h-4 w-4" />}
              value={doseMg}
              min={5}
              max={30}
              step={2.5}
              onChange={setDoseMg}
              valueLabel={`${doseMg.toFixed(1)} mg`}
            />
            <RangeInput
              label="Dose 1 time"
              icon={<Sun className="h-4 w-4" />}
              value={firstDoseHour}
              min={5}
              max={12}
              step={0.5}
              onChange={(value) => {
                setFirstDoseHour(value)
                setSecondDoseHour((prev) => clamp(prev, value + 1, 20))
              }}
              valueLabel={formatClockHour(firstDoseHour)}
            />
            <RangeInput
              label="Dose 2 time"
              icon={<Clock3 className="h-4 w-4" />}
              value={safeSecondDose}
              min={firstDoseHour + 1}
              max={20}
              step={0.5}
              onChange={setSecondDoseHour}
              valueLabel={formatClockHour(safeSecondDose)}
            />

            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4 space-y-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={vitaminCEnabled}
                  onChange={(event) => setVitaminCEnabled(event.target.checked)}
                />
                <FlaskConical className="h-4 w-4" />
                Vitamin C / acidic urine modifier
              </label>

              <RangeInput
                label="Vitamin C timing"
                value={vitaminCHour}
                min={6}
                max={23}
                step={0.5}
                onChange={setVitaminCHour}
                valueLabel={formatClockHour(vitaminCHour)}
              />

              <RangeInput
                label="Vitamin C intensity"
                value={vitaminCIntensity}
                min={0}
                max={1}
                step={0.05}
                onChange={setVitaminCIntensity}
                valueLabel={`${Math.round(vitaminCIntensity * 100)}%`}
              />
            </div>

            <RangeInput
              label="Wake time"
              icon={<Sun className="h-4 w-4" />}
              value={wakeHour}
              min={4}
              max={12}
              step={0.5}
              onChange={setWakeHour}
              valueLabel={formatClockHour(wakeHour)}
            />
            <RangeInput
              label="Bedtime"
              icon={<Moon className="h-4 w-4" />}
              value={bedHour}
              min={20}
              max={28}
              step={0.5}
              onChange={setBedHour}
              valueLabel={formatBedtime(bedHour)}
            />
          </aside>

          <div className="space-y-4">
            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.6)] p-4 md:p-6">
              <h2 className="text-lg font-semibold mb-2 inline-flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Concentration + Effect over {DAYS} days
              </h2>
              <p className="text-sm text-[rgb(var(--text-muted))] mb-4">
                Hover for exact values. Concentration (left axis, mg/L model estimate) and effect (right axis, 0–100) are
                intentionally separate curves.
              </p>
              <div className="h-[440px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
                    <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={[0, DAYS * 24]}
                      tickFormatter={(value) => `D${Math.floor(value / 24) + 1} ${formatClockHour(value % 24)}`}
                      tick={{ fill: "rgb(var(--text-muted))", fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "rgb(var(--text-muted))", fontSize: 11 }}
                      label={{ value: "Concentration", angle: -90, position: "insideLeft", fill: "rgb(var(--text-muted))" }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fill: "rgb(var(--text-muted))", fontSize: 11 }}
                      label={{ value: "Effect", angle: 90, position: "insideRight", fill: "rgb(var(--text-muted))" }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "Concentration") return [`${value.toFixed(4)} mg/L`, name]
                        return [`${value.toFixed(1)} / 100`, name]
                      }}
                      labelFormatter={(label: number) => {
                        const day = Math.floor(label / 24) + 1
                        return `Day ${day} • ${formatClockHour(label % 24)}`
                      }}
                      contentStyle={{
                        background: "rgb(15 23 42 / 0.95)",
                        border: "1px solid rgb(71 85 105 / 0.8)",
                        borderRadius: 12,
                        color: "rgb(226 232 240)",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="concentration"
                      name="Concentration"
                      stroke="rgb(59 130 246)"
                      strokeWidth={2.2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="effect"
                      name="Effect"
                      stroke="rgb(244 114 182)"
                      strokeWidth={2.2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.6)] p-4 md:p-6">
              <h3 className="text-lg font-semibold mb-3 inline-flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Model notes
              </h3>
              <ul className="space-y-2 text-sm text-[rgb(var(--text-muted))] list-disc pl-5">
                <li>Each XR capsule is modeled as 50% immediate release + 50% delayed release (~4h lag).</li>
                <li>Effect uses an effect-compartment delay, so effect can stay elevated after plasma starts dropping.</li>
                <li>Vitamin C slider acts as a heuristic acidification/elimination modifier, not a clinical conversion.</li>
                <li>A 14-day pre-roll is simulated before the displayed 5-day window to approximate steady-state carryover.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
