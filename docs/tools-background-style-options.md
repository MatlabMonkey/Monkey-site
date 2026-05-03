# Tools Page Background Animation Styles

## 1) Aurora Mist
- **Look:** soft drifting blue/orange gradient clouds
- **Implementation:** CSS radial gradients + slow keyframes
- **Perf cost:** Very Low (GPU compositing, near-zero CPU)

## 2) Pulse Grid
- **Look:** subtle technical grid with breathing highlights
- **Implementation:** layered CSS gradients + opacity pulse
- **Perf cost:** Very Low

## 3) Star Drift
- **Look:** sparse tiny particles drifting across page
- **Implementation:** low-count canvas particles (~32)
- **Perf cost:** Low

## 4) Wave Mesh
- **Look:** calm layered sinusoidal line motion
- **Implementation:** canvas line rendering with low segment count
- **Perf cost:** Low

## 5) Fluid Orange/Blue
- **Look:** blended orange + blue fluid-like blobs with additive shimmer
- **Implementation:** canvas radial fields + slow advection
- **Perf cost:** Low-Medium (kept safe via 30 FPS cap, low object count)

## Top 2 picks for production
1. **Fluid Orange/Blue** — strongest identity, matches request, still efficient with hard limits.
2. **Aurora Mist** — premium feel, excellent readability, almost free performance-wise.

## Perf guardrails used in implementation
- 30 FPS cap for canvas modes
- Small particle/blob counts
- Pause animation when tab is hidden
- Respect `prefers-reduced-motion`
- Persist user-selected style in local storage
