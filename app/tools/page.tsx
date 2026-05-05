"use client"

import Link from "next/link"
import { type ComponentType, useEffect, useState } from "react"
import { ArrowLeft, Calculator, ChefHat, Dumbbell, FileText, Gauge, Home, Music2, Pill } from "lucide-react"
import { ToolsBackground } from "../components/ToolsBackground"

type ToolCard = {
  href: string
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  requiresPin?: boolean
}

const TOOL_CARDS: ToolCard[] = [
  {
    href: "/tools/work-samples",
    title: "Examples of Work",
    description: "Shared links to PDFs and project writeups",
    icon: FileText,
    requiresPin: false,
  },
  {
    href: "/tools/medication-visualizer",
    title: "Medication Concentration Visualizer",
    description: "Dose timing, concentration/effect, and sleep scoring",
    icon: Pill,
    requiresPin: true,
  },
  {
    href: "/tools/bac",
    title: "BAC Calculator",
    description: "Track your session and estimate BAC",
    icon: Calculator,
    requiresPin: true,
  },
  {
    href: "/tools/meal-prep",
    title: "Meal Prep",
    description: "Weekly meal plan & shopping list",
    icon: ChefHat,
    requiresPin: false,
  },
  {
    href: "/tools/workout",
    title: "Workout Generator",
    description: "Generate and track shoulder-safe sessions",
    icon: Dumbbell,
    requiresPin: false,
  },
  {
    href: "/tools/pd-controller",
    title: "PD Controller Visualizer",
    description: "Tune Kp/Kd and inspect dynamics in real time",
    icon: Gauge,
    requiresPin: false,
  },
  {
    href: "/tools/helical-pitch-visualizer",
    title: "Helical Pitch Visualizer",
    description: "Music, microphone, and generated-note pitch visualization",
    icon: Music2,
    requiresPin: false,
  },
]

export default function ToolsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checkedAuth, setCheckedAuth] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/status", { cache: "no-store" })
        const data = (await response.json()) as { authenticated?: boolean }
        setIsAuthenticated(response.ok && Boolean(data.authenticated))
      } catch {
        setIsAuthenticated(false)
      } finally {
        setCheckedAuth(true)
      }
    }

    void checkAuth()
  }, [])

  const visibleCards = TOOL_CARDS.filter((tool) => !tool.requiresPin || isAuthenticated)

  return (
    <main className="relative min-h-screen overflow-hidden bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <ToolsBackground />
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2)_/_0.75)]"
          >
            <Home className="w-3.5 h-3.5" /> Home
          </Link>
        </div>

        <header className="mt-6 mb-8 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-6 backdrop-blur-[1px]">
          <h1 className="text-4xl font-bold">Tools</h1>
          <p className="text-[rgb(var(--text-muted))] mt-2">Utilities and calculators (quick daily workflows)</p>
        </header>

        {checkedAuth && !isAuthenticated && (
          <p className="mb-4 text-sm text-[rgb(var(--text-muted))]">Private tools are hidden until PIN sign-in.</p>
        )}

        {checkedAuth && (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleCards.map((tool) => {
              const Icon = tool.icon
              const singlePublicCard = visibleCards.length === 1
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`group rounded-2xl border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--surface)_/_0.7)] to-[rgb(var(--surface-2)_/_0.65)] p-5 hover:border-[rgb(var(--brand)_/_0.4)] transition-colors ${singlePublicCard ? "md:col-span-2 md:max-w-2xl md:mx-auto w-full" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.8)] p-2">
                      <Icon className="w-5 h-5 text-[rgb(var(--brand))]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{tool.title}</h2>
                      <p className="text-sm text-[rgb(var(--text-muted))]">{tool.description}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
