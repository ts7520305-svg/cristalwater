# UI/UX Refactor Plan - Cristal Water

Date: 2026-07-12

## Strategy

Use safe incremental blocks to preserve existing backend contracts and avoid feature regression.

## Execution order

1. Design system consolidation
- unify top-level shell tokens and spacing/radius/button scales
- introduce role-aware visual tuning for field technicians

2. Main shell structure
- normalize global topbar + search + drawer behavior
- add contextual title/area/breadcrumbs

3. Navigation IA by profile
- admin: 13 domain groups
- technician: field-first flow with fewer critical taps
- client: portal-first flow

4. Profile layouts
- role-specific readability and touch ergonomics
- mobile bottom navigation behavior

5. Admin pages pass
- ensure primary tasks discoverable through IA
- keep legacy access but remove clutter from first-level navigation

6. Technician area pass
- emphasize route -> next pool -> start visit -> complete visit flow
- improve action prominence and form touchability

7. Client portal pass
- prioritize pool status, visits, payments, requests, messages

8. Forms
- group fields by intent and increase legibility on mobile
- validate visible labels and actionable feedback

9. Tables/lists
- enforce overflow-safe wrappers and spacing consistency

10. States and resilience
- normalize loading/error/empty/offline visuals through shared classes

11. Responsiveness
- validate key breakpoints: 320/375/390/430/768/1024/1280/1440/1920

12. Accessibility
- ensure keyboard focus visibility, contrast, readable hierarchy

13. Tests
- run available scripts only from package.json

## Files affected (this phase)

- frontend/crystal-os-v2-nav.js
- frontend/crystal-os-v2-phase2-adapter.css
- docs/UI_UX_AUDIT.md
- docs/UI_UX_REFACTOR_PLAN.md

## Risks

- Legacy pages with heavy inline CSS/JS may resist full consistency without deeper page-level refactors.
- Some route labels are technical/legacy and may require stakeholder naming alignment.
- Existing dirty worktree increases chance of overlap in unrelated files.

## Dependencies

- Existing `crystal-os-v2-*` shell assets
- Existing auth guards and route protections
- Existing API contracts and role middleware

## Acceptance criteria for this phase

- Navigation grouped by role and domain, without removing features
- Technician flow made clearer with larger action affordances
- Mobile/desktop shell remains stable without global overflow
- Backend/API contracts untouched

## Validation commands (available in package.json)

- npm run check:syntax
- npm test
- npm run smoke
- node scripts/test-operational-flow.js
- node scripts/test-system-interconnections.js
- npx prisma migrate status

## Current checkpoint (execution in progress)

Completed now:
- Phase A tracker generation for all 90 pages in [docs/UI_UX_PAGE_PROGRESS.md](docs/UI_UX_PAGE_PROGRESS.md)
- Cross-shell IA and responsive refinements in V2 shell files

In progress now:
- Group 1/2/Technician/Client deep visual-functional pass

Last completed file:
- frontend/client-portal.html (analyzed and integrated with V2 shell structure)

Next file in sequence:
- frontend/admin-clients.html (deep normalization for forms/lists/actions)

