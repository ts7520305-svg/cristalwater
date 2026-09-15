# TASK106 — Calendário preventivo dos equipamentos

## Âmbito

Planos por piscina para filtro, clorador, bomba e outros equipamentos. A administração configura título, instruções explícitas, intervalo em dias ou meses, próximo prazo e estado ativo/pausado. Os títulos são únicos dentro da mesma piscina; dois filtros podem ser identificados no próprio título. Não há receitas químicas automáticas, tarefas de faturação ou envios externos.

## API

Montar `src/routes/equipmentMaintenanceRoutes.js` em `/api/equipment-maintenance`:

- GET/POST `/pools/:poolId`: administração consulta/cria planos.
- PUT `/plans/:id`: administração altera com `expectedVersion`, `active` booleano e todos os campos editáveis; piscina imutável.
- GET `/visits/:visitId`: administração ou técnico/chefe de equipa efetivamente atribuído. Resposta inclui `canComplete` global e por plano, sem contactos ou valores financeiros.
- POST `/plans/:id/complete`: `{visitId,expectedVersion,requestId,notes,confirmed:true}`. `requestId` UUID v4, observação de 3–3000 caracteres. A visita tem de ter sido iniciada, estar aberta, pertencer à piscina do plano e manter a atribuição atual.

Datas apresentadas `AAAA-MM-DD`; persistência DATE sem hora. O dia de execução é o dia civil de **Europe/Lisbon**, incluindo hora de verão. Intervalos mensais ajustam o dia ao último dia do mês de destino. O próximo prazo parte do dia efetivo de execução, não do prazo antigo. `overdue` significa plano ativo com data anterior ao dia atual de Lisboa; vencer hoje não significa atraso.

## Concorrência e recuperação

A conclusão bloqueia primeiro a visita e depois o plano, volta a validar a atribuição e compara a versão. Grava conclusão, próxima data, incremento de versão, histórico técnico e auditoria numa única transação. Plano em pausa, versão desatualizada e visita fechada rejeitam novos registos.

Reenvio do mesmo UUID, conteúdo normalizado e identidade devolve o resultado guardado, sem novo consumo de versão nem novo histórico. É permitido consultar essa confirmação depois de a visita fechar, mas nunca após perder a atribuição. Alterar conteúdo ou tentar usar a operação de outro técnico devolve conflito. Duas novas operações da mesma versão não podem ambas concluir. Cada plano só pode ser concluído uma vez na mesma visita, mesmo depois de atualizar a versão; a API devolve `completedInVisit:true` e `canComplete:false` nesse caso.

A criação não tem chave de idempotência. A restrição única de título/piscina impede duplicações exatas por duplo clique ou resposta perdida, devolvendo 409 e instruindo a atualizar a lista. Para alterar depois de uma resposta perdida, consultar a versão atual primeiro.

## Entrega e validação

Migração aditiva `20260915120000_equipment_maintenance` cria `EquipmentMaintenancePlan` e `EquipmentMaintenanceCompletion`, com relações restritivas que preservam provas históricas. Sem eliminação automática.

`tests/equipment-maintenance-calendar.test.js`: datas impossíveis, anos bissextos, fins de mês, mudança de ano e dia operacional de Lisboa após as 23:00 UTC de verão.

`scripts/test-field-equipment-maintenance.js`: exige três indicadores de ambiente QA isolado e backend local; valida perfis, atribuição, outra piscina, pausa, versões, visita não iniciada/fechada, cinco reenvios concorrentes, histórico/auditoria únicos e recuperação após transferência. Executar após gerar Prisma e montar a rota. O teste preserva as fixtures QA para inspeção/restauro.

A conclusão regista uma declaração autenticada do técnico. Não prova fisicamente a execução. Não existe neste módulo scheduler ou notificação push de vencimentos; os prazos são consultados no ecrã da visita e da gestão.
