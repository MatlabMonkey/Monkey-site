export type AdderallModelInput = {
  days: number
  dtMinutes: number
  doseMg: number
  firstDoseHour: number
  secondDoseHour: number
  vitaminCEnabled: boolean
  vitaminCHour: number
  vitaminCIntensity: number // 0..1
  wakeHour: number // 0..24
  bedHour: number // 20..30 (can cross midnight)
}

export type SimPoint = {
  tHours: number
  day: number
  hourOfDay: number
  concentration: number
  effectSite: number
  effect: number
}

export type DayScore = {
  day: number
  wakeEffectMean: number
  sleepEffectMean: number
  focusScore: number
  sleepScore: number
  compositeScore: number
}

export type AdderallModelResult = {
  points: SimPoint[]
  dayScores: DayScore[]
  summary: {
    wakeEffectMean: number
    sleepEffectMean: number
    focusScore: number
    sleepScore: number
    compositeScore: number
    concentrationPeak: number
    effectPeak: number
  }
}

type AbsorptionCompartment = {
  amountMg: number
  ka: number
}

const PRE_ROLL_DAYS = 14
const XR_SPLIT = 0.5
const XR_DELAY_HOURS = 4
const KA_IMMEDIATE = 1.2
const KA_DELAYED = 0.55
const BASE_HALF_LIFE_HOURS = 11.5
const APPARENT_VD_L = 190
const KE0 = 0.55
const EMAX = 100
const EC50 = 0.03
const HILL = 1.6

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function circHourDistance(a: number, b: number) {
  const diff = Math.abs(a - b)
  return Math.min(diff, 24 - diff)
}

function localHour(tHours: number) {
  const normalized = tHours % 24
  return normalized < 0 ? normalized + 24 : normalized
}

function vitaminCEliminationMultiplier(
  tHours: number,
  enabled: boolean,
  vitaminCHour: number,
  intensity: number,
): number {
  if (!enabled) return 1
  const h = localHour(tHours)
  const sigma = 2.5
  const distance = circHourDistance(h, vitaminCHour)
  const bump = Math.exp(-(distance * distance) / (2 * sigma * sigma))
  return 1 + 0.85 * clamp(intensity, 0, 1) * bump
}

function schedulePulseEvents(daysTotal: number, firstDoseHour: number, secondDoseHour: number, doseMg: number) {
  const events = new Map<number, Array<{ amountMg: number; ka: number }>>()
  for (let day = 0; day < daysTotal; day += 1) {
    const dayStart = day * 24
    const doseTimes = [firstDoseHour, secondDoseHour]

    for (const doseHour of doseTimes) {
      const t1 = dayStart + doseHour
      const t2 = t1 + XR_DELAY_HOURS

      const push = (timeHours: number, amountMg: number, ka: number) => {
        const key = Math.round(timeHours * 60)
        const existing = events.get(key) ?? []
        existing.push({ amountMg, ka })
        events.set(key, existing)
      }

      push(t1, doseMg * XR_SPLIT, KA_IMMEDIATE)
      push(t2, doseMg * XR_SPLIT, KA_DELAYED)
    }
  }

  return events
}

function averageEffectBetween(points: SimPoint[], startHour: number, endHour: number) {
  if (endHour <= startHour) return 0
  const selected = points.filter((p) => p.tHours >= startHour && p.tHours < endHour)
  if (selected.length === 0) return 0
  const sum = selected.reduce((acc, p) => acc + p.effect, 0)
  return sum / selected.length
}

