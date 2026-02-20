"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown, ChevronUp, Clock3, Plus, Trash2, User } from "lucide-react"

type Gender = "male" | "female"
type DrinkType = "Beer" | "Wine" | "Shot" | "Strong Beer" | "Custom"

type BacProfile = {
  weightLbs: number
  gender: Gender
}

type Drink = {
  id: string
  timestamp: string
  drinkType: DrinkType
  alcoholOz: number
}

const PROFILE_STORAGE_KEY = "bac_profile"
const SESSION_STORAGE_KEY = "bac_session"

const DRINK_PRESETS: Array<{ drinkType: Exclude<DrinkType, "Custom">; alcoholOz: number; note: string }> = [
  { drinkType: "Beer", alcoholOz: 0.6, note: "12oz at 5% ABV" },
  { drinkType: "Wine", alcoholOz: 0.6, note: "5oz at 12% ABV" },
  { drinkType: "Shot", alcoholOz: 0.6, note: "1.5oz at 40% ABV" },
  { drinkType: "Strong Beer", alcoholOz: 0.96, note: "12oz at 8% ABV" },
]

function isValidGender(value: unknown): value is Gender {
  return value === "male" || value === "female"
}

function isValidDrinkType(value: unknown): value is DrinkType {
  return value === "Beer" || value === "Wine" || value === "Shot" || value === "Strong Beer" || value === "Custom"
}

function parseStoredProfile(value: string | null): BacProfile | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<BacProfile>
    if (typeof parsed.weightLbs !== "number" || parsed.weightLbs <= 0 || !isValidGender(parsed.gender)) {
      return null
    }
    return { weightLbs: parsed.weightLbs, gender: parsed.gender }
  } catch {
    return null
  }
}

function parseStoredSession(value: string | null): Drink[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is Drink => {
        return (
          item &&
          typeof item.id === "string" &&
          typeof item.timestamp === "string" &&
          isValidDrinkType(item.drinkType) &&
          typeof item.alcoholOz === "number" &&
          item.alcoholOz > 0
        )
      })
      .map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        drinkType: item.drinkType as DrinkType,
        alcoholOz: item.alcoholOz,
      }))
  } catch {
    return []
  }
}

function widmarkR(gender: Gender): number {
  return gender === "male" ? 0.73 : 0.66
}

function drinkContribution(drink: Drink, profile: BacProfile, currentMs: number): number {
  const alcoholGrams = drink.alcoholOz * 23.36
  const peakBacDrink = alcoholGrams / (profile.weightLbs * 0.453592 * widmarkR(profile.gender) * 10)
  const drinkMs = new Date(drink.timestamp).getTime()
  const hoursSinceDrink = Math.max(0, (currentMs - drinkMs) / 3600000)
  return Math.max(0, peakBacDrink - 0.015 * hoursSinceDrink)
}

function totalBacAtTime(drinks: Drink[], profile: BacProfile | null, currentMs: number): number {
  if (!profile) return 0
  return drinks.reduce((sum, drink) => sum + drinkContribution(drink, profile, currentMs), 0)
}

