SUPERGOAL_PHASE_START
Phase: 1 of 5 - Establish portal design system
Task: Replace the current isolated layout with reusable Master TZ app shell and foundation components.
Mandatory commands: npm run build --workspace=@rmrp/frontend; git diff --check
Acceptance criteria: 6
Evidence required: route map, responsive screenshot evidence, build output
Depends on phases: none

Implement reusable components and CSS tokens. Use Lucide icons, an accessible responsive sidebar, top bar, page header, status badges, tables and loading/empty/error states. Preserve login behavior and do not create fake data.

SUPERGOAL_PHASE_VERIFY: Shared sidebar, top bar, state components, table component, desktop and mobile layouts implemented; frontend production build passed.
SUPERGOAL_PHASE_DONE
