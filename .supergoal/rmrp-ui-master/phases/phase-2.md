SUPERGOAL_PHASE_START
Phase: 2 of 5 - Build reference dashboard
Task: Deliver the Master TZ dashboard from live APIs.
Mandatory commands: npm run build --workspace=@rmrp/backend; npm test --workspace=@rmrp/backend; npm run build --workspace=@rmrp/frontend; git diff --check
Acceptance criteria: 6
Evidence required: API response check, dashboard screenshots, test output
Depends on phases: 1

Extend read APIs only as necessary for live dynamic metrics, event list, trends, and distribution. Implement all dashboard blocks without hardcoding activity types.

SUPERGOAL_PHASE_VERIFY: Live dashboard data uses existing dashboard and leadership analytics APIs with dynamic metric cards, trend, distribution, ranking, collector warning, loading and empty states; backend tests and frontend build passed.
SUPERGOAL_PHASE_DONE
