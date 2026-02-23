# Site Redesign Spec - Dark Theme Unification

## Goal
Redesign all pages to match the Ink + Paper dark theme from DESIGN_SYSTEM.md.
Keep the front page image background as requested.

## Design Reference
**CRITICAL:** Read DESIGN_SYSTEM.md in the project root before making any changes.

### Theme Specs (Ink + Paper)
- Background: `#05070B` (rgb(5 7 11))
- Surface: `#0B1017` (rgb(11 16 23))
- Surface-2: `#101824` (rgb(16 24 36))
- Border: `#223042` (rgb(34 48 66))
- Text: `#E9ECEF` (rgb(233 236 239))
- Text-muted: `#B4BDC8` (rgb(180 189 200))
- Accent (brass): `#D4A373` (rgb(212 163 115))
- Accent-strong: `#C58D5B`
- Accent-weak: `#1A1410`

### Typography
- UI: Inter
- Numbers/Code: JetBrains Mono
- Scale: 12, 14, 16, 20, 24, 32, 40px

### Spacing
- Scale: 4, 8, 12, 16, 24, 32, 48, 64px
- Max width: 1200px (most), 1280px (dashboards)
- Card radius: 16px, pills: 999px

## Pages to Redesign

### 1. /app/page.tsx (Homepage)
**KEEP the image background** — this is the user's explicit request.
- Keep the nature photo background system
- Redesign the feature buttons to match dark theme
- Update typography to use design system
- Keep existing layout structure but apply dark color palette

### 2. /app/dashboard/page.tsx
- Full dark theme conversion
- Use surface colors for cards/panels
- Border-first styling (not heavy shadows)
- JetBrains Mono for any numbers

### 3. /app/todos/page.tsx
- Full dark theme conversion
- Use existing todo components but update colors
- Input fields should use surface colors

### 4. /app/tools/page.tsx
- Full dark theme conversion
- Tool cards should use surface color with border

### 5. /app/tools/bac/page.tsx
- Full dark theme conversion
- Calculator UI in dark theme
- Input fields on surface color

### 6. /app/questions/page.tsx
- Full dark theme conversion
- Form inputs on surface color

### 7. /app/journal/ pages
- All journal pages: explorer, search
- Full dark theme conversion

### 8. /app/about/page.tsx
- Full dark theme conversion

### 9. /app/components/
- Update Card.tsx if needed
- Ensure all shared components work with dark theme

## What NOT to Change
- Front page image background system (KEEP as-is)
- /app/arias/page.tsx (already done)
- Functionality — only visual redesign
- Layout structure (mostly) — just colors and typography

## Implementation Notes

1. **CSS Variables approach:**
   Consider adding CSS variables to globals.css:
   ```css
   :root {
     --bg: 5 7 11;
     --surface: 11 16 23;
     --surface-2: 16 24 36;
     --border: 34 48 66;
     --text: 233 236 239;
     --text-muted: 180 189 200;
     --brand: 212 163 115;
   }
   ```

2. **Tailwind classes:**
   Use rgb() syntax for consistency:
   - `bg-[rgb(5_7_11)]`
   - `border-[rgb(34_48_66)]`
   - `text-[rgb(233_236_239)]`

3. **Typography:**
   Import Inter and JetBrains Mono fonts

4. **Testing:**
   Run `npm run build` to verify no errors

## Files to Modify
1. app/globals.css — Add CSS variables
2. app/layout.tsx — Add font imports if needed
3. app/page.tsx — Keep image, update buttons/colors
4. app/dashboard/page.tsx — Full redesign
5. app/todos/page.tsx — Full redesign
6. app/tools/page.tsx — Full redesign
7. app/tools/bac/page.tsx — Full redesign
8. app/questions/page.tsx — Full redesign
9. app/journal/* — Full redesign
10. app/about/page.tsx — Full redesign
11. app/components/Card.tsx — Update if needed

## Success Criteria
- [ ] All pages use consistent dark color palette
- [ ] Front page keeps image background
- [ ] Typography uses Inter and JetBrains Mono
- [ ] Border-first surfaces (not heavy shadows)
- [ ] Build passes without errors
- [ ] Mobile responsive maintained

Point to DESIGN_SYSTEM.md for all styling decisions.