export function simulateAdderallXR(input: AdderallModelInput): AdderallModelResult {
  const days = clamp(Math.round(input.days), 1, 10)
  const dtHours = clamp(input.dtMinutes, 2, 30) / 60

  const totalDays = PRE_ROLL_DAYS + days + 1
  const totalHours = totalDays * 24
  const steps = Math.floor(totalHours / dtHours)

  const firstDoseHour = clamp(input.firstDoseHour, 4, 16)
  const secondDoseHour = clamp(input.secondDoseHour, firstDoseHour + 1, 20)
  const doseMg = clamp(input.doseMg, 2.5, 40)

  const eventSchedule = schedulePulseEvents(totalDays, firstDoseHour, secondDoseHour, doseMg)

  const compartments: AbsorptionCompartment[] = []
  const baseKel = Math.log(2) / BASE_HALF_LIFE_HOURS

  let centralAmountMg = 0
  let effectSite = 0

  const allPoints: SimPoint[] = []

  for (let i = 0; i <= steps; i += 1) {
    const tHours = i * dtHours
    const eventKey = Math.round(tHours * 60)
    const events = eventSchedule.get(eventKey)
    if (events && events.length > 0) {
      for (const event of events) {
        compartments.push({ amountMg: event.amountMg, ka: event.ka })
      }
    }

    let absorbedThisStep = 0
    for (const comp of compartments) {
      if (comp.amountMg <= 1e-9) continue
      const absorbed = Math.min(comp.amountMg, comp.ka * comp.amountMg * dtHours)
      comp.amountMg -= absorbed
      absorbedThisStep += absorbed
    }

    centralAmountMg += absorbedThisStep

    const kelMultiplier = vitaminCEliminationMultiplier(
      tHours,
      input.vitaminCEnabled,
      input.vitaminCHour,
      input.vitaminCIntensity,
    )
    const kel = baseKel * kelMultiplier
    centralAmountMg *= Math.exp(-kel * dtHours)

    const concentration = Math.max(0, centralAmountMg / APPARENT_VD_L)

    effectSite += KE0 * (concentration - effectSite) * dtHours
    effectSite = Math.max(0, effectSite)

    const numerator = Math.pow(effectSite, HILL)
    const denominator = Math.pow(EC50, HILL) + numerator
    const effect = denominator > 0 ? (EMAX * numerator) / denominator : 0

    allPoints.push({
      tHours,
      day: Math.floor(tHours / 24),
      hourOfDay: localHour(tHours),
      concentration,
      effectSite,
      effect,
    })
  }

  const displayStart = PRE_ROLL_DAYS * 24
  const displayEnd = displayStart + days * 24

  const points = allPoints
    .filter((p) => p.tHours >= displayStart && p.tHours <= displayEnd)
    .map((p) => ({ ...p, tHours: p.tHours - displayStart, day: Math.floor((p.tHours - displayStart) / 24) + 1 }))

  const wakeHour = clamp(input.wakeHour, 3, 14)
  const bedHour = clamp(input.bedHour, 20, 30)

  const dayScores: DayScore[] = []
  for (let d = 0; d < days; d += 1) {
    const dayStart = d * 24
    const wakeStart = dayStart + wakeHour
    const wakeEnd = dayStart + bedHour

    const sleepStart = wakeEnd
    const sleepEnd = (d + 1) * 24 + wakeHour

    const wakeEffectMean = averageEffectBetween(points, wakeStart, wakeEnd)
    const sleepEffectMean = averageEffectBetween(points, sleepStart, sleepEnd)

    const focusScore = clamp((wakeEffectMean / 70) * 100, 0, 100)
    const sleepScore = clamp(100 - (sleepEffectMean / 35) * 100, 0, 100)
    const compositeScore = clamp(0.65 * focusScore + 0.35 * sleepScore, 0, 100)

    dayScores.push({
      day: d + 1,
      wakeEffectMean,
      sleepEffectMean,
      focusScore,
      sleepScore,
      compositeScore,
    })
  }

  const safeMean = (values: number[]) => {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  const wakeMeans = dayScores.map((s) => s.wakeEffectMean)
  const sleepMeans = dayScores.map((s) => s.sleepEffectMean)
  const focusScores = dayScores.map((s) => s.focusScore)
  const sleepScores = dayScores.map((s) => s.sleepScore)
  const compositeScores = dayScores.map((s) => s.compositeScore)

  return {
    points,
    dayScores,
    summary: {
      wakeEffectMean: safeMean(wakeMeans),
      sleepEffectMean: safeMean(sleepMeans),
      focusScore: safeMean(focusScores),
      sleepScore: safeMean(sleepScores),
      compositeScore: safeMean(compositeScores),
      concentrationPeak: Math.max(...points.map((p) => p.concentration), 0),
      effectPeak: Math.max(...points.map((p) => p.effect), 0),
    },
  }
}
