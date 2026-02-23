# Website Best Practices (Monkey-site)

## Build Process
1. **Always reference DESIGN_SYSTEM.md** for styling decisions
2. **Use existing components** from the project before creating new ones
3. **Follow the established patterns** in the codebase

## Pre-Build Checklist
- [ ] Read DESIGN_SYSTEM.md for color palette, spacing, typography
- [ ] Check existing pages for component reuse opportunities
- [ ] Verify Supabase schema if data persistence needed
- [ ] Ensure responsive design (mobile-first)

## Codex Instructions
**When building a new page:**
1. Read DESIGN_SYSTEM.md in the project root
2. Follow the dark-first color scheme (Ink + Paper)
3. Use Inter for UI text, JetBrains Mono for numbers/code
4. Stick to the spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px
5. Max page width: 1200px (1280px for data-heavy dashboards)
6. Reuse shadcn/ui components when available
7. Test build with `npm run build` before finishing

## Point Codex towards DESIGN_SYSTEM.md for all styling decisions.
