# RC1 Bug Tracker

## Abertos
| ID | Data | Modulo | Prioridade | Descricao | Estado |
|----|------|--------|------------|-----------|--------|


## Validacoes Pendentes
| ID | Data | Modulo | Tipo | Prioridade | Descricao | Estado | Observacao |
|----|------|--------|------|------------|-----------|--------|------------|


## Resolvidos
| ID | Data | Modulo | Prioridade | Commit | Descricao |
|----|------|--------|------------|--------|-----------|
| RC1-002 | 2026-07-20 | Tecnico Campo / Core Visits | P1 | N/A | Autorizacao ajustada para permitir perfil TECNICO em `POST /api/core/visits/:id/problem` e `POST /api/core/visits/:id/complete` no fluxo de campo. Validado com `npm run check:syntax`, `QA_ENVIRONMENT_SAFE=true UPLOAD_DIR=uploads/qa/rc1 npm test` (52/52) e `npm run smoke`. |
| RC1-001 | 2026-07-19 | Auth Cliente | N/A | N/A | Validacao de login cliente executada com credencial QA criada por fluxo Admin; login real confirmado com sucesso. |

## Convencao de IDs
- RC1-001
- RC1-002
- RC1-003
- ...

## Regras de Tratamento
- Classificar todo bug em P0, P1, P2 ou P3.
- Corrigir prioritariamente P0 e P1.
- Corrigir P2 e P3 apenas quando nao introduzirem risco.

## Checklist Pos-Correcao
- Atualizar este ficheiro com o estado do bug.
- Executar `npm run check:syntax`.
- Executar `QA_ENVIRONMENT_SAFE=true UPLOAD_DIR=uploads/qa/rc1 npm test`.
- Executar `npm run smoke`.
- Nao fazer commit automaticamente.

## Resumo Atual
- Bugs abertos: 0
- Validacoes pendentes: 0
- Bugs resolvidos: 2