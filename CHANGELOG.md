# CHANGELOG

## V23.2.1 - Engineering Foundation
- Início do controlo de versões com Git.
- Adicionado .gitignore.
- Criada documentação base do projeto.
- Estado atual inclui Crystal Brain Alpha, Multi Provider e Crystal Kernel inicial.

## V23.2.2 - Technician OS Refactor
- Concluída a refatoração do Technician OS para controllers finos e business modules.
- Movida a lógica de auth, portal, stats, rota, visita, workday e GPS para business.
- Preservados os contratos públicos das rotas e o formato JSON das respostas.
- Adicionada a suíte de regressão Technician OS com Vitest.
- Gerado o relatório de finalização em TECHNICIAN_OS_REPORT.md.
- Revisão final concluída: 100% do escopo do EPIC-001 auditado e validado.

## V23.2.3 - Pool OS Initial Refactor
- Iniciada a transformação do módulo Pool em Pool OS com controllers delegando para business modules.
- Criados os módulos PoolDashboardBusiness, PoolEquipmentBusiness, PoolChemistryBusiness, PoolMaintenanceBusiness, PoolHistoryBusiness e PoolVisitBusiness.
- Atualizados os controllers de pool, equipment e cálculo químico para manter os contratos públicos e respostas JSON compatíveis.
- Adicionada a suíte de regressão Pool OS com Vitest.
- Gerado o relatório de evolução em POOL_OS_REPORT.md.

## V23.2.4 - Route OS Operational Acceptance
- Registado o Operational Acceptance Record antes do início do EPIC-004 Route OS.
- Validado o cenário com 1 técnico, 1 workday, 5 clientes, 5 piscinas e 5 visitas.
- Confirmados 6 notifications e 5 audit entries no fecho do fluxo operacional.
- Documentados os issues encontrados e as correções aplicadas durante a validação.
- Marcado o EPIC-003 como Production Ready e publicado o plano inicial do EPIC-004.

## V23.2.5 - Route OS Production Ready
- Concluída a execução do EPIC-004 Route OS com regressão determinística e validação operacional.
- Adicionada cobertura de teste para ordenação da rota e carregamento do today route do técnico.
- Implementada recuperação local da rota diária, deduplicação da fila offline e resolução determinística de conflitos de conclusão já efetuada.
- Mantidos os contratos públicos da API, o formato JSON e os eventos do EventBus.
