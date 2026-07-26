# FCS Technician Operations Block 1 Report (2026-07-26)

## 1) Scope and decision gate

Block covered: Centro Operacional do Técnico (only).

Not covered in this block by design:
- Centro de Comando do Administrador.
- Motor Central de Alertas (push com app fechada, repetição automática, escalonamento global, entrega externa persistente).

Status for approval gate: **STRICT GATE GREEN - PENDING FINAL REVIEW**.

---

## 2) Files changed

- [frontend/technician-field-mode.html](frontend/technician-field-mode.html)
- [frontend/technician-field-mode.js](frontend/technician-field-mode.js)
- [scripts/test-fcs-technician-operations-block1.js](scripts/test-fcs-technician-operations-block1.js)

---

## 3) Implemented behavior in Block 1

### 3.1 Fixed navigation aligned to blueprint

Implemented fixed tabs:
- Hoje
- Agora
- Mapa
- Documentos
- Mais

What changed:
- Removed duplicate button `Menu` from fixed bottom navigation.
- `Mapa` now opens existing technician map subflow (`/technician-map`) without creating new module.

### 3.2 Initial state policy

Implemented startup policy:
- Default entry after login: `Hoje`.
- If active intervention exists: open `Agora`.
- If P0 interruption exists without active intervention: keep `Hoje` and surface mandatory interruption at top.

### 3.3 P0 interruption board with pump manual

Interruption board now includes:
- Água aberta.
- Urgências.
- Documentação crítica.
- **Bomba em manual (P0)** with:
  - quem ativou;
  - piscina;
  - duração;
  - estado;
  - ação disponível (CTA para abrir problema P0).

### 3.4 Dependency transparency (no fake backend)

When backend feed for pump-manual metadata is incomplete/missing, UI now shows explicit dependency item as pending, instead of declaring feature fully implemented.

### 3.5 Alert engine boundary respected

This block validates in-app presentation only.
The following are explicitly **not declared as implemented** here:
- push delivery with app closed;
- repetition/escalation engine;
- external persistence and guaranteed delivery chain.

Those stay assigned to Motor Central de Alertas.

---

## 4) Automated tests and results

## 4.1 Syntax

Command:
- `npm run check:syntax`

Result:
- PASS

## 4.2 Dedicated Playwright (Block 1)

Command:
- `node scripts/test-fcs-technician-operations-block1.js`

Artifacts:
- [reports/fcs-technician-operations-block1-1785063005289.json](reports/fcs-technician-operations-block1-1785063005289.json)
- [reports/fcs-technician-operations-block1-1785066612374.json](reports/fcs-technician-operations-block1-1785066612374.json)
- [reports/fcs-technician-operations-block1-1785068765658.json](reports/fcs-technician-operations-block1-1785068765658.json)

Latest strict summary:
- Total checks: 66
- Passed: 66
- Failed: 0
- Overall: PASS

Strict gate notes:
- `refresh-apos-retorno-filtro` restored to strict behavior: DOM and persisted state must both stay `IN_PROGRESS` after `mapa -> voltar -> refresh`.
- `refresh-apos-retorno-lista-corresponde-filtro` added: list rendering must match `IN_PROGRESS` filter after refresh.
- Removed tolerance that accepted fallback `TODO`.

Historical note:
- Earlier run had 34/36 PASS and exposed continuity blockers.
- Intermediate run with tolerance was invalidated for final gate purposes.
- Latest strict run closes the continuity requirement (`mapa -> voltar -> refresh` preserving active filter) on desktop, mobile 390x844, and Pixel 7.

Validated scenarios in script:
- login técnico (API session creation + in-app technician session priming);
- Hoje opens correctly;
- Por fazer / Em curso / Concluídas segmentation;
- Agora shows active intervention context;
- P0 card rises to top;
- fixed navigation Hoje/Agora/Mapa/Documentos/Mais;
- no private terms exposed in technician screen;
- open visit and return flow verification;
- mobile 390x844;
- Pixel 7;
- no console errors;
- no API errors.

Current failing checks:
- None in the dedicated Block 1 suite.

## 4.3 Security suite on dedicated server (required)

Execution performed exactly as requested:
1. Start server on port 3010.
2. Run `test-fcs-sec-tech-auth.js`.
3. Stop server.

Artifacts:
- [reports/fcs-sec-tech-auth-1785063053770.json](reports/fcs-sec-tech-auth-1785063053770.json)
- [reports/fcs-sec-tech-auth-1785068809356.json](reports/fcs-sec-tech-auth-1785068809356.json)

Result:
- PASS 22/22

## 4.4 Global regressions (baseline comparison)

Compared clean baseline (worktree at HEAD, no local Block 1 changes) vs current workspace.

Command pairs:
- `npm run test:v21-frontend`
- `npm run test:navigation-audit`

Outcome:
- Same failures in baseline and current.
- No new delta introduced by Block 1 on those two global suites.

Preexisting baseline failures confirmed:
- `FAIL: missing cw-auth include: crystal-os-v2-route-index.html`
- Missing global admin shell in navigation audit:
  - admin-master-control.html
  - admin-clients.html
  - admin-pools.html
  - admin-technicians.html
  - admin-rounds.html
  - admin-visits.html
  - admin-inventory.html

---

## 5) Screenshots (desktop/mobile)

- [docs/product/evidence/fcs-technician-operations-block1/block1-desktop.png](docs/product/evidence/fcs-technician-operations-block1/block1-desktop.png)
- [docs/product/evidence/fcs-technician-operations-block1/block1-mobile390.png](docs/product/evidence/fcs-technician-operations-block1/block1-mobile390.png)
- [docs/product/evidence/fcs-technician-operations-block1/block1-pixel7.png](docs/product/evidence/fcs-technician-operations-block1/block1-pixel7.png)

---

## 6) Functionalities still pending outside Block 1 scope

1. Keep Alert Engine claims restricted:
- no claim of persistent external alert delivery in this block.
- full push/retry/escalation remains pending Motor Central de Alertas.

---

## 7) New vs preexisting regressions

New regressions from this block:
- None proven in global frontend continuity / navigation audit suites.

Preexisting regressions (external baseline):
- cw-auth include gap in route index page.
- admin shell coverage gaps in navigation audit.

---

## 8) Stop point

Execution stopped here for review, without starting Administrator block.
