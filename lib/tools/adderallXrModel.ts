export type AdderallModelInput = {
  days: number
  dtMinutes: number
  doseMg: number
  firstDoseHour: number
  secondDoseHour: number
  vitaminCEnabled: boolean
  vitaminCHour: number // 16..28 (4 PM to 4 AM next day)
  vitaminCDoseGrams?: number // 0..2
  vitaminCIntensity?: number // backward-compat fallback 0..1
  wakeHour: number // 4..12
  bedHour: number // 20..28
  workStartHour?: number // 6..26
  workEndHour?: number // 6..26
  homeworkStartHour?: number // 6..26
  homeworkEndHour?: number // 6..26
}

export type SimPoint = {
  tHours: number // relative to day start, 0..31 in UI window
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
    workScore: number
    homeworkScore: number
    sleepScore: number // lower is better (mean effect during sleep window)
    concentrationPeak: number
    effectPeak: number
    baselineMidnightConcentration: number
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
const ACID_HALF_LIFE_HOURS = 7.0 // approximate acidic-urine lower bound for amphetamine half-life
const APPARENT_VD_L = 190
const KE0 = 0.55
const EMAX = 100
const EC50 = 0.03
const HILL = 1.6

const BASELINE_DOSE_MG = 10
const BASELINE_FIRST_DOSE_HOUR = 8
const BASELINE_SECOND_DOSE_HOUR = 12

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeRange(start: number, end: number): { start: number; end: number } {
  if (end <= start) return { start, end: end + 24 }
  return { start, end }
}

function averageEffectBetween(points: SimPoint[], startHour: number, endHour: number) {
  if (endHour <= startHour) return 0
  const selected = points.filter((p) => p.tHours >= startHour && p.tHours < endHour)
  if (selected.length === 0) return 0
  return selected.reduce((acc, p) => acc + p.effect, 0) / selected.length
}

function vitaminCEliminationMultiplier(
  relHours: number,
  enabled: boolean,
  vitaminCHour: number,
  vitaminCDoseGrams: number,
): number {
  if (!enabled) return 1

  const doseFactor = clamp(vitaminCDoseGrams / 2, 0, 1)
  if (doseFactor <= 0) return 1

  const sigmaHours = 2.2
  const distance = relHours - vitaminCHour
  const bump = Math.exp(-(distance * distance) / (2 * sigmaHours * sigmaHours))

  const maxMultiplier = BASE_HALF_LIFE_HOURS / ACID_HALF_LIFE_HOURS // ~1.64
  return 1 + (maxMultiplier - 1) * doseFactor * bump
}

function scheduleDoseForDay(events: Map<number, Array<{ amountMg: number; ka: number }>>, day: number, doseMg: number, firstDoseHour: number, secondDoseHour: number) {
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

export function simulateAdderallXR(input: AdderallModelInput): AdderallModelResult {
  const dtHours = clamp(input.dtMinutes, 2, 30) / 60

  const wakeHour = clamp(input.wakeHour, 4, 12)
  const bedHour = clamp(input.bedHour, 20, 28)

  const firstDoseHour = clamp(input.firstDoseHour, wakeHour, 22)
  const secondDoseHour = clamp(input.secondDoseHour, firstDoseHour + 1, 24)
  const doseMg = clamp(input.doseMg, 2.5, 40)

  const vitaminCHour = clamp(input.vitaminCHour, 16, 28)
  const vitaminCDoseGrams = clamp(
    input.vitaminCDoseGrams ?? (input.vitaminCIntensity ?? 0) * 2,
    0,
    2,
  )

  const workStartHour = clamp(input.workStartHour ?? 9, 6, 26)
  const workEndHour = clamp(input.workEndHour ?? 17, 6, 26)
  const homeworkStartHour = clamp(input.homeworkStartHour ?? 19, 6, 26)
  const homeworkEndHour = clamp(input.homeworkEndHour ?? 22, 6, 26)

  const analysisDayIndex = PRE_ROLL_DAYS + 1
  const analysisStartAbs = analysisDayIndex * 24
  const displayStartAbs = analysisStartAbs
  const displayEndAbs = analysisStartAbs + 31 // one-day view + into next morning

  const totalDays = PRE_ROLL_DAYS + 3
  const totalHours = totalDays * 24
  const steps = Math.floor(totalHours / dtHours)

  const eventSchedule = new Map<number, Array<{ amountMg: number; ka: number }>>()

  for (let day = 0; day < totalDays; day += 1) {
    if (day < analysisDayIndex) {
      scheduleDoseForDay(eventSchedule, day, BASELINE_DOSE_MG, BASELINE_FIRST_DOSE_HOUR, BASELINE_SECOND_DOSE_HOUR)
      continue
    }

    if (day === analysisDayIndex) {
      scheduleDoseForDay(eventSchedule, day, doseMg, firstDoseHour, secondDoseHour)
    }
  }

  const compartments: AbsorptionCompartment[] = []
  const baseKel = Math.log(2) / BASE_HALF_LIFE_HOURS

  let centralAmountMg = 0
  let effectSite = 0

  const allPoints: SimPoint[] = []
  let baselineMidnightConcentration = 0

  for (let i = 0; i <= steps; i += 1) {
    const tAbs = i * dtHours
    const eventKey = Math.round(tAbs * 60)

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

    const relHours = tAbs - analysisStartAbs
    const kelMultiplier = vitaminCEliminationMultiplier(relHours, input.vitaminCEnabled, vitaminCHour, vitaminCDoseGrams)
    const kel = baseKel * kelMultiplier
    centralAmountMg *= Math.exp(-kel * dtHours)

    const concentration = Math.max(0, centralAmountMg / APPARENT_VD_L)

    if (Math.abs(relHours) < dtHours / 2) {
      baselineMidnightConcentration = concentration
    }

    effectSite += KE0 * (concentration - effectSite) * dtHours
    effectSite = Math.max(0, effectSite)

    const numerator = Math.pow(effectSite, HILL)
    const denominator = Math.pow(EC50, HILL) + numerator
    const effect = denominator > 0 ? (EMAX * numerator) / denominator : 0

    if (tAbs >= displayStartAbs && tAbs <= displayEndAbs) {
      allPoints.push({
        tHours: tAbs - analysisStartAbs,
        concentration,
        effectSite,
        effect,
      })
    }
  }

  const points = allPoints

  const sleepEnd = wakeHour + 24
  const sleepEffectMean = averageEffectBetween(points, bedHour, sleepEnd)

  const workRange = normalizeRange(workStartHour, workEndHour)
  const homeworkRange = normalizeRange(homeworkStartHour, homeworkEndHour)

  const workEffectMean = averageEffectBetween(points, workRange.start, workRange.end)
  const homeworkEffectMean = averageEffectBetween(points, homeworkRange.start, homeworkRange.end)

  return {
    points,
    dayScores: [],
    summary: {
      workScore: workEffectMean,
      homeworkScore: homeworkEffectMean,
      sleepScore: sleepEffectMean,
      concentrationPeak: Math.max(...points.map((p) => p.concentration), 0),
      effectPeak: Math.max(...points.map((p) => p.effect), 0),
      baselineMidnightConcentration,
    },
  }
}
