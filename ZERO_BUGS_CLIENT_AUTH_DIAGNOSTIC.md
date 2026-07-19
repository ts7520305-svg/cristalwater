# ZERO BUGS Client Auth Diagnostic

Mission: CRYSTAL-OS-ZERO-BUGS-001  
Blocker: TEST_SETUP_CLIENT_AUTH_FAILED  
Timestamp: 2026-07-11

## Phase 1 - Read-only auth contract audit

### Route and execution path

- Route mounted at [src/server.js](src/server.js#L248): `mount("/api/client-auth", clientAuthRoutes)`
- Login endpoint implemented directly in [src/routes/clientAuthRoutes.js](src/routes/clientAuthRoutes.js#L16): `router.post("/login", ...)`
- There is no controller/business layer used by this active route path for `/api/client-auth/login`.

Note:
- [src/controllers/clientAuthController.js](src/controllers/clientAuthController.js) exists but is not used by the mounted `/api/client-auth/login` route.

### Request payload contract

From [src/routes/clientAuthRoutes.js](src/routes/clientAuthRoutes.js#L19):
- Required fields in body:
  - `email`
  - `password`

If either is missing:
- HTTP status: `200`
- Response: `{ ok: false, message: "Email e password obrigatórios" }`

### Database lookup and required records

From [src/routes/clientAuthRoutes.js](src/routes/clientAuthRoutes.js#L31):
- Lookup: `prisma.client.findFirst({ where: { email } })`

Required for success:
- A `Client` record with matching `email`
- `client.password` must be present/truthy
- `bcrypt.compare(password, client.password)` must return true

### Conditions explicitly checked in active route

Checked:
- `email` present
- `password` present
- client exists by `email`
- client has `password`
- bcrypt password comparison true

Not checked in active route:
- `client.active`
- `client.status`
- `client.deletedAt`
- `ClientAccess` relation
- `mustChangePassword`
- tenant/company relation
- paused/portal-enabled flags

### Email normalization

Active route does not normalize email (no trim/lowercase before query); it uses the received value directly in `where: { email }`.

### Password hashing/comparison implementation

- Comparison function in active route: `bcrypt.compare(password, client.password)` ([src/routes/clientAuthRoutes.js](src/routes/clientAuthRoutes.js#L41)).
- Expected hash format: bcrypt-compatible (observed prefix `$2b$...`).

### Successful response contract

On success, active route returns:
- HTTP status: `200`
- Body shape:
  - `ok: true`
  - `token: <jwt>`
  - `client: { id, name, email, role, language }`

Token property name expected by runner: `token`.

## Phase 2 - Controlled reproduction (disposable only)

Prefix used:
- `ZERO-BUGS-AUTH-DIAG-20260711220155`

Disposable diagnostic client (created by Prisma in runner process):
- created client ID: `22`
- stored email: `zero-bugs-auth-diag-20260711220155@cristalwater.pt`
- normalized email: same lowercase value
- active: `true`
- status: `ACTIVE`
- deletedAt: `null`
- password hash present: `true`
- hash prefix: `$2b$10$`
- local bcrypt compare (runner process): `true`
- related `ClientAccess` records: `0`

Login tests against real endpoint `/api/client-auth/login`:
1. Exact stored email + correct password:
- status `200`, `ok:false`, message `Credenciais inválidas`
2. Lowercase email + correct password:
- status `200`, `ok:false`, message `Credenciais inválidas`
3. Correct email + incorrect password:
- status `200`, `ok:false`, message `Credenciais inválidas`
4. Missing password:
- status `200`, `ok:false`, message `Email e password obrigatórios`
5. Inactive client (disposable record only):
- status `200`, `ok:false`, message `Credenciais inválidas`

Additional consistency probe (same run):
- API admin query for `/api/clients/:id` returned `id=22` successfully.

Stronger ID collision probe with another disposable record:
- Runner created client `id=24` with unique email `zero-bugs-auth-check-...`
- API query `/api/clients/24` returned client email `cliente024@stress.cristalwater.local` (different record)
- Same run login for runner-created credentials still returned `Credenciais inválidas`

This demonstrates ID overlap across distinct data contexts.

## Phase 3 - Root-cause classification

Classification: **D. ENVIRONMENT_OR_PROCESS_MISMATCH**

Reasoning:
- Runner-created disposable client is readable and bcrypt-valid in runner context.
- Real API login does not authenticate it.
- API `/api/clients/:id` can return a different record for the same numeric ID generated in runner context.
- Therefore, runner write path and API read/auth path are not aligned to the same effective data context.

### Safe environment consistency fingerprint (redacted)

Runner-side DB session:
- db fingerprint: `cri***07`
- user fingerprint: `pos***es`

API process on port `3002`:
- pid: `221434`
- `DATABASE_URL` fingerprint: scheme `postgresql`, host `aws***om`, db `pos***es`, port `6543`
- `DIRECT_URL` fingerprint: scheme `postgresql`, host `aws***om`, db `pos***es`, port `5432`

No secrets, passwords, JWTs, full hashes, or connection strings were exposed.

## Phase 4 - Permitted correction decision

Per CTO rule:
- For classification C or D, do not modify backend/API/environment/database configuration.

Action taken:
- **No additional code fix applied** in this order.
- Runner/backend/auth contracts left unchanged.

## Cleanup verification

Diagnostic cleanup executed for disposable records only:
- diagnostic client removed: yes
- related diagnostic `ClientAccess` removed: yes (none existed; safe delete attempted)
- no orphan from diagnostic record: verified
- real clients unchanged: no non-prefixed deletes were executed
- administrator unchanged: no admin modifications performed

## Runner blocker status

- Previous blocker `Prisma update not found` had already been passed in prior step.
- Current blocker `TEST_SETUP_CLIENT_AUTH_FAILED` is explained by environment/process mismatch.
- No further runner/frontend-only safe fix can resolve this without environment alignment.

## Confidence

Confidence: **High**

Basis:
- Active login contract inspected directly in mounted route.
- Controlled disposable reproductions repeated.
- Local bcrypt validation succeeds while endpoint auth fails.
- Cross-check showed ID collision with different API-visible email, confirming mismatch of effective data context.

## Environment Alignment Outcome (CRYSTAL-ENV-ALIGNMENT-001)

Status: RESOLVED

What changed:
- Process-only correction was executed on PM2 app `cristalwater` (id `0`) using:
  - `pm2 restart 0 --update-env`
  - `pm2 restart ecosystem.config.js --only cristalwater --update-env`

Why:
- PM2 process environment was stale and still pointed to database `postgres` instead of approved target `cristalwater_production_20260707`.

Post-fix proof:
- API and runner URL fingerprints now match exactly.
- API and runner read-only count fingerprints now match.
- Disposable auth verification (`ZERO-BUGS-ENV-VERIFY-...`) succeeded end-to-end:
  - same client ID/email from runner and API
  - `/api/client-auth/login` returned `ok:true` and token present
  - disposable cleanup succeeded with no orphan for that record.
