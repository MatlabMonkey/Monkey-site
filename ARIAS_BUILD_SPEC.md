# Arias Usage Dashboard - Build Spec

## Overview
Create a new page at `/app/arias/page.tsx` for the Monkey-site that displays OpenClaw usage data in a clean, data-rich dashboard.

## Requirements

### 1. Route Structure
- Create `/app/arias/page.tsx`
- Add link to this page from the main homepage (`/app/page.tsx`)

### 2. Data Display
Show a usage table/dashboard with:
- **Models in use**: List of active models (Kimi K2.5, Sonnet 4.6, Opus 4.6, Ollama)
- **Token spend**: Input/output tokens per model
- **Cost**: Estimated cost per model (use placeholder rates for now)

### 3. Time Period Views
Add toggle/buttons for:
- Daily view (default)
- Weekly view
- Monthly view

Show an "Overview" card at the top summarizing total token spend for the selected period.

### 4. Design System (CRITICAL - Read DESIGN_SYSTEM.md)
- **Theme**: Dark-first (Ink + Paper style)
- **Background**: `#05070B` (not pure black)
- **Surface**: `#0B1017` for cards/panels
- **Accent**: Brass/amber `#D4A373`
- **Typography**: 
  - UI text: Inter
  - Numbers: JetBrains Mono (right-aligned)
- **Spacing**: Use 4, 8, 12, 16, 24, 32, 48, 64px scale
- **Max width**: 1280px (data-heavy dashboard)
- **Radius**: Cards 16px

### 5. Components to Use/Create
- Use existing Card component from `/app/components/Card.tsx`
- Create a UsageTable component with sticky header
- Create a TimePeriodToggle component
- Create an OverviewCard showing totals

### 6. Sample Data Structure
Use this mock data structure for now:
```typescript
interface UsageData {
  period: 'daily' | 'weekly' | 'monthly';
  models: {
    name: string;
    provider: string;
    tokensIn: number;
    tokensOut: number;
    cost: number;
  }[];
  totalTokens: number;
  totalCost: number;
}
```

### 7. Layout
- Header: "Arias" + subtitle "OpenClaw Usage Dashboard"
- Time period toggle (Daily | Weekly | Monthly)
- Overview cards row (Total Tokens, Total Cost, Active Models)
- Usage table with sortable columns
- Optional: Small bar chart for visual token distribution

### 8. Styling Notes
- Border-first surfaces (1px border)
- Numbers in monospace, right-aligned
- Row hover highlight on table
- Responsive: stack on mobile, grid on desktop

## Files to Read
1. `/Users/Arias/Monkey-site/DESIGN_SYSTEM.md` - Color palette, typography, spacing
2. `/Users/Arias/Monkey-site/BEST_PRACTICES.md` - Build guidelines
3. `/Users/Arias/Monkey-site/app/components/Card.tsx` - Reuse existing card
4. `/Users/Arias/Monkey-site/app/page.tsx` - Add link to Arias page

## Files to Create/Modify
1. Create `/Users/Arias/Monkey-site/app/arias/page.tsx` - Main dashboard page
2. Modify `/Users/Arias/Monkey-site/app/page.tsx` - Add link to Arias page

## Build Verification
- Run `npm run build` to verify no errors
- Ensure TypeScript types are correct
- Verify responsive layout on mobile

## Reference
Point to DESIGN_SYSTEM.md for all styling decisions.
