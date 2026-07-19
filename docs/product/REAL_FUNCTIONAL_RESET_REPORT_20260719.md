# REAL FUNCTIONAL RESET REPORT — 2026-07-19

## 1) Objetivo e Escopo Aplicado
Reset funcional real executado para manter apenas:
- administrador canónico `cristal.water@sapo.pt`;
- utilizador ADMIN ativo e respetivas credenciais/permissões;
- schema, migrations e estrutura de tabelas;
- configurações técnicas essenciais ao arranque;
- código/ficheiros do sistema;
- backups validados.

Todos os restantes dados comerciais/operacionais foram alvo de limpeza, incluindo técnicos, clientes, piscinas, rondas, visitas, produtos, stock, fornecedores, viaturas, faturação/pagamentos, mensagens, notificações, anexos e históricos operacionais.

## 2) Confirmação de Backup Restaurável (pré-execução)
Backup validado e mantido disponível:
- ficheiro: `backups/pre-client-domain-reset-20260719.dump`
- checksum SHA-256: `2bdad5b5263bd6009dc22cfac081a42c5106834ac57e417f7318af3cdf8df2b5`
- estado: confirmado novamente antes da execução.

## 3) Script e Guardas de Execução
Script atualizado:
- `scripts/cleanup-client-pool-domain.js`

Guardas exigidas (mantidas):
- `REAL_FUNCTIONAL_RESET_CONFIRMED=true`
- `RESET_CONFIRMATION=DELETE_ALL_BUSINESS_DATA_KEEP_ADMIN_20260719`

Comando real executado:

```bash
cd /home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend && \
QA_ENVIRONMENT_SAFE=true \
UPLOAD_DIR=uploads/qa/full-functional-20260719 \
REAL_FUNCTIONAL_RESET_CONFIRMED=true \
RESET_CONFIRMATION=DELETE_ALL_BUSINESS_DATA_KEEP_ADMIN_20260719 \
node scripts/cleanup-client-pool-domain.js --execute
```

## 4) Dry-Run Atualizado (antes da execução)
Resumo de estimativa:
- `estimatedTotalRecords`: 9841
- ordem de eliminação: 89 tabelas

Contagens-chave estimadas:
- técnicos: 56
- clientes: 77
- piscinas: 137
- rondas: 54
- service visits: 857
- visits (legacy): 0
- produtos: 10
- movimentos de stock: 915
- fornecedores: 0
- viaturas: 45
- faturas: 75
- pagamentos: 30
- reparações: 90
- mensagens operacionais (chat/client/pool/service): 90
- anexos operacionais (attachment + visitPhoto): 1
- notificações: 1067

Nova ordem de eliminação aplicada:
1. TransportGuideItem
2. WorkGuideItem
3. VehicleStockAuditItem
4. EmergencyConsumptionItem
5. StockPurchaseItem
6. _KeyAccessToPool
7. VisitPhoto
8. ChemicalUsage
9. ServiceMessage
10. VisitLog
11. VisitStateLog
12. Attachment
13. DeviceToken
14. Notification
15. Alert
16. OperationalReminder
17. ClientMessage
18. ChatMessage
19. ClientAccess
20. ClientReportSetting
21. PoolMessage
22. CommunicationLog
23. MonthlyReport
24. Task
25. UserNotificationSetting
26. LocationLog
27. UserAuditLog
28. AuditTrail
29. TechnicalHistory
30. TechnicalAlert
31. InvoiceLine
32. Payment
33. RefreshToken
34. Repair
35. ExtraVisit
36. ExtraVisitRule
37. VehicleStockMovement
38. VehicleMaintenanceRecord
39. StockMovement
40. StockBalance
41. SupplierQuickLink
42. LeadActivity
43. GeneralReminder
44. Appointment
45. Incident
46. ClientProfitSnapshot
47. EmergencyConsumptionBatch
48. VehicleStockAudit
49. RoundPool
50. RoundTechnician
51. TechnicianVehicleLog
52. TechnicianTrack
53. TechnicianLocation
54. TechnicianWorkDay
55. AiAction
56. AiMessage
57. AiRecommendation
58. AiConversation
59. AiOpsAction
60. AiOpsMessage
61. AiOpsConversation
62. AiAssistantAction
63. AiAssistantMessage
64. AiAssistantThread
65. EmailLog
66. ServiceVisit
67. Visit
68. Service
69. Invoice
70. WorkGuide
71. TransportGuide
72. StockPurchase
73. PoolEquipment
74. PoolCalculationProfile
75. TechnicalRoom
76. TechnicalSheet
77. KeyAccess
78. CompanyClosure
79. VehicleAccessibilityRule
80. OperationalLock
81. Round
82. Pool
83. Client
84. Lead
85. InventoryProduct
86. SupplierAccount
87. Technician
88. Vehicle
89. User (exceto admin canónico)

## 5) Execução Real
Resultado da 1a execução:
- `deletedTotal`: 10455
- principais tabelas afetadas: Notification (1896), VehicleStockMovement (1368), TechnicalHistory (1217), AuditTrail (935), ChemicalUsage (915), StockMovement (915), ServiceVisit (857), entre outras.

Ajuste complementar aplicado para cumprir `históricos=0`:
- limpeza total de `UserAuditLog`/`LocationLog` no script;
- 2a execução controlada removeu mais 216 registos (`UserAuditLog`).

## 6) Validação Obrigatória Pós-Limpeza
Estado final validado:
- administrador atual: 1
- administrador ativo: sim
- login administrador: funcional (POST `/api/auth/login` com credenciais admin devolveu 200, `ok=true`, token emitido, role ADMIN)
- técnicos: 0
- clientes: 0
- piscinas: 0
- produtos: 0
- stock operacional: 0
- fornecedores: 0
- viaturas: 0
- rondas: 0
- visitas: 0
- históricos: 0
- faturas: 0
- pagamentos: 0
- reparações: 0
- mensagens operacionais: 0
- anexos operacionais: 0

Saúde do sistema:
- `/api/system/health`: `ONLINE` e `database: ONLINE`

## 7) Validação Técnica Pós-Limpeza
Comandos obrigatórios executados:

```bash
npm run check:syntax
QA_ENVIRONMENT_SAFE=true UPLOAD_DIR=uploads/qa/full-functional-20260719 npm test
npm run smoke
```

Resultados:
- `check:syntax`: OK (448 ficheiros)
- `npm test`: 49/49 testes OK
- `smoke`: endpoints de saúde/version/core OK; endpoint protegido `/api/dashboard/metrics` devolveu 401 sem token (comportamento esperado em rota autenticada)

## 8) Estado de Encerramento
Limpeza real concluída e validada.
Nenhum dado novo foi criado após a limpeza.
Nenhum commit foi efetuado nesta fase.
