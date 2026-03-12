"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Gauge, Pause, Play, RotateCcw, Share2 } from "lucide-react"

type SimParams = {
  kp: number
  kd: number
  mass: number
  target: number
  x0: number
  v0: number
}

type StatePoint = {
  t: number
  x: number
  v: number
}

const DURATION_SECONDS = 12
const DT = 1 / 120
const DEFAULT_PARAMS: SimParams = {
  kp: 14,
  kd: 8,
  mass: 1,
  target: 1,
  x0: -0.4,
  v0: 0,
}

function parseQueryParams(): SimParams {
  if (typeof window === "undefined") return DEFAULT_PARAMS

  const search = new URLSearchParams(window.location.search)

  const read = (key: keyof SimParams, fallback: number, min: number, max: number) => {
    const raw = search.get(key)
    if (!raw) return fallback
    const next = Number.parseFloat(raw)
    if (!Number.isFinite(next)) return fallback
    return Math.max(min, Math.min(max, next))
  }

  return {
    kp: read("kp", DEFAULT_PARAMS.kp, 0, 80),
    kd: read("kd", DEFAULT_PARAMS.kd, 0, 50),
    mass: read("mass", DEFAULT_PARAMS.mass, 0.1, 8),
    target: read("target", DEFAULT_PARAMS.target, -3, 3),
    x0: read("x0", DEFAULT_PARAMS.x0, -3, 3),
    v0: read("v0", DEFAULT_PARAMS.v0, -6, 6),
  }
}

function acceleration(x: number, v: number, p: SimParams) {
  return (p.kp * (p.target - x) - p.kd * v) / p.mass
}

function simulate(p: SimParams): StatePoint[] {
  const points: StatePoint[] = []
  let x = p.x0
  let v = p.v0
  const steps = Math.floor(DURATION_SECONDS / DT)

  for (let i = 0; i <= steps; i += 1) {
    const t = i * DT
    points.push({ t, x, v })

    const k1x = v
    const k1v = acceleration(x, v, p)

    const k2x = v + 0.5 * DT * k1v
    const k2v = acceleration(x + 0.5 * DT * k1x, v + 0.5 * DT * k1v, p)

    const k3x = v + 0.5 * DT * k2v
    const k3v = acceleration(x + 0.5 * DT * k2x, v + 0.5 * DT * k2v, p)

    const k4x = v + DT * k3v
    const k4v = acceleration(x + DT * k3x, v + DT * k3v, p)

    x += (DT / 6) * (k1x + 2 * k2x + 2 * k3x + k4x)
    v += (DT / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)
  }

  return points
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function ensureCanvasSize(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1
  const width = Math.floor(canvas.clientWidth * dpr)
  const height = Math.floor(canvas.clientHeight * dpr)

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  return { width, height }
}

function drawCardBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = "rgb(11, 16, 23)"
  ctx.fillRect(0, 0, width, height)
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
) {
  ctx.strokeStyle = "rgba(34, 48, 66, 0.65)"
  ctx.lineWidth = 1

  for (let i = 0; i <= 5; i += 1) {
    const x = left + ((right - left) * i) / 5
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.stroke()
  }

  for (let i = 0; i <= 4; i += 1) {
    const y = top + ((bottom - top) * i) / 4
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }
}

