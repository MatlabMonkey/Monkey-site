# Adderall XR Visualizer — Spec (v1)

Last updated: 2026-04-25 17:24 PDT

## Objective
Interactive 5-day simulator under `/tools/adderall-xr` for comparing dosing schedules against daytime effect and sleep-window interference.

## Inputs (v1)
- Dose 1 time (slider, 24h clock)
- Dose 2 time (slider, 24h clock)
- Dose size per capsule (default 10 mg)
- Vitamin C enabled (checkbox)
- Vitamin C time (slider)
- Vitamin C intensity (slider: low → high effect on elimination)
- Wake time (slider)
- Bedtime (slider, allows post-midnight values)

## Core model

### PK: oral one-compartment approximation with XR split pulses
For each XR capsule:
- 50% immediate pulse at ingestion time
- 50% delayed pulse at ingestion + 4 h

State update (discrete integration):
- Gut compartments absorb into central compartment with first-order `ka`
- Central compartment eliminates with first-order `k_elim`
- `k_elim` baseline set from half-life, then multiplied by vitamin-C acidification factor near vitamin C time each day

### PD: effect-site lag + Emax
- Effect-site concentration `Ce` via effect-compartment ODE:
  - `dCe/dt = ke0 * (Cp - Ce)`
- Effect score as saturating function:
  - `E = Emax * Ce^gamma / (EC50^gamma + Ce^gamma)`

### Carryover / steady-state
- Simulate pre-roll (14 days) before displayed 5-day window.
- Display only final 5 days to capture residual carryover from prior days.

## Outputs (v1)
- Main chart (hover tooltip):
  - Plasma concentration vs time
  - Effect score vs time
- Summary cards:
  - Mean wake-window effect
  - Mean sleep-window effect
  - Focus score
  - Sleep score
  - Composite schedule score

## UX details
- Defaults:
  - Dose 1: 07:30
  - Dose 2: 12:00
  - Wake: 07:30
  - Bed: 24:00
  - Vitamin C off
- Time display includes day index over 5-day timeline.
- Explicit disclaimer: educational only, not medical advice.

## Non-goals (v1)
- Diagnostic/clinical recommendations
- Patient-specific medical optimization
- Real-world adherence prediction

## Validation gates
- `npm run lint`
- `npm run build`
