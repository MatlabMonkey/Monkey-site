export type PendulumParams = {
  kp: number
  ki: number
  kd: number
  referencePosition: number
  initialDeg: number
  cartMass: number
  pendulumMass: number
  length: number
  cartDamping: number
  jointDamping: number
  forceLimit: number
  disturbance: number
}

export type PendulumPoint = {
  t: number
  angle: number
  angularVelocity: number
  cartPosition: number
  cartVelocity: number
  integral: number
  force: number
  referencePosition: number
  targetAngle: number
  fallen: boolean
  railHit: boolean
}

export const SIM_DURATION = 12
export const REFERENCE_STEP_TIME = 1
export const DISTURBANCE_TIME = 6
export const SIM_DT = 1 / 120
export const TRACK_LIMIT = 2.4

export const DEFAULT_PENDULUM_PARAMS: PendulumParams = {
  kp: 90,
  ki: 5,
  kd: 30,
  referencePosition: 0.75,
  initialDeg: 4,
  cartMass: 1,
  pendulumMass: 0.25,
  length: 0.65,
  cartDamping: 0.12,
  jointDamping: 0.015,
  forceLimit: 30,
  disturbance: 0.5,
}

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI
const POSITION_KP = 0.18
const POSITION_KD = 0.32
const MAX_TARGET_ANGLE = 10 * DEG_TO_RAD

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function referenceAt(t: number, params: PendulumParams) {
  return t < REFERENCE_STEP_TIME ? 0 : params.referencePosition
}

function disturbanceAt(t: number, params: PendulumParams) {
  return t >= DISTURBANCE_TIME && t < DISTURBANCE_TIME + 0.12 ? params.disturbance : 0
}

function derivatives(
  t: number,
  cartPosition: number,
  cartVelocity: number,
  angle: number,
  angularVelocity: number,
  integral: number,
  params: PendulumParams,
) {
  const referencePosition = referenceAt(t, params)
  const positionError = referencePosition - cartPosition
  const targetAngle = clamp(
    POSITION_KP * positionError - POSITION_KD * cartVelocity,
    -MAX_TARGET_ANGLE,
    MAX_TARGET_ANGLE,
  )

  // Positive pole angle means the pole leans right. Moving the cart right
  // accelerates its base underneath that lean, so the stabilizing force has
  // the same sign as angle error and angular velocity.
  const angleError = angle - targetAngle
  const rawForce = params.kp * angleError + params.ki * integral + params.kd * angularVelocity
  const force = clamp(rawForce, -params.forceLimit, params.forceLimit)

  const sinAngle = Math.sin(angle)
  const cosAngle = Math.cos(angle)
  const disturbanceTorque = disturbanceAt(t, params)
  const angularDrive =
    9.81 * sinAngle +
    (disturbanceTorque - params.jointDamping * angularVelocity) /
      (params.pendulumMass * params.length)
  const horizontalDrive =
    force -
    params.cartDamping * cartVelocity +
    params.pendulumMass * params.length * sinAngle * angularVelocity * angularVelocity
  const effectiveMass = params.cartMass + params.pendulumMass * sinAngle * sinAngle
  const cartAcceleration =
    (horizontalDrive - params.pendulumMass * cosAngle * angularDrive) / effectiveMass
  const angularAcceleration = (angularDrive - cosAngle * cartAcceleration) / params.length

  const pushingFurtherIntoSaturation =
    Math.abs(rawForce) > params.forceLimit && Math.sign(angleError) === Math.sign(rawForce)

  return {
    dCartPosition: cartVelocity,
    dCartVelocity: cartAcceleration,
    dAngle: angularVelocity,
    dAngularVelocity: angularAcceleration,
    dIntegral: pushingFurtherIntoSaturation ? 0 : angleError,
    force,
    referencePosition,
    targetAngle,
  }
}

