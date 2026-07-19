# RC1 Security Matrix

Purpose: release-grade evidence matrix for RC1 blockers (authentication, authorization, ownership isolation).

## Global policy

- Default requirement: authenticated requests for all non-public APIs.
- Admin-only surfaces: must require `ADMIN` role.
- Technician operational surfaces: must require `TECHNICIAN` or `ADMIN` and enforce assignment ownership where applicable.
- Client surfaces: must require `CLIENT` and enforce `clientId` ownership.

## Critical route groups verified in RC1

| Route group | Auth | Role gate | Ownership gate |
|---|---|---|---|
| `/api/admin/rounds` | Required | ADMIN | N/A |
| `/api/search` | Required | ADMIN | N/A |
| `/api/reports/visit/:id` | Required | ADMIN/TECHNICIAN/CLIENT | Technician must match `visit.technicianId`; client must match `visit.clientId` |
| `/api/report-visit/visit/:id` | Required | ADMIN/TECHNICIAN/CLIENT | Technician/client ownership enforced in controller |
| `/api/visits/today` | Required | TECHNICIAN/ADMIN | Technician token forces own `technicianId` |
| `/api/visits/:id` | Required | TECHNICIAN/ADMIN | Technician token can only access own visit |
| `/api/technician/today` | Required | TECHNICIAN/ADMIN | Technician token forces own `technicianId` |
| `/api/services` | Required | ADMIN | N/A |
| `/api/client-portal/:clientId/*` | Required | CLIENT | `clientId` must match authenticated token |

## Secret policy

- `JWT_SECRET` required in production.
- `JWT_SECRET=cristalwater_secret` forbidden in production.
- `ADMIN_JWT_SECRET` if present must also be non-default in production.

## Validation checklist for release

1. Unauthenticated access to protected routes returns 401.
2. Authenticated wrong-role access returns 403.
3. Cross-client and cross-technician access attempts return 403.
4. Startup in production fails if JWT secret policy is violated.
5. Smoke test remains green after hardening.
