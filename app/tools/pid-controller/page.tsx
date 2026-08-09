"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Gauge, Pause, Play, RotateCcw, SlidersHorizontal, Zap } from "lucide-react"
import {
  calculateResponseMetrics,
  DEFAULT_PENDULUM_PARAMS,
  DISTURBANCE_TIME,
  type PendulumParams,
  REFERENCE_STEP_TIME,
  SIM_DT,
  SIM_DURATION,
  simulateInvertedPendulum,
} from "../../../lib/tools/invertedPendulum"

type SliderConfig = {
  key: keyof PendulumParams
  label: string
  min: number
  max: number
  step: number
  unit?: string
  hint: string
}

const GAIN_SLIDERS: SliderConfig[] = [
  { key: "kp", label: "Proportional gain (Kp)", min: 0, max: 60, step: 0.5, hint: "Pushes against present error." },
  { key: "ki", label: "Integral gain (Ki)", min: 0, max: 15, step: 0.1, hint: "Removes persistent offset." },
  { key: "kd", label: "Derivative gain (Kd)", min: 0, max: 15, step: 0.1, hint: "Damps fast motion and overshoot." },
]

const SCENARIO_SLIDERS: SliderConfig[] = [
  { key: "referenceDeg", label: "Reference angle", min: -15, max: 15, step: 1, unit: "°", hint: "Command applied at t = 1 s." },
  { key: "initialDeg", label: "Initial angle", min: -20, max: 20, step: 1, unit: "°", hint: "Starting error from upright." },
  { key: "disturbance", label: "Disturbance pulse", min: -8, max: 8, step: 0.5, unit: " N·m", hint: "External torque applied at t = 6 s." },
]

const PLANT_SLIDERS: SliderConfig[] = [
  { key: "mass", label: "Pendulum mass", min: 0.2, max: 1.5, step: 0.05, unit: " kg", hint: "Heavier plants need more authority." },
  { key: "length", label: "Pendulum length", min: 0.3, max: 1.2, step: 0.05, unit: " m", hint: "Changes inertia and fall rate." },
  { key: "torqueLimit", label: "Actuator limit", min: 2, max: 25, step: 0.5, unit: " N·m", hint: "Clips the controller output." },
]

const PRESETS: { label: string; gains: Pick<PendulumParams, "kp" | "ki" | "kd"> }[] = [
  { label: "Balanced PID", gains: { kp: 35, ki: 5, kd: 8 } },
  { label: "P only", gains: { kp: 16, ki: 0, kd: 0 } },
  { label: "Overdamped", gains: { kp: 35, ki: 4, kd: 12 } },
  { label: "Unstable", gains: { kp: 2, ki: 0, kd: 0 } },
]

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function ensureCanvasSize(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr))
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  return { width, height, dpr }
}

function Slider({ config, value, onChange }: { config: SliderConfig; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.38)] p-4">
      <span className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">{config.label}</span>
        <span className="font-mono text-[rgb(var(--brand))]">{value.toFixed(config.step < 1 ? 1 : 0)}{config.unit}</span>
      </span>
      <input
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-[rgb(var(--brand))]"
      />
      <span className="mt-1 block text-xs text-[rgb(var(--text-muted))]">{config.hint}</span>
    </label>
  )
}

