# FCS-SEC-TECH-1 - Test Report

Data: 2026-07-26T09:35:32.924Z
Base URL de teste: http://127.0.0.1:3010
Resultado global: 22/22 PASS, 0 FAIL
Runtime: 7954 ms
Artefacto bruto: reports/fcs-sec-tech-auth-1785058532924.json

## Matriz executada

| Caso | Esperado | Obtido | PASS | Detalhes |
|---|---:|---:|---|---|
| anon /api/technician-intake/settings | 401 | 401 | YES |  |
| anon /api/workday/start | 401 | 401 | YES |  |
| anon /api/gps/update | 401 | 401 | YES |  |
| anon /api/technicians | 401 | 401 | YES |  |
| invalid token /api/technicians | 401 | 401 | YES |  |
| expired token /api/technician/today | 401 | 401 | YES |  |
| tech cannot list technicians | 403 | 403 | YES |  |
| tech cannot access intake pending-review | 403 | 403 | YES |  |
| tech cannot approve intake | 403 | 403 | YES |  |
| tech cannot access billing technician-profit | 403 | 403 | YES |  |
| admin can access billing technician-profit | 200 | 200 | YES |  |
| tech cannot read other technician visit | 403 | 403 | YES |  |
| tech can read own visit | 200 | 200 | YES |  |
| tech cannot start workday for another technician | 403 | 403 | YES |  |
| tech cannot read workday status of another technician | 403 | 403 | YES |  |
| tech cannot spoof gps userId | 403 | 403 | YES |  |
| tech cannot spoof intake technicianId | 403 | 403 | YES |  |
| tech today endpoint enforces own technician scope | 200 | 200 | YES | scoped=true |
| admin can list technicians | 200 | 200 | YES |  |
| admin can read intake pending-review | 200 | 200 | YES |  |
| admin can call workday start | 200 | 200 | YES |  |
| admin can call gps update | 200 | 200 | YES |  |

## Conclusões

- Todos os testes negativos e positivos previstos nesta fase passaram.
- O bloqueio por perfil técnico em endpoints administrativos e financeiros foi confirmado em runtime.
- Ownership backend crítico (workday/gps/intake spoofing e visita não atribuída) foi validado com 403.