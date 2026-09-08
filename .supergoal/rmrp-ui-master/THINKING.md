# Goals
- Implement the Master TZ UI definition of done using the existing Next.js application and live backend data.
- Preserve dynamic activity types and existing authenticated APIs; do not fabricate production data.

# Constraints
- Russian, dark-first internal security portal.
- Desktop-first responsive shell with mobile drawer behavior.
- Existing backend only exposes dashboard, employees, dictionaries, Discord sources, and unresolved data; unsupported areas must be useful empty or access states, not fake content.
- Collector and Discord authentication workflows remain untouched.

# Risks
1. The specification names many screens whose APIs do not yet exist. Mitigation: create complete navigable UI surfaces with truthful empty states and isolate data adapters for later APIs.
2. The current frontend is a single client page. Mitigation: establish reusable shell, table, metric, badge, state, and chart components before adding views.
3. Existing backend responses are simpler than the target dashboard. Mitigation: extend only read APIs needed for truthful dashboard visualizations and test them.

# Dependencies
- App shell and design tokens precede every page.
- Dashboard data adapters precede charts and tables.
- Browser visual checks follow the frontend deployment.

# Assumptions
- The supplied Master TZ is the visual and IA authority; no separate visual mockup is present.
- Existing role guard remains the authority; frontend navigation is UX-only.
