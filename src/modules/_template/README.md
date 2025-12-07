# New Module Template (Trips-style)

This template gives you the exact layout used by `/trucking/operations/trips`: stats cards, control panel (search/filters/actions), and a data table with a summary bar.

## 📁 Structure

```
src/modules/_template/
├── module.config.ts          # Module configuration (nav + route) — disabled by default
├── index.ts                  # Public exports
├── components/
│   ├── TemplatePage.tsx      # Page composition (stats, controls, table)
│   ├── TemplateStatsCards.tsx
│   ├── TemplateControlPanel.tsx
│   └── TemplateTable.tsx
├── hooks/
│   └── useTemplateDashboard.ts # State, filters, sample data, summaries
├── types/
│   └── template.types.ts     # Record + summary types
```

## 🚀 How to use

1. Copy this `_template` folder to your target location (e.g., `src/modules/<business>/<workspace>/<feature>`).
2. Rename files/folders as needed.
3. Update `module.config.ts`:
   - `id`, `name`, `path`, `navigation` labels, `business`, `workspace`, `enabled`.
   - Route import path if you rename the page component.
4. Wire the module in `src/modules/index.ts` and register it in `moduleRegistry`.
5. Adjust types and sample data in `useTemplateDashboard.ts` to your real data model.
6. Swap placeholder labels/icons as needed. The layout, summary bar, and vh heights are already set.
7. The template page intentionally has **no default title/subtitle**; add your own heading if the module needs one.

## Layout guarantees

- Stats cards with four metrics (total in, total out, net, records this month).
- Control panel with search, category filter, status filter, date range, import/export/add buttons.
- Data table with summary bar (counts + metric totals) and default height of 74vh.
- Default currency formatter (PHP) and date formatting.
- No default page title/subtitle; you control the header content.

## Notes

- The module is disabled by default; enable it after you set correct paths and business/workspace targeting.
- Sample handlers just show notifications — replace with real logic.
- Summary bar and table height are pre-set; adjust via props if needed.
- Component: 20 minutes
- Registration: 1 minute
- Testing: 10 minutes

**Total: ~40-50 minutes per feature!**

---

**Ready to create your module?** Follow the steps above! 🚀
