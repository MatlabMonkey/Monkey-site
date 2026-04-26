# Website Design Audit (Pilot-first)

Date: 2026-04-26

## High-level diagnosis

The site currently over-relies on repeated rounded boxes with similar weight, so visual hierarchy is weak. Many pages look "equally important" even when user intent is highly specific (buy groceries, process inbox, check status).

## Primary issues

1. **Box repetition without hierarchy**
   - Same border/radius/spacing patterns everywhere reduce scannability.
2. **Navigation inconsistency**
   - Some pages have only "Back", some have no clear "Home" affordance.
3. **Action dilution**
   - Primary task actions often compete with secondary controls.
4. **Mobile friction on execution pages**
   - Grocery/todo flows need thumb-first interaction and compact mode switches.

## Design principles adopted for pilot

- **Task-mode UI:** explicitly switch between "do mode" states (e.g., grocery vs cook).
- **Sticky controls near thumb zone:** mode toggles and progress are persistent.
- **Visual compression for repeat content:** recurring/tactical lists should collapse by default.
- **Dual-path navigation clarity:** keep both local-back and Home where context switching is common.

## Pilot pages updated

1. `/tools/meal-prep`
   - Added Grocery/Cook mode switch (sticky).
   - Improved touch targets for checklist interaction.
   - Added Home shortcut next to Back-to-Tools.

2. `/tools`
   - New header treatment + card gradient styling to reduce flat-box feel.
   - Added explicit Home pill in nav row.

3. `/todos`
   - Recurring block compressed into collapsible section to reduce visual bulk.

4. `/questions`
   - Added Home shortcut in header controls.
   - Added inline delete action flow with PIN.

## Next steps (recommended)

- **Phase 2 visual system:** introduce 2-3 card densities (hero/action/compact) and use consistently.
- **Top-level nav consistency pass:** Home + Back affordance for all private workflow pages.
- **Typography hierarchy pass:** stronger section title rhythm and subtext contrast.
- **Ops redesign implementation:** action-first layout from ops audit (Now/Ship/Projects/History).