export default function PdControllerPage() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS)
  const [isPlaying, setIsPlaying] = useState(true)
  const [simTime, setSimTime] = useState(0)
  const [copied, setCopied] = useState(false)
  const initialized = useRef(false)

  const responseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const phaseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fieldCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    setParams(parseQueryParams())
  }, [])

  const trajectory = useMemo(() => simulate(params), [params])

  const currentIndex = clamp(Math.floor(simTime / DT), 0, trajectory.length - 1)
  const currentState = trajectory[currentIndex] ?? trajectory[trajectory.length - 1]

  const updateParam = useCallback((key: keyof SimParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }, [])

  useEffect(() => {
    setSimTime(0)
    setIsPlaying(true)
  }, [params])

  useEffect(() => {
    const q = new URLSearchParams()
    q.set("kp", params.kp.toFixed(2))
    q.set("kd", params.kd.toFixed(2))
    q.set("mass", params.mass.toFixed(2))
    q.set("target", params.target.toFixed(2))
    q.set("x0", params.x0.toFixed(2))
    q.set("v0", params.v0.toFixed(2))
    window.history.replaceState({}, "", `${window.location.pathname}?${q.toString()}`)
  }, [params])

  useEffect(() => {
    if (!isPlaying) return

    let raf = 0
    let lastTime = performance.now()

    const tick = (now: number) => {
      const elapsed = (now - lastTime) / 1000
      lastTime = now

      setSimTime((prev) => {
        const next = prev + elapsed
        if (next >= DURATION_SECONDS) {
          setIsPlaying(false)
          return DURATION_SECONDS
        }
        return next
      })

      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [isPlaying])

  useEffect(() => {
    const responseCanvas = responseCanvasRef.current
    const phaseCanvas = phaseCanvasRef.current
    const fieldCanvas = fieldCanvasRef.current
    if (!responseCanvas || !phaseCanvas || !fieldCanvas) return

    const responseCtx = responseCanvas.getContext("2d")
    const phaseCtx = phaseCanvas.getContext("2d")
    const fieldCtx = fieldCanvas.getContext("2d")
    if (!responseCtx || !phaseCtx || !fieldCtx) return

    const drawResponse = () => {
      const { width, height } = ensureCanvasSize(responseCanvas)
      drawCardBackground(responseCtx, width, height)

      const left = 64
      const right = width - 24
      const top = 20
      const bottom = height - 40
      drawGrid(responseCtx, width, height, left, right, top, bottom)

      const xs = trajectory.map((p) => p.x)
      const rawMin = Math.min(...xs, params.target)
      const rawMax = Math.max(...xs, params.target)
      const span = Math.max(0.5, rawMax - rawMin)
      const yMin = rawMin - span * 0.2
      const yMax = rawMax + span * 0.2

      const mapX = (t: number) => left + (t / DURATION_SECONDS) * (right - left)
      const mapY = (x: number) => bottom - ((x - yMin) / (yMax - yMin)) * (bottom - top)

      responseCtx.strokeStyle = "rgba(180, 189, 200, 0.4)"
      responseCtx.lineWidth = 2
      responseCtx.beginPath()
      responseCtx.moveTo(mapX(0), mapY(trajectory[0]?.x ?? 0))
      trajectory.forEach((p) => {
        responseCtx.lineTo(mapX(p.t), mapY(p.x))
      })
      responseCtx.stroke()

      responseCtx.strokeStyle = "rgb(212, 163, 115)"
      responseCtx.lineWidth = 3
      responseCtx.beginPath()
      responseCtx.moveTo(mapX(0), mapY(trajectory[0]?.x ?? 0))
      for (let i = 1; i <= currentIndex; i += 1) {
        const p = trajectory[i]
        responseCtx.lineTo(mapX(p.t), mapY(p.x))
      }
      responseCtx.stroke()

      responseCtx.strokeStyle = "rgba(120, 210, 170, 0.9)"
      responseCtx.lineWidth = 1.5
      responseCtx.setLineDash([6, 6])
      responseCtx.beginPath()
      responseCtx.moveTo(left, mapY(params.target))
      responseCtx.lineTo(right, mapY(params.target))
      responseCtx.stroke()
      responseCtx.setLineDash([])

      responseCtx.fillStyle = "rgb(233, 236, 239)"
      responseCtx.font = "12px Inter, sans-serif"
      responseCtx.fillText("Position", 12, top + 2)
      responseCtx.fillText("Time (s)", right - 58, height - 12)
      responseCtx.fillStyle = "rgba(120, 210, 170, 0.9)"
      responseCtx.fillText("target", right - 48, mapY(params.target) - 8)

      responseCtx.fillStyle = "rgb(212, 163, 115)"
      responseCtx.beginPath()
      responseCtx.arc(mapX(currentState.t), mapY(currentState.x), 4.5, 0, Math.PI * 2)
      responseCtx.fill()
    }

    const drawPhase = () => {
      const { width, height } = ensureCanvasSize(phaseCanvas)
      drawCardBackground(phaseCtx, width, height)

      const left = 54
      const right = width - 22
      const top = 20
      const bottom = height - 40
      drawGrid(phaseCtx, width, height, left, right, top, bottom)

      const xs = trajectory.map((p) => p.x)
      const vs = trajectory.map((p) => p.v)
      const xMin = Math.min(...xs, params.target) - 0.3
      const xMax = Math.max(...xs, params.target) + 0.3
      const maxAbsV = Math.max(1.2, ...vs.map((n) => Math.abs(n)))
      const vMin = -maxAbsV * 1.2
      const vMax = maxAbsV * 1.2

      const mapX = (x: number) => left + ((x - xMin) / (xMax - xMin)) * (right - left)
      const mapY = (v: number) => bottom - ((v - vMin) / (vMax - vMin)) * (bottom - top)

      phaseCtx.strokeStyle = "rgba(180, 189, 200, 0.35)"
      phaseCtx.lineWidth = 2
      phaseCtx.beginPath()
      phaseCtx.moveTo(mapX(trajectory[0]?.x ?? 0), mapY(trajectory[0]?.v ?? 0))
      trajectory.forEach((p) => phaseCtx.lineTo(mapX(p.x), mapY(p.v)))
      phaseCtx.stroke()

      phaseCtx.strokeStyle = "rgb(212, 163, 115)"
      phaseCtx.lineWidth = 3
      phaseCtx.beginPath()
      phaseCtx.moveTo(mapX(trajectory[0]?.x ?? 0), mapY(trajectory[0]?.v ?? 0))
      for (let i = 1; i <= currentIndex; i += 1) {
        const p = trajectory[i]
        phaseCtx.lineTo(mapX(p.x), mapY(p.v))
      }
      phaseCtx.stroke()

      phaseCtx.strokeStyle = "rgba(120, 210, 170, 0.7)"
      phaseCtx.lineWidth = 1.5
      phaseCtx.setLineDash([6, 5])
      phaseCtx.beginPath()
      phaseCtx.moveTo(mapX(params.target), top)
      phaseCtx.lineTo(mapX(params.target), bottom)
      phaseCtx.stroke()
      phaseCtx.setLineDash([])

      phaseCtx.fillStyle = "rgb(233, 236, 239)"
      phaseCtx.font = "12px Inter, sans-serif"
      phaseCtx.fillText("v", 18, top + 4)
      phaseCtx.fillText("x", right - 10, height - 12)

      phaseCtx.fillStyle = "rgb(212, 163, 115)"
      phaseCtx.beginPath()
      phaseCtx.arc(mapX(currentState.x), mapY(currentState.v), 4.5, 0, Math.PI * 2)
      phaseCtx.fill()
    }

    const drawVectorField = () => {
      const { width, height } = ensureCanvasSize(fieldCanvas)
      drawCardBackground(fieldCtx, width, height)

      const left = 54
      const right = width - 24
      const top = 20
      const bottom = height - 40
      drawGrid(fieldCtx, width, height, left, right, top, bottom)

      const xs = trajectory.map((p) => p.x)
      const vs = trajectory.map((p) => p.v)
      const xMin = Math.min(...xs, params.target) - 0.5
      const xMax = Math.max(...xs, params.target) + 0.5
      const maxAbsV = Math.max(1.5, ...vs.map((n) => Math.abs(n)))
      const vMin = -maxAbsV * 1.25
      const vMax = maxAbsV * 1.25

      const mapX = (x: number) => left + ((x - xMin) / (xMax - xMin)) * (right - left)
      const mapY = (v: number) => bottom - ((v - vMin) / (vMax - vMin)) * (bottom - top)
      const unmapX = (px: number) => xMin + ((px - left) / (right - left)) * (xMax - xMin)
      const unmapY = (py: number) => vMin + ((bottom - py) / (bottom - top)) * (vMax - vMin)

      const occupied = new Set<string>()
      const key = (px: number, py: number) => `${Math.round(px / 5)}:${Math.round(py / 5)}`
      const isOccupied = (px: number, py: number) => occupied.has(key(px, py))
      const markOccupied = (px: number, py: number) => occupied.add(key(px, py))

      const rk4Step = (x: number, v: number, dt: number) => {
        const k1x = v
        const k1v = acceleration(x, v, params)
        const k2x = v + 0.5 * dt * k1v
        const k2v = acceleration(x + 0.5 * dt * k1x, v + 0.5 * dt * k1v, params)
        const k3x = v + 0.5 * dt * k2v
        const k3v = acceleration(x + 0.5 * dt * k2x, v + 0.5 * dt * k2v, params)
        const k4x = v + dt * k3v
        const k4v = acceleration(x + dt * k3x, v + dt * k3v, params)
        return {
          x: x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x),
          v: v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
        }
      }

      const traceStreamline = (seedX: number, seedV: number, direction: 1 | -1) => {
        const points: { x: number; v: number; px: number; py: number }[] = []
        let x = seedX
        let v = seedV
        const dt = 0.02 * direction
        const maxSteps = 400

        for (let i = 0; i < maxSteps; i++) {
          const px = mapX(x)
          const py = mapY(v)

          if (px < left - 10 || px > right + 10 || py < top - 10 || py > bottom + 10) break
          if (points.length > 10 && isOccupied(px, py)) break

          points.push({ x, v, px, py })
          markOccupied(px, py)

          const next = rk4Step(x, v, dt)
          x = next.x
          v = next.v
        }
        return points
      }

      const drawArrowhead = (px: number, py: number, angle: number, size: number) => {
        fieldCtx.save()
        fieldCtx.translate(px, py)
        fieldCtx.rotate(angle)
        fieldCtx.beginPath()
        fieldCtx.moveTo(0, 0)
        fieldCtx.lineTo(-size, -size * 0.5)
        fieldCtx.lineTo(-size, size * 0.5)
        fieldCtx.closePath()
        fieldCtx.fillStyle = "rgba(160, 175, 195, 0.85)"
        fieldCtx.fill()
        fieldCtx.restore()
      }

      const seedCols = 10
      const seedRows = 8

      for (let row = 0; row < seedRows; row++) {
        for (let col = 0; col < seedCols; col++) {
          const x = xMin + ((col + 0.5) / seedCols) * (xMax - xMin)
          const v = vMin + ((row + 0.5) / seedRows) * (vMax - vMin)

          const forward = traceStreamline(x, v, 1)
          const backward = traceStreamline(x, v, -1)

          const fullPath = [...backward.slice(1).reverse(), ...forward]
          if (fullPath.length < 5) continue

          fieldCtx.beginPath()
          fieldCtx.strokeStyle = "rgba(160, 175, 195, 0.55)"
          fieldCtx.lineWidth = 1.2
          fieldCtx.moveTo(fullPath[0].px, fullPath[0].py)
          for (let i = 1; i < fullPath.length; i++) {
            fieldCtx.lineTo(fullPath[i].px, fullPath[i].py)
          }
          fieldCtx.stroke()

          let arcLength = 0
          for (let i = 1; i < fullPath.length; i++) {
            const dx = fullPath[i].px - fullPath[i - 1].px
            const dy = fullPath[i].py - fullPath[i - 1].py
            arcLength += Math.hypot(dx, dy)

            if (arcLength > 60) {
              const prev = fullPath[i - 1]
              const curr = fullPath[i]
              const angle = Math.atan2(curr.py - prev.py, curr.px - prev.px)
              drawArrowhead(curr.px, curr.py, angle, 5)
              arcLength = 0
            }
          }
        }
      }

      fieldCtx.strokeStyle = "rgb(212, 163, 115)"
      fieldCtx.lineWidth = 2.2
      fieldCtx.beginPath()
      fieldCtx.moveTo(mapX(trajectory[0]?.x ?? 0), mapY(trajectory[0]?.v ?? 0))
      for (let i = 1; i <= currentIndex; i += 1) {
        const p = trajectory[i]
        fieldCtx.lineTo(mapX(p.x), mapY(p.v))
      }
      fieldCtx.stroke()

      fieldCtx.fillStyle = "rgb(233, 236, 239)"
      fieldCtx.font = "12px Inter, sans-serif"
      fieldCtx.fillText("Vector field: dx/dt = v, dv/dt = (Kp(target - x) - Kd v)/m", 14, height - 12)
    }

    drawResponse()
    drawPhase()
    drawVectorField()
  }, [trajectory, currentIndex, currentState, params])

  const resetSimulation = () => {
    setSimTime(0)
    setIsPlaying(true)
  }

  const togglePlay = () => {
    if (simTime >= DURATION_SECONDS) {
      setSimTime(0)
      setIsPlaying(true)
      return
    }
    setIsPlaying((prev) => !prev)
  }

  const exportUrl = async () => {
    const fullUrl = window.location.href
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1300)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))] transition-colors hover:text-[rgb(var(--text))]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tools
        </Link>

        <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">PD Controller Visualizer</h1>
            <p className="mt-2 text-[rgb(var(--text-muted))]">Interactive second-order mass system with RK4 integration and live state-space views.</p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] px-4 py-2 text-sm text-[rgb(var(--text-muted))]">
            t = <span className="font-mono text-[rgb(var(--text))]">{currentState.t.toFixed(2)}s</span>
            <span className="mx-2">|</span>
            x = <span className="font-mono text-[rgb(var(--text))]">{currentState.x.toFixed(3)}</span>
            <span className="mx-2">|</span>
            v = <span className="font-mono text-[rgb(var(--text))]">{currentState.v.toFixed(3)}</span>
          </div>
        </header>

        <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.62)] p-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-2">
              <div className="flex items-center justify-between text-sm text-[rgb(var(--text-muted))]">
                <span>Kp (proportional gain)</span>
                <span className="font-mono text-[rgb(var(--text))]">{params.kp.toFixed(2)}</span>
              </div>
              <input type="range" min={0} max={80} step={0.1} value={params.kp} onChange={(e) => updateParam("kp", Number(e.target.value))} className="w-full accent-[rgb(var(--brand))]" />
            </label>

            <label className="space-y-2">
              <div className="flex items-center justify-between text-sm text-[rgb(var(--text-muted))]">
                <span>Kd (derivative gain)</span>
                <span className="font-mono text-[rgb(var(--text))]">{params.kd.toFixed(2)}</span>
              </div>
              <input type="range" min={0} max={50} step={0.1} value={params.kd} onChange={(e) => updateParam("kd", Number(e.target.value))} className="w-full accent-[rgb(var(--brand))]" />
            </label>

            <label className="space-y-2">
              <div className="flex items-center justify-between text-sm text-[rgb(var(--text-muted))]">
                <span>Mass</span>
                <span className="font-mono text-[rgb(var(--text))]">{params.mass.toFixed(2)}</span>
              </div>
              <input type="range" min={0.1} max={8} step={0.05} value={params.mass} onChange={(e) => updateParam("mass", Number(e.target.value))} className="w-full accent-[rgb(var(--brand))]" />
            </label>

            <label className="space-y-2">
              <div className="flex items-center justify-between text-sm text-[rgb(var(--text-muted))]">
                <span>Target position</span>
                <span className="font-mono text-[rgb(var(--text))]">{params.target.toFixed(2)}</span>
              </div>
              <input type="range" min={-3} max={3} step={0.05} value={params.target} onChange={(e) => updateParam("target", Number(e.target.value))} className="w-full accent-[rgb(var(--brand))]" />
            </label>

            <label className="space-y-2">
              <div className="flex items-center justify-between text-sm text-[rgb(var(--text-muted))]">
                <span>Initial position x0</span>
                <span className="font-mono text-[rgb(var(--text))]">{params.x0.toFixed(2)}</span>
              </div>
              <input type="range" min={-3} max={3} step={0.05} value={params.x0} onChange={(e) => updateParam("x0", Number(e.target.value))} className="w-full accent-[rgb(var(--brand))]" />
            </label>

            <label className="space-y-2">
              <div className="flex items-center justify-between text-sm text-[rgb(var(--text-muted))]">
                <span>Initial velocity v0</span>
                <span className="font-mono text-[rgb(var(--text))]">{params.v0.toFixed(2)}</span>
              </div>
              <input type="range" min={-6} max={6} step={0.05} value={params.v0} onChange={(e) => updateParam("v0", Number(e.target.value))} className="w-full accent-[rgb(var(--brand))]" />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.8)] px-4 py-2 text-sm text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--surface-2))]"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              type="button"
              onClick={resetSimulation}
              className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.8)] px-4 py-2 text-sm text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--surface-2))]"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>

            <button
              type="button"
              onClick={exportUrl}
              className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.9)] px-4 py-2 text-sm text-[rgb(var(--brand))] transition-colors hover:bg-[rgb(var(--brand-weak)_/_0.7)]"
            >
              <Share2 className="h-4 w-4" />
              {copied ? "Copied URL" : "Export URL params"}
            </button>

            <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.6)] px-4 py-2 text-sm text-[rgb(var(--text-muted))]">
              <Gauge className="h-4 w-4" />
              Integration: RK4 ({DT.toFixed(4)}s step)
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.58)] p-4">
            <h2 className="mb-3 text-lg font-semibold">Step Response</h2>
            <canvas ref={responseCanvasRef} className="h-72 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.45)]" />
          </article>

          <article className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.58)] p-4">
            <h2 className="mb-3 text-lg font-semibold">Phase Portrait (x vs v)</h2>
            <canvas ref={phaseCanvasRef} className="h-72 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.45)]" />
          </article>

          <article className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.58)] p-4 lg:col-span-2">
            <h2 className="mb-3 text-lg font-semibold">Vector Field</h2>
            <canvas ref={fieldCanvasRef} className="h-80 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.45)]" />
          </article>
        </section>
      </div>
    </main>
  )
}
