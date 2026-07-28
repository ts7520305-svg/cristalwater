# FCS-SEC-TECH-1.1 - Revisão Isolada Workday/Admin

Data: 2026-07-26
Escopo: apenas fluxo workday/admin (sem alterações de UX, navegação ou outros módulos).

## 1) Problema reproduzido de forma determinística (pré-correção)

Cenário reproduzido:
- Endpoint chamado: `POST /api/workday/start`
- Perfil: ADMIN autenticado
- Payload: `{ "userId": 987654321 }` (referência inexistente)

Evidência observada (pré-correção):
- Resposta HTTP: `200`
- Corpo: `{ "ok": false }`
- Log servidor: `PrismaClientKnownRequestError` com `code: P2003`
- Constraint FK: `TechnicianWorkDay_userId_fkey`
- Operação Prisma: `prisma.technicianWorkDay.create()`
- Escrita em BD para `userId=987654321`: não ocorreu (`beforeCount=0`, `afterCount=0`)

Conclusão pré-correção:
- Existia falso positivo de sucesso HTTP (200) após falha interna.

## 2) Causa raiz identificada

Endpoint exato:
- `src/routes/technicianWorkDayRoutes.js` (`POST /start`)

Razão do HTTP 200 indevido:
- O bloco `catch` da rota fazia `return res.json({ ok: false })` sem status explícito.
- Em Express, isso devolve status `200` por padrão.

Operação de falha:
- `src/business/technician/TechnicianWorkdayBusiness.js` em `startWorkday`
- `prisma.technicianWorkDay.create({ data: { userId, ... } })`
- `userId` inválido para a FK de `TechnicianWorkDay.userId -> User.id`.

## 3) Correção aplicada (isolada)

Ficheiros alterados:
- `src/routes/technicianWorkDayRoutes.js`
- `src/business/technician/TechnicianWorkdayBusiness.js`
- `scripts/test-fcs-sec-tech-workday.js` (nova suíte dedicada)
- `scripts/test-fcs-sec-tech-auth.js` (ajuste da suíte anterior para userId válido em workday)

Mudanças funcionais:
- Nunca devolver `200` após erro Prisma/negócio.
- Mapeamento de erros para status semânticos:
  - `404` para utilizador inexistente (`USER_NOT_FOUND`)
  - `422` para referência inválida (`INVALID_REFERENCE`) e payload inválido
  - `409` para conflito (`NO_ACTIVE_WORKDAY` ao encerrar sem jornada ativa, ou integridade)
  - `500` para erro inesperado
- Sucesso real:
  - `201` quando cria jornada nova
  - `200` quando idempotência detecta jornada já iniciada
- `startWorkday`, `endWorkday` e `getWorkdayStatus` com validação explícita de `userId` e utilizador ativo.
- Proteção de atomicidade via `prisma.$transaction` no fluxo.

## 4) Verificação de integridade e escrita

Validações executadas na suíte dedicada:
- status HTTP
- corpo de resposta (`ok`, `code`, `message`, `idempotent`)
- alteração real na base de dados quando sucesso
- ausência de alteração quando erro

Artefacto de execução:
- `reports/fcs-sec-tech-workday-1785059044502.json`

Resultado:
- Total: 7
- Pass: 7
- Fail: 0

Casos cobertos:
- admin com técnico válido (userId existente)
- admin com referência inexistente
- técnico sobre a própria jornada
- técnico sobre jornada alheia
- referência inválida
- payload inválido com `technicianId` sem `userId`
- repetição/idempotência

## 5) Revalidação da suíte completa anterior

Suíte executada após correção:
- `scripts/test-fcs-sec-tech-auth.js`

Artefacto:
- `reports/fcs-sec-tech-auth-1785059055945.json`

Resultado:
- Total: 22
- Pass: 22
- Fail: 0

Nota:
- Caso "admin can call workday start" agora aceita semântica correta de criação (`201`) além de idempotência (`200`) com validação de `body.ok=true`.

## 6) Logs pós-correção

Observação dos logs na execução pós-correção:
- Não foi observado `prisma:error` nos casos de sucesso (`201`/`200`) do workday.
- Casos inválidos geraram erros de negócio controlados (`WORKDAY_START_ERROR`) com resposta `404`/`422` e sem falso `200`.

## 7) Estado final FCS-SEC-TECH-1.1

- Autorização: mantida funcional.
- Integridade workday/admin: corrigida e comprovada com evidência de BD.
- Tratamento de erro: corrigido para status semânticos e sem falso sucesso.
- UX/reorganização: não iniciada (permanece bloqueada conforme diretriz).
