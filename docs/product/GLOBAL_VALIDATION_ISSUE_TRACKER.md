# GLOBAL_VALIDATION_ISSUE_TRACKER

Data base: 2026-07-21
Fase: Validacao Global
Estado: ATIVO

## Issues Ativas
| ID | Data | Perfil | Acao | Resultado esperado | Resultado real | Hora | Dispositivo | Evidencia | Severidade | Classificacao | Estado | Produto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GV-V001 | 2026-07-21 | Automacao | `test:interconnections` | Fluxo de interligacoes executa sem falhas de auth | `POST /api/core/technicians -> 401 Sem token` | N/D | Ambiente automatizado local | `reports/real-month-flow-REAL-MES-1784610525048-FAILED.json` | P2 | SCRIPT LEGACY INCOMPATIVEL COM AUTENTICACAO ATUAL | PENDENTE DE ATUALIZACAO DO TESTE | Nao e bug funcional de produto confirmado |
| GV-V002 | 2026-07-21 | Automacao | `test:route-os-acceptance` | Fluxo Route OS cria cliente/piscina/visita com auth valida | Falha de autenticacao ao criar cliente (`POST /api/clients`) | N/D | Ambiente automatizado local | Log do comando + `scripts/test-route-os-acceptance.js` | P2 | SCRIPT LEGACY INCOMPATIVEL COM AUTENTICACAO ATUAL | PENDENTE DE ATUALIZACAO DO TESTE | Nao e bug funcional de produto confirmado |

## Template de registo (campo humano)
| ID | Data | Perfil | Acao | Resultado esperado | Resultado real | Hora | Dispositivo | Evidencia | Severidade | Classificacao | Estado | Produto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GV-V### | AAAA-MM-DD | Admin/Tecnico/Cliente | Acao executada | Comportamento esperado | Comportamento observado | HH:MM | Modelo + OS + rede | screenshot/video/log | P0/P1/P2/P3 | Bug funcional / Script / Operacao | Aberto/Pendente/Resolvido | Confirmado/Nao confirmado |

## Regras desta fase
- Nao declarar bug funcional ate reproducao no produto atual.
- Nao iniciar Grupo 6.
- Nao adicionar funcionalidades.
- Nao alterar paginas congeladas.
- Durante os 5-7 dias de campo: P0/P1 corrigir imediatamente; P2/P3 apenas registrar.
