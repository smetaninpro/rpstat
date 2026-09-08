# RMRP UFSB Portal UI Master Plan

## Phase 1: Establish portal design system
**Deliverables:** reusable dark AppShell, responsive sidebar/top bar, tokens, icons, common state and table components.
**Acceptance criteria:** App shell provides all Master TZ navigation groups; active item is visibly indicated; desktop sidebar is 220-250px; tablet/mobile navigation remains usable; no duplicate route layouts; production frontend build passes.
**Dependencies:** none.

## Phase 2: Build reference dashboard
**Deliverables:** dashboard header, period control, dynamic metric cards, multi-series trend, activity distribution, employee ranking, recent-events table, collector warning.
**Acceptance criteria:** cards derive from backend activity types; no activity list is hardcoded as the sole UI dataset; charts contain tooltips and legends; loading/error/empty states are visual states; dashboard answers totals/trend/distribution/top employees from live data; backend and frontend tests pass.
**Dependencies:** phase 1.

## Phase 3: Deliver operational views
**Deliverables:** Employees, employee profile/tabs, Statistics, Training, Materials, and functional routes integrated into the shared shell.
**Acceptance criteria:** every specified route is reachable; employee table uses server pagination and useful filters; employee detail exposes overview/statistics/history/training/activity tabs; unsupported live data shows explicit empty state; statistics filters persist in URL where applicable; responsive tables scroll horizontally.
**Dependencies:** phases 1-2.

## Phase 4: Deliver administration views
**Deliverables:** integration tabs/status/settings, review queue, unresolved data, dictionaries, users, audit, and settings views.
**Acceptance criteria:** existing Discord source configuration remains functional; collector status and lookback are shown; unresolved/review data is readable; admin views are distinguishable and not generic forms; unsupported admin APIs show truthful empty states; CSRF remains applied on mutations.
**Dependencies:** phases 1-3.

## Phase 5: Polish and harden UI
**Deliverables:** accessibility and responsive polish, visual browser evidence, regression fixes, Docker deployment verification.
**Acceptance criteria:** desktop and mobile browser checks pass; keyboard focus is visible; semantic activity colors are consistent; no raw Loading text; builds/tests/diff check pass; frontend and backend containers are healthy.
**Dependencies:** phases 1-4.
