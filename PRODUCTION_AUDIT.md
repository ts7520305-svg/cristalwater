# PRODUCTION_AUDIT

Date: 2026-07-07
Mission ID: PRODUCTION-001
Scope: audit only, no deletion executed

## Summary

Crystal OS is not production-clean yet.

The workspace and live database contain multiple categories of non-production artifacts:
- automated test generators that create QA, stress, smoke, finance, customer, installation, repair, and construction data
- historical reports and logs with `localhost`, `127.0.0.1`, `example.com`, `.local`, `.test`, `QA`, `stress`, and `REAL-MES` markers
- a default seed path that is safe by default but still documents a local fallback admin email when `ADMIN_EMAIL` is absent
- legacy/demo cleanup scripts that archive demo data but do not fully delete test operational data

## Confirmed Production Keep Anchor

- Canonical administrator exists in the database:
  - email: `cristal.water@sapo.pt`
  - user id: `50`
  - role: `ADMIN`
- `.env` defines `ADMIN_EMAIL=cristal.water@sapo.pt`

## Database Evidence Found

Read-only sampling from the live database found test/demo data already persisted.

Counts matched by strong test/demo patterns:
- users: `22`
- technicians: `27`
- invoices: `6001`
- notifications: `126`
- repairs: `8`

Representative database examples:

Test customers / fake customers:
- `QA Real Condominio Azul REAL-MES-1783460194956`
- `QA Cliente 20260707210541`
- `Cliente Stress 500`
- emails such as `qa.real.0.REAL-MES-1783460194956@cliente.test`
- emails such as `cliente500@stress.cristalwater.local`

Test pools:
- `QA Real Piscina 1 REAL-MES-1783460194956`
- `QA Jacuzzi 20260707210541`
- `Piscina Stress 797`
- `Jacuzzi Stress 800`

Test visits:
- notes like `Servico concluido no teste real mensal REAL-MES-1783460194956`
- notes like `EDGE ph invalido REAL-MES-1783460194956`

Test invoices:
- `monthRef: QA-20260707210541`
- notes like `Fatura mensal do teste final FINAL2Y_202601_1783383381503`

Test notifications:
- messages referencing `QA Real Piscina 1 REAL-MES-1783460194956`

Test repairs:
- repair flows created by QA scripts and stress/monthly simulations

Test users and technicians:
- `Stress C1`, `Stress C2`
- `Tecnico Stress 13` through `Tecnico Stress 20`
- `QA Real Tecnico 1 REAL-MES-...`

## Audit Findings By Category

### 1. Test customer data

Found in:
- live database `Client`
- test generators under [scripts/test-real-month-flow-api.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/scripts/test-real-month-flow-api.js)
- stress generators under [scripts/reset-and-seed-stress-real-db.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/scripts/reset-and-seed-stress-real-db.js)
- other operational scripts under `scripts/test-*.js`

Markers found:
- `QA`
- `REAL-MES-`
- `Stress`
- `customer-os-`
- `example.com`
- `.local`
- `.test`

### 2. Test pool data

Found in:
- live database `Pool`
- test generators under operational and monthly scripts

Markers found:
- `QA Piscina`
- `QA Real Piscina`
- `Jacuzzi Stress`
- `Rua QA`
- `Rua de Teste`

### 3. Test visit data

Found in:
- live database `ServiceVisit` and `Visit`
- monthly flow and core-flow scripts

Markers found:
- `teste real mensal`
- `EDGE`
- `QA`

### 4. Test invoice and payment data

Found in:
- live database `Invoice`, `InvoiceLine`, `Payment`
- finance test scripts

Markers found:
- `QA-...` in `monthRef`
- notes containing `teste final`
- finance users `fin-ops-*` and `fin-acc-*` with `@example.com`

### 5. Test notification data

Found in:
- live database `Notification`
- finance/customer/monthly scripts

Markers found:
- messages tied to QA entities
- smoke messages and visit requests

### 6. Test repair data

Found in:
- live database `Repair`
- [scripts/test-repair-os-operational.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/scripts/test-repair-os-operational.js)
- monthly simulation scripts

Markers found:
- `QA Repair`
- `Problema real QA`

### 7. Test installation data