export function simulateInvertedPendulum(params: PendulumParams): PendulumPoint[] {
  const points: PendulumPoint[] = []
  let cartPosition = 0
  let cartVelocity = 0
  let angle = params.initialDeg * DEG_TO_RAD
  let angularVelocity = 0
  let integral = 0
  let fallen = false
  let railHit = false
  const steps = Math.round(SIM_DURATION / SIM_DT)

  for (let index = 0; index <= steps; index += 1) {
    const t = index * SIM_DT
    const state = derivatives(t, cartPosition, cartVelocity, angle, angularVelocity, integral, params)
    fallen ||= Math.abs(angle) >= 75 * DEG_TO_RAD
    railHit ||= Math.abs(cartPosition) >= TRACK_LIMIT

    points.push({
      t,
      angle: angle * RAD_TO_DEG,
      angularVelocity: angularVelocity * RAD_TO_DEG,
      cartPosition,
      cartVelocity,
      integral,
      force: state.force,
      referencePosition: state.referencePosition,
      targetAngle: state.targetAngle * RAD_TO_DEG,
      fallen,
      railHit,
    })

    if (fallen || railHit) continue

    const k1 = state
    const k2 = derivatives(
      t + SIM_DT / 2,
      cartPosition + (SIM_DT * k1.dCartPosition) / 2,
      cartVelocity + (SIM_DT * k1.dCartVelocity) / 2,
      angle + (SIM_DT * k1.dAngle) / 2,
      angularVelocity + (SIM_DT * k1.dAngularVelocity) / 2,
      integral + (SIM_DT * k1.dIntegral) / 2,
      params,
    )
    const k3 = derivatives(
      t + SIM_DT / 2,
      cartPosition + (SIM_DT * k2.dCartPosition) / 2,
      cartVelocity + (SIM_DT * k2.dCartVelocity) / 2,
      angle + (SIM_DT * k2.dAngle) / 2,
      angularVelocity + (SIM_DT * k2.dAngularVelocity) / 2,
      integral + (SIM_DT * k2.dIntegral) / 2,
      params,
    )
    const k4 = derivatives(
      t + SIM_DT,
      cartPosition + SIM_DT * k3.dCartPosition,
      cartVelocity + SIM_DT * k3.dCartVelocity,
      angle + SIM_DT * k3.dAngle,
      angularVelocity + SIM_DT * k3.dAngularVelocity,
      integral + SIM_DT * k3.dIntegral,
      params,
    )

    cartPosition +=
      (SIM_DT / 6) *
      (k1.dCartPosition + 2 * k2.dCartPosition + 2 * k3.dCartPosition + k4.dCartPosition)
    cartVelocity +=
      (SIM_DT / 6) *
      (k1.dCartVelocity + 2 * k2.dCartVelocity + 2 * k3.dCartVelocity + k4.dCartVelocity)
    angle += (SIM_DT / 6) * (k1.dAngle + 2 * k2.dAngle + 2 * k3.dAngle + k4.dAngle)
    angularVelocity +=
      (SIM_DT / 6) *
      (k1.dAngularVelocity + 2 * k2.dAngularVelocity + 2 * k3.dAngularVelocity + k4.dAngularVelocity)
    integral = clamp(
      integral +
        (SIM_DT / 6) * (k1.dIntegral + 2 * k2.dIntegral + 2 * k3.dIntegral + k4.dIntegral),
      -2,
      2,
    )
  }

  return points
}

export function calculateResponseMetrics(points: PendulumPoint[], referencePosition: number) {
  const response = points.filter((point) => point.t >= REFERENCE_STEP_TIME)
  const finalPoint = response.at(-1)
  const failed = response.some((point) => point.fallen || point.railHit)
  const direction = Math.sign(referencePosition) || 1
  const peak = response.reduce(
    (best, point) =>
      direction * point.cartPosition > direction * best ? point.cartPosition : best,
    response[0]?.cartPosition ?? 0,
  )
  const overshoot =
    referencePosition === 0
      ? 0
      : Math.max(
          0,
          (direction * (peak - referencePosition) * 100) / Math.abs(referencePosition),
        )
  const tolerance = Math.max(Math.abs(referencePosition) * 0.02, 0.02)
  let settlingTime: number | null = null

  for (let index = 0; index < response.length; index += 1) {
    if (
      response
        .slice(index)
        .every((point) => Math.abs(point.cartPosition - referencePosition) <= tolerance)
    ) {
      settlingTime = response[index].t - REFERENCE_STEP_TIME
      break
    }
  }

  return {
    failed,
    fallen: response.some((point) => point.fallen),
    railHit: response.some((point) => point.railHit),
    overshoot,
    settlingTime,
    steadyStateError: finalPoint ? Math.abs(referencePosition - finalPoint.cartPosition) : 0,
    maxAngle: response.reduce((largest, point) => Math.max(largest, Math.abs(point.angle)), 0),
  }
}
