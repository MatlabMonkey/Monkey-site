"use client"

import { type ReactNode, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, BookOpenCheck, BriefcaseBusiness, Clock3, FlaskConical, Moon, Pill, Sun, TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { simulateAdderallXR } from "../../../lib/tools/adderallXrModel"

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeRange(start: number, end: number) {
  if (end <= start) return { start, end: end + 24 }
  return { start, end }
}

function formatClockHour(hour: number) {
  const normalized = ((hour % 24) + 24) % 24
  const h = Math.floor(normalized)
  const m = Math.round((normalized - h) * 60)
  const date = new Date(Date.UTC(2020, 0, 1, h, m))
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

function formatExtendedHour(hour: number) {
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

type WindowRangeProps = {
  label: string
  icon?: ReactNode
  start: number
  end: number
  min: number
  max: number
  onChangeStart: (value: number) => void
  onChangeEnd: (value: number) => void
}

function WindowRange({ label, icon, start, end, min, max, onChangeStart, onChangeEnd }: WindowRangeProps) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          {icon}
          {label}
        </span>
        <span className="text-sm text-[rgb(var(--text-muted))]">
          {formatExtendedHour(start)} → {formatExtendedHour(end)}
        </span>
      </div>

      <div>
        <p className="text-xs text-[rgb(var(--text-muted))] mb-1">Start</p>
        <input type="range" min={min} max={max} step={0.5} value={start} onChange={(e) => onChangeStart(Number(e.target.value))} className="w-full" />
      </div>

      <div>
        <p className="text-xs text-[rgb(var(--text-muted))] mb-1">End</p>
        <input type="range" min={min} max={max} step={0.5} value={end} onChange={(e) => onChangeEnd(Number(e.target.value))} className="w-full" />
      </div>
    </div>
  )
}

function clipRange(start: number, end: number, min = 0, max = 31) {
  const s = Math.max(min, Math.min(max, start))
  const e = Math.max(min, Math.min(max, end))
  if (e <= s) return null
  return { start: s, end: e }
}

export default function AdderallXRPage() {
  const [doseMg, setDoseMg] = useState(10)
  const [wakeHour, setWakeHour] = useState(7.5)
  const [firstDoseHour, setFirstDoseHour] = useState(8)
  const [secondDoseHour, setSecondDoseHour] = useState(12)

  const [vitaminCEnabled, setVitaminCEnabled] = useState(false)
  const [vitaminCHour, setVitaminCHour] = useState(22)
  const [vitaminCDoseGrams, setVitaminCDoseGrams] = useState(1)

  const [bedHour, setBedHour] = useState(23)

  const [workStartHour, setWorkStartHour] = useState(9)
  const [workEndHour, setWorkEndHour] = useState(17)
  const [homeworkStartHour, setHomeworkStartHour] = useState(19)
  const [homeworkEndHour, setHomeworkEndHour] = useState(22)

  const safeFirstDose = clamp(firstDoseHour, wakeHour, 22)
  const safeSecondDose = clamp(secondDoseHour, safeFirstDose + 1, 24)

  const safeWorkRange = normalizeRange(clamp(workStartHour, 6, 26), clamp(workEndHour, 6, 26))
  const safeHomeworkRange = normalizeRange(clamp(homeworkStartHour, 6, 26), clamp(homeworkEndHour, 6, 26))

  const sleepRange = { start: bedHour, end: wakeHour + 24 }

  const model = useMemo(
    () =>
      simulateAdderallXR({
        days: 1,
        dtMinutes: 10,
        doseMg,
        firstDoseHour: safeFirstDose,
        secondDoseHour: safeSecondDose,
        vitaminCEnabled,
        vitaminCHour,
        vitaminCDoseGrams,
        wakeHour,
        bedHour,
        workStartHour: safeWorkRange.start,
        workEndHour: safeWorkRange.end,
        homeworkStartHour: safeHomeworkRange.start,
        homeworkEndHour: safeHomeworkRange.end,
      }),
    [
      bedHour,
      doseMg,
      safeFirstDose,
      safeSecondDose,
      safeHomeworkRange.end,
      safeHomeworkRange.start,
      safeWorkRange.end,
      safeWorkRange.start,
      vitaminCDoseGrams,
      vitaminCEnabled,
      vitaminCHour,
      wakeHour,
    ],
  )

  const chartData = useMemo(
    () =>
      model.points.map((point) => ({
        x: point.tHours,
        concentration: Number(point.concentration.toFixed(4)),
        effect: Number(point.effect.toFixed(2)),
      })),
    [model.points],
  )

  const workHighlight = clipRange(safeWorkRange.start, safeWorkRange.end)
  const homeworkHighlight = clipRange(safeHomeworkRange.start, safeHomeworkRange.end)
  const sleepHighlight = clipRange(sleepRange.start, sleepRange.end)

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
          <h1 className="text-3xl md:text-4xl font-bold">Adderall XR Schedule Visualizer</h1>
          <p className="mt-2 text-[rgb(var(--text-muted))] max-w-4xl">
            Single-day planner (midnight → next-day 7 AM). Baseline carryover is fixed from a standard 8:00 AM + 12:00 PM routine,
            so your sliders adjust only the simulated day.
          </p>
        </header>

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
              label="Wake time"
              icon={<Sun className="h-4 w-4" />}
              value={wakeHour}
              min={4}
              max={12}
              step={0.5}
              onChange={(value) => {
                setWakeHour(value)
                setFirstDoseHour((prev) => clamp(prev, value, 22))
              }}
              valueLabel={formatClockHour(wakeHour)}
            />

            <RangeInput
              label="Dose 1 time"
              icon={<Clock3 className="h-4 w-4" />}
              value={safeFirstDose}
              min={wakeHour}
              max={22}
              step={0.5}
              onChange={(value) => {
                setFirstDoseHour(value)
                setSecondDoseHour((prev) => clamp(prev, value + 1, 24))
              }}
              valueLabel={formatClockHour(safeFirstDose)}
            />

            <RangeInput
              label="Dose 2 time"
              icon={<Sun className="h-4 w-4" />}
              value={safeSecondDose}
              min={safeFirstDose + 1}
              max={24}
              step={0.5}
              onChange={setSecondDoseHour}
              valueLabel={formatExtendedHour(safeSecondDose)}
            />

            <RangeInput
              label="Bedtime"
              icon={<Moon className="h-4 w-4" />}
              value={bedHour}
              min={20}
              max={28}
              step={0.5}
              onChange={setBedHour}
              valueLabel={formatExtendedHour(bedHour)}
            />

            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4 space-y-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={vitaminCEnabled}
                  onChange={(event) => setVitaminCEnabled(event.target.checked)}
                />
                <FlaskConical className="h-4 w-4" />
                Vitamin C (acidification model)
              </label>

              <RangeInput
                label="Vitamin C time"
                value={vitaminCHour}
                min={16}
                max={28}
                step={0.5}
                onChange={setVitaminCHour}
                valueLabel={formatExtendedHour(vitaminCHour)}
              />

              <RangeInput
                label="Vitamin C dose"
                value={vitaminCDoseGrams}
                min={0}
                max={2}
                step={0.1}
                onChange={setVitaminCDoseGrams}
                valueLabel={`${vitaminCDoseGrams.toFixed(1)} g`}
              />
            </div>

            <WindowRange
              label="Work window"
              icon={<BriefcaseBusiness className="h-4 w-4" />}
              start={workStartHour}
              end={workEndHour}
              min={6}
              max={26}
              onChangeStart={setWorkStartHour}
              onChangeEnd={setWorkEndHour}
            />

            <WindowRange
              label="Homework window"
              icon={<BookOpenCheck className="h-4 w-4" />}
              start={homeworkStartHour}
              end={homeworkEndHour}
              min={6}
              max={26}
              onChangeStart={setHomeworkStartHour}
              onChangeEnd={setHomeworkEndHour}
            />
          </aside>

          <div className="space-y-4">
            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.6)] p-4 md:p-6">
              <h2 className="text-lg font-semibold mb-2 inline-flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Concentration + Effect (00:00 → 07:00 next day)
              </h2>
              <p className="text-sm text-[rgb(var(--text-muted))] mb-4">
                Shaded regions show your work, homework, and sleep windows. Scores are mean effect in each window.
              </p>

              <div className="h-[440px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
                    <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="4 4" />

                    {sleepHighlight && <ReferenceArea x1={sleepHighlight.start} x2={sleepHighlight.end} fill="rgba(56,189,248,0.12)" />}
                    {workHighlight && <ReferenceArea x1={workHighlight.start} x2={workHighlight.end} fill="rgba(34,197,94,0.10)" />}
                    {homeworkHighlight && <ReferenceArea x1={homeworkHighlight.start} x2={homeworkHighlight.end} fill="rgba(168,85,247,0.10)" />}

                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={[0, 31]}
                      tickFormatter={(value) => formatExtendedHour(value)}
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
                      labelFormatter={(label: number) => formatExtendedHour(label)}
                      contentStyle={{
                        background: "rgb(15 23 42 / 0.95)",
                        border: "1px solid rgb(71 85 105 / 0.8)",
                        borderRadius: 12,
                        color: "rgb(226 232 240)",
                      }}
                    />
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

              <section className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
                  <p className="text-xs text-[rgb(var(--text-muted))] uppercase tracking-wide">Work score</p>
                  <p className="mt-1 text-3xl font-semibold">{model.summary.workScore.toFixed(1)}</p>
                  <p className="text-xs text-[rgb(var(--text-muted))] mt-1">Mean effect in work window</p>
                </div>
                <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
                  <p className="text-xs text-[rgb(var(--text-muted))] uppercase tracking-wide">Homework score</p>
                  <p className="mt-1 text-3xl font-semibold">{model.summary.homeworkScore.toFixed(1)}</p>
                  <p className="text-xs text-[rgb(var(--text-muted))] mt-1">Mean effect in homework window</p>
                </div>
                <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
                  <p className="text-xs text-[rgb(var(--text-muted))] uppercase tracking-wide">Sleep score (lower better)</p>
                  <p className="mt-1 text-3xl font-semibold">{model.summary.sleepScore.toFixed(1)}</p>
                  <p className="text-xs text-[rgb(var(--text-muted))] mt-1">Mean effect between bedtime and wake</p>
                </div>
              </section>
            </div>

            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.6)] p-4 md:p-6">
              <h3 className="text-lg font-semibold mb-3">Model notes</h3>
              <ul className="space-y-2 text-sm text-[rgb(var(--text-muted))] list-disc pl-5">
                <li>Each XR capsule is modeled as 50% immediate release + 50% delayed release (~4h lag).</li>
                <li>Effect uses an effect-compartment delay, so effect can stay elevated after plasma starts dropping.</li>
                <li>
                  Vitamin C uses a pH-elimination heuristic anchored to literature-like ranges (amphetamine half-life ~11.5h baseline,
                  potentially trending toward ~7h under stronger acidification).
                </li>
                <li>Baseline carryover is fixed from a stable 8:00 AM + 12:00 PM pattern and is not moved by your slider values.</li>
                <li>Midnight baseline concentration: {model.summary.baselineMidnightConcentration.toFixed(4)} mg/L.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
