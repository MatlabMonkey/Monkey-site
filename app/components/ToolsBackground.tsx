"use client"

import { Check } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

type BackgroundStyle = "none" | "aurora" | "grid" | "particles" | "wave" | "fluid"

const STYLE_OPTIONS: { id: BackgroundStyle; label: string }[] = [
  { id: "none", label: "None" },
  { id: "aurora", label: "Aurora Mist" },
  { id: "grid", label: "Pulse Grid" },
  { id: "particles", label: "Star Drift" },
  { id: "wave", label: "Wave Mesh" },
  { id: "fluid", label: "Fluid Orange/Blue" },
]

const STORAGE_KEY = "tools-bg-style-v1"

export function ToolsBackground() {
  const [style, setStyle] = useState<BackgroundStyle>(() => {
    if (typeof window === "undefined") return "fluid"
    const saved = window.localStorage.getItem(STORAGE_KEY) as BackgroundStyle | null
    if (saved && STYLE_OPTIONS.some((option) => option.id === saved)) return saved
    return "fluid"
  })
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  })

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updateReducedMotion = (event: MediaQueryListEvent) => setReducedMotion(event.matches)
    media.addEventListener("change", updateReducedMotion)
    return () => media.removeEventListener("change", updateReducedMotion)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, style)
  }, [style])

  const showCanvas = !reducedMotion && (style === "particles" || style === "wave" || style === "fluid")

  return (
    <>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {style === "aurora" && <AuroraLayer reducedMotion={reducedMotion} />}
        {style === "grid" && <GridLayer reducedMotion={reducedMotion} />}
        {showCanvas && <CanvasLayer style={style} />}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STYLE_OPTIONS.map((option) => {
          const active = style === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setStyle(option.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-[rgb(var(--brand)_/_0.55)] bg-[rgb(var(--brand-weak)_/_0.85)] text-[rgb(var(--text))]"
                  : "border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
              }`}
              aria-pressed={active}
            >
              {active && <Check className="h-3.5 w-3.5 text-[rgb(var(--brand))]" />}
              {option.label}
            </button>
          )
        })}
      </div>
    </>
  )
}

function AuroraLayer({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="absolute inset-0 opacity-55">
      <div
        className={`absolute -top-28 left-[-12%] h-[24rem] w-[36rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(96,165,250,0.28),rgba(59,130,246,0.07),transparent_70%)] blur-2xl ${
          reducedMotion ? "" : "animate-[floatA_16s_ease-in-out_infinite]"
        }`}
      />
      <div
        className={`absolute top-[35%] right-[-10%] h-[22rem] w-[34rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.22),rgba(249,115,22,0.08),transparent_70%)] blur-2xl ${
          reducedMotion ? "" : "animate-[floatB_20s_ease-in-out_infinite]"
        }`}
      />
      <style jsx>{`
        @keyframes floatA {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(3%,4%,0) scale(1.05); }
        }
        @keyframes floatB {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(-4%,-3%,0) scale(1.07); }
        }
      `}</style>
    </div>
  )
}

function GridLayer({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="absolute inset-0 opacity-35">
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(148,163,184,0.11)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.11)_1px,transparent_1px)] [background-size:40px_40px]" />
      {!reducedMotion && (
        <div className="absolute inset-0 animate-[gridPulse_7s_ease-in-out_infinite] bg-[radial-gradient(circle_at_50%_25%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_60%_75%,rgba(251,146,60,0.12),transparent_40%)]" />
      )}
      <style jsx>{`
        @keyframes gridPulse {
          0%,100% { opacity: 0.15; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}

function CanvasLayer({ style }: { style: BackgroundStyle }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const mode = useMemo(() => style, [style])

  useEffect(() => {
    if (mode !== "particles" && mode !== "wave" && mode !== "fluid") return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    let rafId = 0
    let running = true
    let lastTime = 0
    const fps = 30
    const frameDuration = 1000 / fps
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)

    const resize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const particles = Array.from({ length: 32 }, () => ({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      vx: (Math.random() - 0.5) * 0.24,
      vy: (Math.random() - 0.5) * 0.24,
      r: 1 + Math.random() * 2,
    }))

    const fluidDrops = Array.from({ length: 16 }, (_, i) => ({
      x: (i / 16) * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      vx: 0.12 + Math.random() * 0.35,
      vy: -0.22 + Math.random() * 0.44,
      hue: i % 2 === 0 ? 26 : 213,
      size: 70 + Math.random() * 90,
    }))

    const render = (time: number) => {
      if (!running) return
      if (time - lastTime < frameDuration) {
        rafId = requestAnimationFrame(render)
        return
      }
      lastTime = time

      const width = canvas.clientWidth
      const height = canvas.clientHeight
      ctx.clearRect(0, 0, width, height)

      if (mode === "particles") {
        ctx.fillStyle = "rgba(148,163,184,0.4)"
        for (const p of particles) {
          p.x += p.vx
          p.y += p.vy
          if (p.x < 0) p.x = width
          if (p.x > width) p.x = 0
          if (p.y < 0) p.y = height
          if (p.y > height) p.y = 0
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (mode === "wave") {
        const t = time * 0.00045
        for (let y = 0; y < 5; y++) {
          ctx.beginPath()
          for (let x = 0; x <= width; x += 12) {
            const waveY = height * (0.2 + y * 0.16) + Math.sin(x * 0.012 + t * (1 + y * 0.1)) * (9 + y * 2)
            if (x === 0) ctx.moveTo(x, waveY)
            else ctx.lineTo(x, waveY)
          }
          ctx.strokeStyle = y % 2 === 0 ? "rgba(59,130,246,0.22)" : "rgba(249,115,22,0.18)"
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
      }

      if (mode === "fluid") {
        for (const d of fluidDrops) {
          d.x += d.vx
          d.y += d.vy
          if (d.x > width + d.size) d.x = -d.size
          if (d.x < -d.size) d.x = width + d.size
          if (d.y > height + d.size) d.y = -d.size
          if (d.y < -d.size) d.y = height + d.size

          const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.size)
          g.addColorStop(0, `hsla(${d.hue} 95% 60% / 0.22)`)
          g.addColorStop(1, `hsla(${d.hue} 95% 45% / 0)`)
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.globalCompositeOperation = "screen"
        const shimmer = ctx.createLinearGradient(0, 0, width, height)
        shimmer.addColorStop(0, "rgba(37,99,235,0.05)")
        shimmer.addColorStop(1, "rgba(249,115,22,0.05)")
        ctx.fillStyle = shimmer
        ctx.fillRect(0, 0, width, height)
        ctx.globalCompositeOperation = "source-over"
      }

      rafId = requestAnimationFrame(render)
    }

    const onVisibility = () => {
      running = !document.hidden
      if (running) {
        rafId = requestAnimationFrame(render)
      } else {
        cancelAnimationFrame(rafId)
      }
    }

    document.addEventListener("visibilitychange", onVisibility)
    rafId = requestAnimationFrame(render)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [mode])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-60" aria-hidden="true" />
}
