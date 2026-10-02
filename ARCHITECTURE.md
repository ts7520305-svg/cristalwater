# ARCHITECTURE

Cristal Platform é dividida em:

- src/core: Crystal Kernel
- src/system: Crystal Brain
- src/routes: APIs existentes
- src/services: serviços atuais
- frontend: aplicação web

Regra principal:
Toda nova funcionalidade deve usar Kernel + Brain quando aplicável.

## Estrutura confirmada no checkout de 02/10/2026

- `src/server.js`: Express, registo de routers, páginas e ficheiros públicos; uploads têm proteções específicas por família.
- `src/routes` / `src/controllers`: contratos HTTP e delegação; `src/business`: operações dos domínios Admin, Técnico, Cliente, piscina, visita, finanças, inventário, instalação e construção.
- `src/services`: serviços partilhados; `src/core`: Kernel, eventos, permissões, workflows e infraestrutura; `src/system`: Brain.
- `prisma/schema.prisma` e migrações: persistência PostgreSQL via Prisma. Não alterar schema sem necessidade demonstrada.
- `frontend`: HTML/JS/CSS existentes, guards de sessão, localização, service worker e filas/rascunhos offline; código próprio dos formulários geridos tem precedência sobre a memória genérica.
- `tests`: Vitest; `scripts/test-field-*.js`: jornadas/API/browser e runner integrado. `.github/workflows/field-readiness.yml` usa Node24/PostgreSQL16, migrações, unitários/browser, suite e restauro isolado.

Conservar a ordem Controller → Business → Services → Kernel/Prisma quando aplicável, sem reorganizar os domínios por este inventário. Documentos especializados existentes mantêm autoridade sobre decisões de cada módulo. Estado e próxima ação: `PROJECT_STATE.md`; backlog detalhado: `docs/product/COMPLETION_PLAN_20260928.md`.