function estimateMinutesUntilSober(drinks: Drink[], profile: BacProfile | null, currentMs: number): number | null {
  const currentBac = totalBacAtTime(drinks, profile, currentMs)
  if (currentBac <= 0) return 0

  const stepMs = 5 * 60 * 1000
  const maxSteps = (72 * 60) / 5

  for (let step = 1; step <= maxSteps; step += 1) {
    const bac = totalBacAtTime(drinks, profile, currentMs + step * stepMs)
    if (bac <= 0) {
      return step * 5
    }
  }

  return null
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "Over 72 hours"
  if (minutes <= 0) return "Sober now"

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function bacColorClasses(bac: number): string {
  if (bac < 0.04) return "text-emerald-400 border-emerald-700/50 bg-emerald-950/30"
  if (bac <= 0.08) return "text-yellow-300 border-yellow-700/50 bg-yellow-950/30"
  if (bac <= 0.15) return "text-orange-300 border-orange-700/50 bg-orange-950/30"
  return "text-red-300 border-red-700/50 bg-red-950/30"
}

function formatDrinkTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function createDrink(drinkType: DrinkType, alcoholOz: number): Drink {
  const fallbackId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return {
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : fallbackId,
    timestamp: new Date().toISOString(),
    drinkType,
    alcoholOz,
  }
}

export default function BacPage() {
  const [profile, setProfile] = useState<BacProfile | null>(null)
  const [weightInput, setWeightInput] = useState("")
  const [genderInput, setGenderInput] = useState<Gender>("male")
  const [profileExpanded, setProfileExpanded] = useState(true)
  const [session, setSession] = useState<Drink[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [customAlcoholInput, setCustomAlcoholInput] = useState("")
  const [nowMs, setNowMs] = useState(Date.now())
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    const storedProfile = parseStoredProfile(localStorage.getItem(PROFILE_STORAGE_KEY))
    const storedSession = parseStoredSession(localStorage.getItem(SESSION_STORAGE_KEY))

    if (storedProfile) {
      setProfile(storedProfile)
      setWeightInput(String(storedProfile.weightLbs))
      setGenderInput(storedProfile.gender)
      setProfileExpanded(false)
    }

    setSession(storedSession)
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMs(Date.now())
    }, 30000)

    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  }, [session, isHydrated])

  const currentBac = useMemo(() => totalBacAtTime(session, profile, nowMs), [session, profile, nowMs])
  const minutesUntilSober = useMemo(
    () => estimateMinutesUntilSober(session, profile, nowMs),
    [session, profile, nowMs],
  )

  const orderedDrinks = useMemo(() => {
    return [...session].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [session])

  const handleSaveProfile = () => {
    const weight = Number.parseFloat(weightInput)
    if (!Number.isFinite(weight) || weight <= 0) return

    const nextProfile: BacProfile = {
      weightLbs: weight,
      gender: genderInput,
    }

    setProfile(nextProfile)
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile))
    setProfileExpanded(false)
  }

  const addDrink = (drinkType: DrinkType, alcoholOz: number) => {
    setSession((prev) => [...prev, createDrink(drinkType, alcoholOz)])
    setShowPicker(false)
    setCustomAlcoholInput("")
    setNowMs(Date.now())
  }

  const handleAddCustom = () => {
    const alcoholOz = Number.parseFloat(customAlcoholInput)
    if (!Number.isFinite(alcoholOz) || alcoholOz <= 0) return
    addDrink("Custom", alcoholOz)
  }

  const removeDrink = (id: string) => {
    setSession((prev) => prev.filter((drink) => drink.id !== id))
    setNowMs(Date.now())
  }

  const clearSession = () => {
    setSession([])
    setNowMs(Date.now())
  }

  const isProfileValid = Number.parseFloat(weightInput) > 0

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <Link href="/tools" className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>

        <section className={`rounded-3xl border p-6 ${bacColorClasses(currentBac)}`}>
          <p className="text-sm uppercase tracking-wide text-slate-300">Current BAC</p>
          <p className="text-5xl font-bold mt-2">{currentBac.toFixed(3)}%</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-200">
            <Clock3 className="w-4 h-4" />
            Time until sober: {formatDuration(minutesUntilSober)}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6">
          <div className="w-full flex items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-2">
                <User className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Profile</h2>
                {profile ? (
                  <p className="text-sm text-slate-400">
                    {profile.weightLbs} lbs • {profile.gender === "male" ? "Male" : "Female"}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">Set up profile to start calculating BAC</p>
                )}
              </div>
            </div>
            {profile ? (
              <button
                type="button"
                onClick={() => setProfileExpanded((prev) => !prev)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-300 hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
              >
                {profileExpanded ? "Collapse" : "Edit"}
                {profileExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
            ) : (
              <span className="text-sm text-slate-400">Required</span>
            )}
          </div>

          {profileExpanded && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Weight (lbs)</span>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={weightInput}
                  onChange={(event) => setWeightInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 180"
                />
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm text-slate-300">Gender</legend>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGenderInput("male")}
                    className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                      genderInput === "male"
                        ? "border-indigo-500 bg-indigo-900/40 text-indigo-200"
                        : "border-slate-700 bg-slate-900 text-slate-300"
                    }`}
                  >
                    Male (r=0.73)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenderInput("female")}
                    className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                      genderInput === "female"
                        ? "border-indigo-500 bg-indigo-900/40 text-indigo-200"
                        : "border-slate-700 bg-slate-900 text-slate-300"
                    }`}
                  >
                    Female (r=0.66)
                  </button>
                </div>
              </fieldset>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={!isProfileValid}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save Profile
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6 space-y-5">
          <button
            type="button"
            onClick={() => setShowPicker((prev) => !prev)}
            disabled={!profile}
            className="w-full rounded-2xl bg-indigo-600 px-5 py-4 text-lg font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add a Drink
          </button>

          {showPicker && (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 space-y-3">
              <p className="text-sm text-slate-400">Quick picker</p>
              <div className="grid gap-2 md:grid-cols-2">
                {DRINK_PRESETS.map((preset) => (
                  <button
                    key={preset.drinkType}
                    type="button"
                    onClick={() => addDrink(preset.drinkType, preset.alcoholOz)}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-left hover:bg-slate-800 transition-colors"
                  >
                    <p className="font-medium">{preset.drinkType}</p>
                    <p className="text-sm text-slate-400">{preset.note} • {preset.alcoholOz} oz alcohol</p>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                <p className="font-medium mb-2">Custom</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={customAlcoholInput}
                    onChange={(event) => setCustomAlcoholInput(event.target.value)}
                    placeholder="oz of pure alcohol"
                    className="flex-1 min-w-[160px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustom}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold hover:bg-indigo-500 transition-colors"
                  >
                    Add Custom
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Session Drinks</h2>
              <button
                type="button"
                onClick={clearSession}
                disabled={session.length === 0}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Clear Session
              </button>
            </div>

            {!isHydrated ? (
              <p className="text-slate-400 text-sm">Loading session...</p>
            ) : orderedDrinks.length === 0 ? (
              <p className="text-slate-400 text-sm">No drinks added yet.</p>
            ) : (
              <ul className="space-y-2">
                {orderedDrinks.map((drink) => (
                  <li
                    key={drink.id}
                    className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium">{drink.drinkType}</p>
                      <p className="text-sm text-slate-400">
                        {formatDrinkTime(drink.timestamp)} • {drink.alcoholOz.toFixed(2)} oz alcohol
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDrink(drink.id)}
                      className="rounded-lg border border-red-800/70 bg-red-950/30 p-2 text-red-300 hover:bg-red-900/40 transition-colors"
                      aria-label={`Remove ${drink.drinkType}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
