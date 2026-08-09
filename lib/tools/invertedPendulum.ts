export type PendulumParams = {
  kp: number
  ki: number
  kd: number
  referenceDeg: number
  initialDeg: number
  mass: number
  length: number
  damping: number
  torqueLimit: number
  disturbance: number
}

export type PendulumPoint = {
  t: number
  angle: number
  velocity: number
  integral: number
  torque: number
  reference: number
  fallen: boolean
}

export const SIM_DURATION = 12
export const REFERENCE_STEP_TIME = 1
export const DISTURBANCE_TIME = 6
export const SIM_DT = 1 / 120

export const DEFAULT_PENDULUM_PARAMS: PendulumParams = {
  kp: 35,
  ki: 5,
  kd: 8,
  referenceDeg: 8,
  initialDeg: 4,
  mass: 0.5,
  length: 0.65,
  damping: 0.12,
  torqueLimit: 12,
  disturbance: 2.5,
}

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function referenceAt(t: number, params: PendulumParams) {
  return t < REFERENCE_STEP_TIME ? 0 : params.referenceDeg * DEG_TO_RAD
}

function disturbanceAt(t: number, params: PendulumParams) {
  return t >= DISTURBANCE_TIME && t < DISTURBANCE_TIME + 0.18 ? params.disturbance : 0
}

function derivatives(
  t: number,
  angle: number,
  velocity: number,
  integral: number,
  params: PendulumParams,
) {
  const reference = referenceAt(t, params)
  const error = reference - angle
  const rawTorque = params.kp * error + params.ki * integral - params.kd * velocity
  const torque = clamp(rawTorque, -params.torqueLimit, params.torqueLimit)
  const inertia = params.mass * params.length * params.length
  const gravityTorque = params.mass * 9.81 * params.length * Math.sin(angle)
  const acceleration =
    (gravityTorque + torque + disturbanceAt(t, params) - params.damping * velocity) / inertia

  // Stop integrating further into saturation. This is a simple anti-windup scheme.
  const pushingFurtherIntoSaturation =
    Math.abs(rawTorque) > params.torqueLimit && Math.sign(error) === Math.sign(rawTorque)

  return {
    dAngle: velocity,
    dVelocity: acceleration,
    dIntegral: pushingFurtherIntoSaturation ? 0 : error,
    torque,
    reference,
  }
}

export function simulateInvertedPendulum(params: PendulumParams): PendulumPoint[] {
  const points: PendulumPoint[] = []
  let angle = params.initialDeg * DEG_TO_RAD
  let velocity = 0
  let integral = 0
  let fallen = false
  const steps = Math.round(SIM_DURATION / SIM_DT)

  for (let index = 0; index <= steps; index += 1) {
    const t = index * SIM_DT
    const state = derivatives(t, angle, velocity, integral, params)
    fallen ||= Math.abs(angle) >= 85 * DEG_TO_RAD

    points.push({
      t,
      angle: angle * RAD_TO_DEG,
      velocity: velocity * RAD_TO_DEG,
      integral,
      torque: state.torque,
      reference: state.reference * RAD_TO_DEG,
      fallen,
    })

    if (fallen) continue

    const k1 = state
    const k2 = derivatives(
      t + SIM_DT / 2,
      angle + (SIM_DT * k1.dAngle) / 2,
      velocity + (SIM_DT * k1.dVelocity) / 2,
      integral + (SIM_DT * k1.dIntegral) / 2,
      params,
    )
    const k3 = derivatives(
      t + SIM_DT / 2,
      angle + (SIM_DT * k2.dAngle) / 2,
      velocity + (SIM_DT * k2.dVelocity) / 2,
      integral + (SIM_DT * k2.dIntegral) / 2,
      params,
    )
    const k4 = derivatives(
      t + SIM_DT,
      angle + SIM_DT * k3.dAngle,
      velocity + SIM_DT * k3.dVelocity,
      integral + SIM_DT * k3.dIntegral,
      params,
    )

    angle += (SIM_DT / 6) * (k1.dAngle + 2 * k2.dAngle + 2 * k3.dAngle + k4.dAngle)
    velocity +=
      (SIM_DT / 6) * (k1.dVelocity + 2 * k2.dVelocity + 2 * k3.dVelocity + k4.dVelocity)
    integral = clamp(
      integral + (SIM_DT / 6) * (k1.dIntegral + 2 * k2.dIntegral + 2 * k3.dIntegral + k4.dIntegral),
      -5,
      5,
    )
  }

  return points
}

export function calculateResponseMetrics(points: PendulumPoint[], referenceDeg: number) {
  const response = points.filter((point) => point.t >= REFERENCE_STEP_TIME)
  const finalPoint = response.at(-1)
  const fallen = response.some((point) => point.fallen)
  const direction = Math.sign(referenceDeg) || 1
  const peak = response.reduce(
    (best, point) => (direction * point.angle > direction * best ? point.angle : best),
    response[0]?.angle ?? 0,
  )
  const overshoot =
    referenceDeg === 0 ? 0 : Math.max(0, (direction * (peak - referenceDeg) * 100) / Math.abs(referenceDeg))
  const tolerance = Math.max(Math.abs(referenceDeg) * 0.02, 0.25)
  let settlingTime: number | null = null

  for (let index = 0; index < response.length; index += 1) {
    if (response.slice(index).every((point) => Math.abs(point.angle - referenceDeg) <= tolerance)) {
      settlingTime = response[index].t - REFERENCE_STEP_TIME
      break
    }
  }

  return {
    fallen,
    overshoot,
    settlingTime,
    steadyStateError: finalPoint ? Math.abs(referenceDeg - finalPoint.angle) : 0,
  }
}
