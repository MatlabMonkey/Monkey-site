# Adderall XR Visualizer Worklog

Last updated: 2026-04-25 17:31 PDT

## Project goal
Build a private `/tools` visualizer that models Adderall XR concentration/effect over time (5-day window), with dose timing controls, vitamin C/urinary acidification controls, and wake/bedtime scoring.

## Scope confirmed
- Two Adderall XR 10 mg doses/day with adjustable dose times.
- Concentration curve + effect curve shown together.
- Hover for exact values at any time point.
- Include delay from plasma concentration to CNS effect.
- Include vitamin C control to approximate increased renal elimination from acidification.
- Include wake/bedtime controls and scoring for daytime focus vs nighttime sleep interference.
- Include carryover/steady-state assumptions rather than zeroing each day.

## Execution plan
1. Compile pharmacology assumptions + constraints into a transparent research note.
2. Define mathematical model (PK + effect compartment + scoring).
3. Implement first in-browser version in `/app/tools/adderall-xr/page.tsx`.
4. Run lint/build, tune UX defaults, and document caveats.

## Status
- [x] Workstream scaffolded
- [x] Research note finalized
- [x] Model spec finalized
- [x] Tool implemented (`/tools/adderall-xr`)
- [x] Validation complete (lint/build)
- [ ] Commit + ship summary
