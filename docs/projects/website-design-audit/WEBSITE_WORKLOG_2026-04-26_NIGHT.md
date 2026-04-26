# Website Worklog — Night Pass (2026-04-26)

## Major UX updates shipped

- `/tools/meal-prep`
  - Grocery/Cook mode toggle (sticky)
  - Mobile checklist improvements + local persistence
  - Home shortcut
- `/todos`
  - Recurring section compressed into collapsible panel
- `/questions`
  - PIN-protected delete action for questions
- `/workspace`
  - Removed low-value summary/access boxes
  - Renamed "Capture pipeline" -> "Idea Inbox"
- `/workspace/ideas`
  - Renamed page title to "Idea Inbox"
- `/dashboard` + `/journal`
  - Added explicit Home navigation affordance
- `/journal`
  - Calendar picker with per-day entry highlighting (month view)

## Tool updates

- `/tools/medication-visualizer` (alias route)
  - Generic naming (no explicit medication branding in title/card)
  - Sleep windows rendered as clear graph regions
  - Simplified Vitamin C controls
  - Fixed windows for work/homework scoring
- `/tools/bac`
  - Added BAC over-time chart with risk zone shading + reference lines

## Surprise tool added

- `/tools/focus-day`
  - New Focus Day Planner that generates a practical day-block schedule from wake/bed/deep-work/workout targets.

## Design direction applied

- Remove UI that consumes attention without helping decisions
- Favor explicit navigation (Back + Home)
- Favor task-mode interfaces over passive stats blocks
- Keep critical actions and context visible on mobile