export default function PidControllerPage() {
  const [params, setParams] = useState<PendulumParams>(DEFAULT_PENDULUM_PARAMS)
  const [simTime, setSimTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showPlant, setShowPlant] = useState(false)
  const chartRef = useRef<HTMLCanvasElement | null>(null)
  const trajectory = useMemo(() => simulateInvertedPendulum(params), [params])
  const metrics = useMemo(() => calculateResponseMetrics(trajectory, params.referenceDeg), [trajectory, params.referenceDeg])
  const currentIndex = clamp(Math.floor(simTime / SIM_DT), 0, trajectory.length - 1)
  const current = trajectory[currentIndex] ?? trajectory[0]

  const restart = useCallback(() => {
    setSimTime(0)
    setIsPlaying(true)
  }, [])

  const updateParam = useCallback((key: keyof PendulumParams, value: number) => {
    setParams((previous) => ({ ...previous, [key]: value }))
    setSimTime(0)
    setIsPlaying(true)
  }, [])

  useEffect(() => {
    if (!isPlaying) return
    let frame = 0
    let previous = performance.now()
    const animate = (now: number) => {
      const elapsed = Math.min((now - previous) / 1000, 0.1)
      previous = now
      setSimTime((time) => {
        const next = time + elapsed
        if (next >= SIM_DURATION) {
          setIsPlaying(false)
          return SIM_DURATION
        }
        return next
      })
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying])

  useEffect(() => {
    const canvas = chartRef.current
    if (!canvas) return
    const context = canvas.getContext("2d")
    if (!context) return
    const { width, height, dpr } = ensureCanvasSize(canvas)
    const left = 48 * dpr
    const right = width - 16 * dpr
    const top = 18 * dpr
    const bottom = height - 34 * dpr
    const visible = trajectory.slice(0, currentIndex + 1)
    const angleLimit = Math.max(20, Math.abs(params.referenceDeg) * 1.7, ...visible.map((point) => Math.abs(point.angle)))
    const yLimit = Math.min(90, angleLimit)
    const xMap = (time: number) => left + (time / SIM_DURATION) * (right - left)
    const yMap = (angle: number) => bottom - ((angle + yLimit) / (2 * yLimit)) * (bottom - top)

    context.fillStyle = "rgb(11, 16, 23)"
    context.fillRect(0, 0, width, height)
    context.strokeStyle = "rgba(34, 48, 66, 0.72)"
    context.lineWidth = dpr
    for (let index = 0; index <= 6; index += 1) {
      const x = left + ((right - left) * index) / 6
      context.beginPath(); context.moveTo(x, top); context.lineTo(x, bottom); context.stroke()
    }
    for (let index = 0; index <= 4; index += 1) {
      const y = top + ((bottom - top) * index) / 4
      context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke()
    }

    context.strokeStyle = "rgba(120, 210, 170, 0.9)"
    context.setLineDash([6 * dpr, 5 * dpr])
    context.lineWidth = 1.5 * dpr
    context.beginPath()
    trajectory.forEach((point, index) => index === 0 ? context.moveTo(xMap(point.t), yMap(point.reference)) : context.lineTo(xMap(point.t), yMap(point.reference)))
    context.stroke()
    context.setLineDash([])

    if (visible.length > 0) {
      context.strokeStyle = "rgb(212, 163, 115)"
      context.lineWidth = 2.5 * dpr
      context.beginPath()
      visible.forEach((point, index) => index === 0 ? context.moveTo(xMap(point.t), yMap(point.angle)) : context.lineTo(xMap(point.t), yMap(point.angle)))
      context.stroke()
    }

    context.fillStyle = "rgb(180, 189, 200)"
    context.font = `${11 * dpr}px Inter, sans-serif`
    context.fillText(`${yLimit.toFixed(0)}°`, 8 * dpr, top + 4 * dpr)
    context.fillText(`-${yLimit.toFixed(0)}°`, 5 * dpr, bottom)
    context.fillText("0°", 20 * dpr, yMap(0) + 4 * dpr)
    context.fillText("time (s)", right - 42 * dpr, height - 10 * dpr)
  }, [currentIndex, params.referenceDeg, trajectory])

  const togglePlayback = () => {
    if (simTime >= SIM_DURATION) return restart()
    setIsPlaying((playing) => !playing)
  }

  const angle = current?.angle ?? 0
  const pendulumRotation = clamp(angle, -100, 100)
  const status = current?.fallen ? "Fallen" : Math.abs((current?.reference ?? 0) - angle) < 0.5 ? "Tracking" : "Correcting"

  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6 md:py-10">
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-[rgb(var(--text-muted))] transition-colors hover:text-[rgb(var(--text))]">
          <ArrowLeft className="h-4 w-4" /> Back to Tools
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--brand))]">Control systems lab</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Inverted Pendulum PID</h1>
            <p className="mt-2 max-w-2xl text-[rgb(var(--text-muted))]">Tune the controller, command a new angle, and see how the unstable plant responds.</p>
          </div>
          <div className={`rounded-full border px-4 py-2 text-sm ${current?.fallen ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-muted))]"}`}>
            {status} · <span className="font-mono text-[rgb(var(--text))]">t = {current?.t.toFixed(2)} s</span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <article className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.72)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--border))] px-4 py-3">
              <div>
                <h2 className="font-semibold">Live plant</h2>
                <p className="text-xs text-[rgb(var(--text-muted))]">Angle is measured from the unstable upright position.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={togglePlayback} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[rgb(var(--brand))] px-4 text-sm font-semibold text-[rgb(var(--bg))] transition-colors hover:bg-[rgb(var(--brand-strong))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]">
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {isPlaying ? "Pause" : simTime >= SIM_DURATION ? "Replay" : "Play"}
                </button>
                <button type="button" onClick={restart} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-4 text-sm transition-colors hover:border-[rgb(var(--brand)_/_0.45)]">
                  <RotateCcw className="h-4 w-4" /> Reset model
                </button>
              </div>
            </div>

            <div className="grid min-h-[340px] md:grid-cols-[0.8fr_1.2fr]">
              <div className="relative flex items-center justify-center border-b border-[rgb(var(--border))] bg-gradient-to-b from-[rgb(var(--surface-2)_/_0.4)] to-transparent p-6 md:border-b-0 md:border-r">
                <div className="absolute left-4 top-4 space-y-1 text-xs text-[rgb(var(--text-muted))]">
                  <p>Angle <span className="font-mono text-[rgb(var(--text))]">{angle.toFixed(2)}°</span></p>
                  <p>Reference <span className="font-mono text-emerald-300">{current?.reference.toFixed(1)}°</span></p>
                  <p>Torque <span className="font-mono text-[rgb(var(--text))]">{current?.torque.toFixed(2)} N·m</span></p>
                </div>
                <div className="relative mt-10 h-56 w-56">
                  <div className="absolute bottom-5 left-1/2 h-1 w-44 -translate-x-1/2 rounded-full bg-[rgb(var(--border))]" />
                  <div className="absolute bottom-5 left-1/2 h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded-full border-4 border-[rgb(var(--brand))] bg-[rgb(var(--surface))]" />
                  <div className="absolute bottom-7 left-1/2 h-40 w-2 origin-bottom -translate-x-1/2 rounded-full bg-gradient-to-t from-[rgb(var(--brand-strong))] to-[rgb(var(--brand))] transition-transform duration-75" style={{ transform: `translateX(-50%) rotate(${pendulumRotation}deg)` }}>
                    <div className="absolute -left-4 -top-5 h-10 w-10 rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak))] shadow-[0_0_24px_rgba(212,163,115,0.18)]" />
                  </div>
                  <div className="absolute bottom-4 left-1/2 h-44 w-px -translate-x-1/2 border-l border-dashed border-emerald-400/35" />
                </div>
              </div>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Angle response</h2>
                  <div className="flex gap-3 text-xs text-[rgb(var(--text-muted))]"><span><i className="mr-1 inline-block h-0.5 w-4 bg-[rgb(var(--brand))] align-middle" />Angle</span><span><i className="mr-1 inline-block h-0.5 w-4 bg-emerald-400 align-middle" />Reference</span></div>
                </div>
                <canvas ref={chartRef} className="h-64 w-full rounded-xl border border-[rgb(var(--border))]" aria-label="Pendulum angle response chart" />
              </div>
            </div>
          </article>

          <aside className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.72)] p-4">
            <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[rgb(var(--brand))]" /><h2 className="font-semibold">Controller gains</h2></div>
            <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">Change one gain at a time and compare the response.</p>
            <div className="mt-4 space-y-3">
              {GAIN_SLIDERS.map((config) => <Slider key={config.key} config={config} value={params[config.key]} onChange={(value) => updateParam(config.key, value)} />)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {PRESETS.map((preset) => <button key={preset.label} type="button" onClick={() => { setParams((previous) => ({ ...previous, ...preset.gains })); restart() }} className="rounded-full border border-[rgb(var(--border))] px-3 py-1.5 text-xs text-[rgb(var(--text-muted))] transition-colors hover:border-[rgb(var(--brand)_/_0.5)] hover:text-[rgb(var(--text))]">{preset.label}</button>)}
            </div>
          </aside>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Result", metrics.fallen ? "Fell over" : "Stayed upright"],
            ["Overshoot", metrics.fallen ? "—" : `${metrics.overshoot.toFixed(1)}%`],
            ["Settling time", metrics.fallen ? "—" : metrics.settlingTime === null ? "> 11 s" : `${metrics.settlingTime.toFixed(2)} s`],
            ["Final error", metrics.fallen ? "—" : `${metrics.steadyStateError.toFixed(2)}°`],
          ].map(([label, value]) => <article key={label} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.62)] p-4"><p className="text-xs uppercase tracking-[0.12em] text-[rgb(var(--text-muted))]">{label}</p><p className="mt-2 font-mono text-xl">{value}</p></article>)}
        </section>

        <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.62)] p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold">Experiment setup</h2><p className="mt-1 text-sm text-[rgb(var(--text-muted))]">The reference steps at {REFERENCE_STEP_TIME} s; a brief disturbance arrives at {DISTURBANCE_TIME} s.</p></div>
            <button type="button" onClick={() => setShowPlant((shown) => !shown)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[rgb(var(--border))] px-4 text-sm transition-colors hover:border-[rgb(var(--brand)_/_0.5)]"><Gauge className="h-4 w-4" />{showPlant ? "Hide plant settings" : "Show plant settings"}</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {SCENARIO_SLIDERS.map((config) => <Slider key={config.key} config={config} value={params[config.key]} onChange={(value) => updateParam(config.key, value)} />)}
          </div>
          {showPlant && <div className="mt-3 grid gap-3 border-t border-[rgb(var(--border))] pt-4 md:grid-cols-3">{PLANT_SLIDERS.map((config) => <Slider key={config.key} config={config} value={params[config.key]} onChange={(value) => updateParam(config.key, value)} />)}</div>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.35)] p-4 text-sm text-[rgb(var(--text-muted))]">
            <p><Zap className="mr-2 inline h-4 w-4 text-[rgb(var(--brand))]" /><span className="text-[rgb(var(--text))]">Try this:</span> choose “P only,” then add Kd until the oscillation settles. Add Ki last to remove offset.</p>
            <button type="button" onClick={() => { setParams(DEFAULT_PENDULUM_PARAMS); restart() }} className="text-[rgb(var(--brand))] underline-offset-4 hover:underline">Restore defaults</button>
          </div>
        </section>

        <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.45)] p-5">
          <h2 className="font-semibold">What the simulation is doing</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[rgb(var(--text-muted))]">This is a nonlinear, torque-actuated inverted pendulum integrated with RK4 at 120 Hz. Gravity pushes it away from upright; the PID controller applies bounded torque using angle error, accumulated error, and angular velocity. Actuator saturation includes basic integral anti-windup.</p>
          <p className="mt-3 font-mono text-sm text-[rgb(var(--text))]">u = Kp·e + Ki·∫e dt − Kd·θ̇</p>
        </section>
      </div>
    </main>
  )
}
