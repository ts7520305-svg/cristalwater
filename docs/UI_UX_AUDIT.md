# UI/UX Audit - Cristal Water

Date: 2026-07-12

## 1. Route and page map

Frontend pages discovered (top-level `frontend/*.html`):
- 90 pages found, split roughly into:
  - Admin area: `admin-*` + operation/finance/report pages
  - Technician area: `technician-*`
  - Client area: `client-*` + `client_chat`, `client_tech`
  - Shared/legacy/system pages: `dashboard`, `map`, `notifications`, `settings`, `splash`, etc.

Backend route mounts discovered in `src/server.js`:
- 90+ API mount points, including aliases and legacy paths.
- Key domains: auth, clients, pools, visits, dashboard, billing, invoices, payments, inventory, gps, notifications, reports, communication, operations/core flow, installation/construction, administration.

## 2. Components and UI assets inventory

Key shell/design assets found:
- `frontend/crystal-os-v2-foundation.css`
- `frontend/crystal-os-v2-phase2-adapter.css`
- `frontend/crystal-os-v2-shell.js`
- `frontend/crystal-os-v2-nav.js`
- `frontend/cw-os-admin-shell.js`
- `frontend/cw-component-system.css`
- `frontend/cw-component-system.js`

Core guards/session scripts:
- `frontend/cw-auth.js`
- `frontend/admin-auth-guard.js`
- `frontend/client-auth-guard.js`

Technician offline stack:
- `frontend/js/offline/offline-queue.js`
- `frontend/js/offline/offline-photos.js`
- `frontend/js/offline/offline-gps.js`

## 3. Feature inventory (existing)

Admin:
- dashboards, alerts, operations flow, rounds/routes, map/live-map
- client and pool management
- technician/fleet management
- inventory/stock
- billing, invoices, payments, collections
- reports/metrics
- communication/chat/notifications
- settings/security/admin tools

Technician:
- field mode dashboard
- route and visit execution
- technical logs and map/GPS
- work/transport guides
- offline/sync status controls

Client:
- portal status
- visits/history
- payments/invoices
- requests/messages/notifications
- account info

## 4. Menus and submenu status

Current state before this pass:
- navigation spread across legacy menus + V2 shell links
- mixed labels (PT/EN), mixed depth and duplicated links
- some operationally related items located far apart

## 5. Profile and permission map (backend-enforced)

Observed route-level auth patterns:
- `auth("ADMIN")` for strict admin modules
- `auth("TEAM_LEADER")` used for admin/internal role band
- `auth("TECHNICIAN")` for technician operational modules
- `auth("CLIENT")` for client-scoped portal endpoints

Recent hardening now in place:
- `/api/clients` protected with internal-role gate
- `/api/dashboard/metrics` protected with internal-role gate

## 6. Actions by area (high-level)

Admin pages:
- CRUD clients/pools/technicians
- assign/plan/track visits and rounds
- process billing and payments
- manage stock and logistics

Technician pages:
- start/complete visit
- record readings/products/photos
- inspect route and field constraints

Client pages:
- view own pool/visits/reports
- view payments/invoices
- submit requests/messages

## 7. Duplicates and misplaced functionality

Detected:
- route aliases for same domains (e.g. poolChat/pool-chat, serviceChat/service-chat)
- legacy and V2 pages coexist for similar workflows
- duplicated navigation entry points to same destination with inconsistent labels

## 8. Incomplete/empty/disconnected pages

Markers found:
- multiple pages show "A carregar..." placeholders and fallback-only empty states
- several pages contain direct inline logic with weak error granularity
- some pages appear tooling/debug oriented and should not be primary nav items

## 9. Responsiveness audit (current)

Strengths:
- V2 shell introduces mobile primary nav and drawer
- adapter attempts to constrain overflow and improve spacing

Issues found:
- inconsistent card/table behavior across legacy pages
- some grids and forms still dense on smaller widths
- long mixed inline styles in older pages make consistency hard

## 10. Visual consistency (contrast/type/spacing)

Current:
- partial design-system adoption
- mixed typography and radius scales
- mixed button heights and visual priority

Risk:
- technician field screens need larger action targets and cleaner hierarchy under sun/glare conditions

## 11. Broken links/dead controls audit hints

Potential hotspots:
- pages with many inline onclick handlers and silent catches
- duplicate legacy links in nav increase perceived dead-end risk

## 12. Loading/error/empty/offline/sync state audit

Findings:
- loading and error strings are present in many pages but not standardized
- offline is strong in technician legacy page but uneven elsewhere
- no single state component contract across all screens

## 13. Navigation architecture proposal (implemented in this pass)

Implemented a profile-based IA inside V2 nav:
- Admin grouped into 13 logical sections aligned to operational domains
- Technician grouped by field workflow: Hoje, Trabalho em campo, Logistica, Conta
- Client grouped by portal priorities: status, visits, payments, requests, account

Added contextual topbar metadata:
- area label
- page title
- compact breadcrumb

## 14. Key risks

- Large legacy surface area with mixed paradigms (inline scripts + modular scripts)
- Existing dirty tree and broad parallel changes require careful scope isolation
- Full end-to-end UX harmonization is multi-iteration; this pass focuses on shell IA, readability and responsive ergonomics without breaking business APIs

## 15. Progress governance (Phase A)

Detailed tracker created:
- [docs/UI_UX_PAGE_PROGRESS.md](docs/UI_UX_PAGE_PROGRESS.md)

Tracker includes for each frontend HTML page:
- page
- profile
- module
- current state
- known issues
- existing functionality
- required/implemented changes
- tests and result
- pending items

Current count snapshot:
- total pages indexed: 90
- pages with explicit analysis/correction markers: 10
- remaining pages pending deep module pass: 80
