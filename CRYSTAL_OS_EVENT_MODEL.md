# CRYSTAL OS Event Model

Data: 2026-07-26
Estado: modelo canónico de eventos do sistema.
Objetivo: unificar alertas, notificações, histórico e IA numa linguagem única de eventos.

## 1) Contrato mínimo de evento

Todos os eventos devem incluir:
1. eventId
2. eventType
3. occurredAt
4. actorType (TECHNICIAN, ADMIN, SYSTEM)
5. actorId
6. subjectType (VISIT, POOL, PROBLEM, ALERT, DOCUMENT, GUIDE, WORKDAY)
7. subjectId
8. priority (P1, P2, P3, P4 quando aplicável)
9. statusBefore
10. statusAfter
11. metadata
12. correlationId (cadeia operacional)

## 2) Eventos canónicos iniciais

### Visita

- VISIT_STARTED
- VISIT_CHECKIN_COMPLETED
- VISIT_PROGRESS_UPDATED
- VISIT_COMPLETED
- VISIT_NOT_COMPLETED
- VISIT_DELAYED

### Problema

- PROBLEM_CREATED
- PROBLEM_PRIORITY_CHANGED
- PROBLEM_ASSIGNED
- PROBLEM_RESOLVED
- PROBLEM_REOPENED

### Água aberta

- WATER_OPENED
- WATER_CLOSURE_STARTED
- WATER_CLOSED
- WATER_ESCALATED

### Bomba manual

- PUMP_MANUAL_ENABLED
- PUMP_MANUAL_VALIDATION_STARTED
- PUMP_MANUAL_DISABLED
- PUMP_MANUAL_ESCALATED

### Ficha técnica

- TECHNICAL_CHANGE_PROPOSED
- TECHNICAL_CHANGE_UPDATED
- TECHNICAL_CHANGE_APPROVED
- TECHNICAL_CHANGE_REJECTED

### Alertas

- ALERT_CREATED
- ALERT_ASSIGNED
- ALERT_CONFIRMED
- ALERT_ESCALATED
- ALERT_RESOLVED
- ALERT_CLOSED

### Documentos e guias

- VEHICLE_DOCUMENT_CONTEXT_CHANGED
- DOCUMENT_STATUS_CHANGED
- GUIDE_OPENED
- GUIDE_CONSUMPTION_REGISTERED
- GUIDE_CLOSED

### Jornada e sincronização

- WORKDAY_STARTED
- WORKDAY_ENDED
- OFFLINE_MODE_ENTERED
- OFFLINE_QUEUE_FLUSH_STARTED
- OFFLINE_QUEUE_FLUSH_COMPLETED
- OFFLINE_QUEUE_ITEM_FAILED

## 3) Responsabilidade e rastreabilidade

Para eventos de alerta e criticidade, guardar adicionalmente:
1. createdBy
2. assignedTo
3. receivedBy
4. confirmedBy
5. resolvedBy
6. resolvedAt

Regra:
- se algum campo estiver ausente em evento crítico, o evento não pode ser marcado como encerrado.

## 4) Consumidores obrigatórios do modelo de eventos

1. Motor Central de Alertas
2. Timeline operacional (histórico)
3. Notificações internas
4. Centro de Comando do Administrador
5. Assistente de IA contextual
6. Auditoria e compliance

## 5) Regras de integração

1. Nenhum módulo pode criar nomes de evento fora deste catálogo sem revisão.
2. alertas, notificações e IA não devem inferir estado por scraping de UI; devem consumir eventos.
3. statusBefore e statusAfter são obrigatórios em toda transição de estado.
4. Eventos devem ser idempotentes por eventId.
5. Eventos em modo offline devem manter ordenação por occurredAt e correlationId no flush.

## 6) Mapeamento rápido evento -> reação

| Evento | Reação principal |
|---|---|
| WATER_OPENED | Criar alerta crítico persistente e interromper fluxo operacional. |
| PUMP_MANUAL_ENABLED | Subir cartão P0 no Centro Operacional e iniciar SLA. |
| PROBLEM_CREATED | Inserir fila por prioridade P1-P4 e atribuir owner. |
| TECHNICAL_CHANGE_PROPOSED | Criar pendência de aprovação no Centro de Comando. |
| DOCUMENT_STATUS_CHANGED (Vencido) | Bloquear ação dependente e sinalizar mitigação. |
| OFFLINE_MODE_ENTERED | Mostrar estado local e ativar fila de sincronização. |

## 7) Gate de evolução do modelo

Qualquer novo evento exige:
1. definição de eventType
2. regra de prioridade
3. consumidores afetados
4. impacto em alertas, histórico e IA
5. casos de teste de criação e consumo

Sem este gate, o evento não entra em produção.