Found in code surface:
- [src/business/installation/InstallationBusiness.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/src/business/installation/InstallationBusiness.js)
- [src/dal/InstallationRepository.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/src/dal/InstallationRepository.js)

Important implementation detail:
- installation workflows are persisted in `OperationalLock`, not in a dedicated `Installation` Prisma model
- stock reservations for installation are stored as `OperationalLock` rows with `entity: Installation` and installation-related lock types

Test generators found:
- [scripts/test-installation-os-operational.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/scripts/test-installation-os-operational.js)
- [scripts/test-installation-os-full-operational.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/scripts/test-installation-os-full-operational.js)

### 8. Test construction data

Found in code surface:
- [src/business/construction/ConstructionBusiness.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/src/business/construction/ConstructionBusiness.js)
- [src/dal/ConstructionRepository.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/src/dal/ConstructionRepository.js)

Important implementation detail:
- construction workflows are also persisted in `OperationalLock`, using `entity: ConstructionProject`

Test generators found:
- [scripts/test-construction-os-operational.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/scripts/test-construction-os-operational.js)

### 9. Demo data and fake data

Found in:
- [scripts/cleanup-demo-data.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/scripts/cleanup-demo-data.js)
- audit scripts that explicitly forbid `Cliente Demo`, `Piscina Demo`, `Técnico Demo`, `Cliente WOW`, `Portal WOW`

Meaning:
- the repo already acknowledges that demo/test labels have existed in the environment

### 10. Lorem ipsum

No strong evidence found in the targeted audit results gathered for this mission.

### 11. Localhost / local environments

Found in:
- multiple test scripts and reports
- `http://localhost:3002`
- `http://127.0.0.1:3002`
- `.local` test domains
- `.test` test domains

Examples:
- [scripts/test-real-month-flow-api.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/scripts/test-real-month-flow-api.js)
- [scripts/smoke-test.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/scripts/smoke-test.js)
- generated reports under `reports/`

### 12. Example.com / test email

Found in:
- finance/customer/equipment scripts
- test files under `tests/`
- logs from executed scripts

Examples:
- `customer-os-...@example.com`
- `fin-ops-...@example.com`
- `fin-acc-...@example.com`
- `ana@example.com`

### 13. Development routes

No dedicated production-danger development route was confirmed in the code sample set for this mission.

But there are non-production test surfaces and QA pages/scripts, including:
- `frontend/admin-test-center.html`
- multiple `scripts/test-*.js`

These are not production API blockers by themselves, but they are non-production assets that should not be confused with live operational data.

### 14. Development flags

Found:
- `ENABLE_DEMO_SEED` in [prisma/seed.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/prisma/seed.js)
- `PRISMA_DEBUG` in [src/prismaClient.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/src/prismaClient.js)
- `NODE_ENV` checks in deployment and preflight scripts

Assessment:
- default seed behavior is safe because demo seed is off by default
- debug logging is environment-gated, not forced on in production

### 15. Debug mode

Found:
- Prisma query/info logging activates only when `PRISMA_DEBUG=true`
- postinstall and dependency debug references under `node_modules/` are not application logic

Assessment:
- no evidence that the live app is currently forced into debug mode by source default

### 16. Seed data

Found in:
- [prisma/seed.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/prisma/seed.js)

Assessment:
- current seed only guarantees admin creation by default
- fallback local admin email remains documented as `admin@cristalwater.local` when env vars are absent
- demo seed requires explicit `ENABLE_DEMO_SEED=true`

## Production Risks From Audit

1. The live database already contains large volumes of QA/stress/test entities and related operational artifacts.
2. Installation and construction test workflows are not isolated in dedicated tables; they are mixed into `OperationalLock` and must be filtered carefully.
3. A naive cleanup could delete real operational history if it relies on broad words like `test` alone.
4. Reports, logs, and backups contain historical non-production references and should not be treated as current operational truth.

## Audit Conclusion

Crystal OS requires a controlled production cleanup before being considered production-clean.

The cleanup must be pattern-based, relation-aware, confirmation-gated, and must preserve:
- the canonical administrator `cristal.water@sapo.pt`
- system configuration
- permission structures
- templates/configuration assets
- inventory and database catalogs
- company/strategic documents