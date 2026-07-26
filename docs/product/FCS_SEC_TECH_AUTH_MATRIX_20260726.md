# FCS-SEC-TECH-1 - Auth Matrix e Inventário Técnico

Data: 2026-07-26T09:35:50.904Z
Escopo: inventário técnico completo + matriz de autorização backend para endpoints críticos.
Implementação UX/layout: não iniciada nesta fase.

## 1) Inventário técnico completo (technician*.html)

| Rota | Ficheiro | Na tabela oficial V2 | Papéis na tabela | Classificação | Funções únicas / decisão |
|---|---|---|---|---|---|
| /technician-chat | frontend/technician-chat.html | NÃO | N/A | alias legado | Páginas legadas não cobertas pela tabela V2; manter até migração controlada por risco de função única. |
| /technician-field-mode | frontend/technician-field-mode.html | SIM | TECHNICIAN, ADMIN | canonica | Núcleo operacional técnico com execução ponta a ponta. |
| /technician-gps | frontend/technician-gps.html | SIM | TECHNICIAN, ADMIN | subfluxo | Subfluxo funcional do núcleo técnico. |
| /technician-guide | frontend/technician-guide.html | SIM | TECHNICIAN, ADMIN | subfluxo | Subfluxo funcional do núcleo técnico. |
| /technician-history | frontend/technician-history.html | NÃO | N/A | alias legado | Páginas legadas não cobertas pela tabela V2; manter até migração controlada por risco de função única. |
| /technician-login | frontend/technician-login.html | SIM | PUBLIC | canonica | Entrada de autenticação dedicada do técnico. |
| /technician-map | frontend/technician-map.html | SIM | TECHNICIAN, ADMIN | subfluxo | Subfluxo funcional do núcleo técnico. |
| /technician-new-client | frontend/technician-new-client.html | SIM | TECHNICIAN, ADMIN | subfluxo | Subfluxo funcional do núcleo técnico. |
| /technician-profile | frontend/technician-profile.html | NÃO | N/A | alias legado | Páginas legadas não cobertas pela tabela V2; manter até migração controlada por risco de função única. |
| /technician-profit-dashboard | frontend/technician-profit-dashboard.html | SIM | TECHNICIAN, ADMIN | removivel | Financeiro fora do domínio técnico; agora bloqueado para técnico. |
| /technician-profit | frontend/technician-profit.html | SIM | TECHNICIAN, ADMIN | removivel | Financeiro fora do domínio técnico; agora bloqueado para técnico. |
| /technician-route | frontend/technician-route.html | SIM | TECHNICIAN, ADMIN | subfluxo | Subfluxo funcional do núcleo técnico. |
| /technician-visit | frontend/technician-visit.html | SIM | TECHNICIAN, ADMIN | subfluxo | Subfluxo funcional do núcleo técnico. |
| /technician | frontend/technician.html | SIM | ADMIN | alias legado | Páginas legadas não cobertas pela tabela V2; manter até migração controlada por risco de função única. |

### Nota sobre rotas fora da matriz das 9
- `/technician`, `/technician-history`, `/technician-profile`, `/technician-chat` existem no frontend e são acessíveis por ligação direta porque o servidor publica todas as páginas `frontend/*.html`.
- Estas rotas não aparecem como "Technician Menu" na tabela V2 atual; por isso foram classificadas como aliases legados com risco funcional e não serão removidas sem migração assistida.

## 2) Matriz de autorização aplicada (FCS-SEC-TECH-1)

| Endpoint | Situação anterior | Regra aplicada agora | Ownership backend |
|---|---|---|---|
| `/api/technician-intake/*` | sem auth explícita | auth obrigatório + roles TECHNICIAN/ADMIN para create/settings, ADMIN para pending-review/approve | técnico não pode agir em nome de outro técnico |
| `/api/workday/*` | sem auth explícita | auth obrigatório + roles TECHNICIAN/ADMIN | técnico só pode operar o próprio `userId` |
| `/api/gps/update` | sem auth explícita | auth obrigatório + roles TECHNICIAN/ADMIN | técnico não pode publicar para outro `userId`; live feeds admin-only |
| `/api/technicians/*` | CRUD potencialmente sem guard | auth ADMIN obrigatório em toda a rota | N/A (admin scope) |
| `/api/billing/technician-profit` | ADMIN-only (já existente) | mantido ADMIN-only | técnico bloqueado 403 |

## 3) Regras de segurança confirmadas

- Sem token: 401 nas rotas críticas testadas.
- Token inválido/expirado: 401 confirmado.
- Perfil incorreto: 403 confirmado (incluindo acesso técnico a endpoints admin).
- Ownership técnico: 403 ao tentar usar `userId`/`technicianId` de outro técnico em workday/gps/intake.
- Endpoints financeiros permanecem ADMIN-only e páginas `technician-profit*` foram bloqueadas ao perfil técnico por guard/admin role marker.