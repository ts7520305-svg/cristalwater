# Rascunho TASK254–256 — sazonalidade por cliente

Registo histórico do rascunho: retomado pela implementação descrita em `SEASONAL_CLIENT_SERVICE_20260918.md`.

Estado na interrupção: INCOMPLETO E NÃO TESTADO. A implementação foi interrompida em 18/09/2026 quando o ambiente devolveu 409 environment_offline / Environment is not connected. Não executar este rascunho em produção nem o confundir com a branch de trabalho aprovada.

Base: 62fb82255301393a96df2c95f1749f12af852ecd, árvore ad3b02cb8f3dabd20532545824437b4052a8482f. A branch work/field-readiness-20260915-simulation permanece nessa base. A última aprovação de código continua a ser cd04d24b942c42fdc5952bffe7a0521d33f635d0, CI 35316029494 (146 grupos, 388 unitários, 20 migrações e restauro 110 tabelas/32 ficheiros).

## Preservado neste rascunho

- clientServicePlan.js: proposta de validação e resolução de épocas por meses, atravessando o ano; serviços/preço mensal por época; instalações com frequência semanal ou uma visita mensal, dias/hora e técnico opcional; contrato limitado por datas; calendário anual repetido durante a vigência.
- ClientRateBusiness: cálculo sazonal na mesma projeção de preços versionada, mantendo o formato anterior para planos sem servicePlan. Nenhuma prova de compatibilidade foi ainda executada.
- ServiceVisit.contractService: proposta de metadados do acordo aplicado, sem valores monetários expostos ao técnico. Migração aditiva proposta.
- FieldWriteRequest: dois novos scopes propostos para conservar pedidos de gravação/geração e recuperar a resposta original.
- O teste de migrações foi preparado para a 21.ª migração, mas NÃO foi executado.

Os quatro ficheiros modificados foram reconstruídos a partir da base remota e das substituições que tinham terminado localmente com código zero. A nova função pura corresponde ao patch inicial. Não foi possível comparar o estado do disco após a perda de ligação. A tentativa seguinte de criar clientServiceScheduleService.js falhou; esse serviço não integra este rascunho e pode existir incompleto no scratch. Conferir antes de retomar.

## Próxima execução

1. Recuperar o ambiente, ler git status/diff e comparar estas alterações antes de substituir qualquer ficheiro. A pasta de trabalho era /workspace/scratch/15a484a859e9/cristalwater. Continuar na branch de trabalho autorizada ou numa branch isolada; manter este rascunho como checkpoint.
2. Validar as regras puras com cenários setembro–maio/junho–agosto em dois anos e ano bissexto; lacunas/sobreposições, datas de contrato, semanas na mudança de mês, contagem semanal, um dia mensal inexistente e fuso Europe/Lisbon. A unidade da visita de inverno não foi dada pelo utilizador: uma visita semanal é apenas fixture. Rever a validação de count no modo mensal e a rejeição explícita de campos contraditórios.
3. Implementar o serviço de agenda ainda em falta. Ler/guardar preços e serviços na MESMA versão ClientRatePlan. Validar titularidade das instalações e atribuição ativa; quando faltam dias/técnico/ronda inequívoca, devolver planeamento pendente e não gerar agenda fictícia.
4. Integrar gravação ADMIN recuperável com FieldWriteRequest, UUID, actor e payload canonicalizados; cliente/versão e impacto futuro conferidos. Criar pré-visualização por cliente que mostre preço, datas e ações nas visitas futuras, com token de revisão invalidado por alterações.
5. Aplicar apenas alterações revistas a visitas automáticas PLANNED/SCHEDULED/ASSIGNED, sem startAt/endAt. Conservar visitas manuais, reagendadas, iniciadas e concluídas e mostrar as que exigem revisão. Cancelar planeamento obsoleto preservando registo/auditoria, sem apagar histórico. Rever a ordem de bloqueios cliente/ronda/piscina/visita em relação aos escritores existentes.
6. Gerar visitas regulares incluídas na mensalidade, com vínculo ao acordo/época/serviços e receita avulsa zero. Reutilizar locks/deduplicação por piscina/dia e pedido de receção ao técnico. Repetições/concorrência devem conservar uma agenda, resultado e comprovativo. A geração mensal por cliente deve ser atómica.
7. Integrar o gerador semanal existente: clientes com acordo sazonal não podem receber simultaneamente a frequência antiga da piscina/ronda. Respeitar os dias do período mesmo em semanas de transição; não criar datas passadas. Mostrar visitas existentes fora do acordo como pendências.
8. Rever todos os geradores financeiros (incluindo InvoiceGenerationBusiness) para excluir uma visita contractService.billing=INCLUDED_MONTHLY de cobrança avulsa, mesmo que um fluxo antigo lhe atribua revenue. Preservar faturas existentes e o contrato mensal total, sem multiplicar por visitas/piscinas.
9. Estender o editor administrativo existente com épocas, serviços, instalações, frequência/dias/hora/técnico, simulação e confirmação do impacto. Não pedir IDs técnicos ao utilizador. Prever rascunho/pedido por conta/cliente, resposta perdida, reenvio exato, conflitos, mudanças de sessão, armazenamento indisponível e revisão explícita.
10. Testes API/base e navegador reais (incluindo plano de outro cliente, preços/frequências, notas literais e largura 320/390/1440), regressões de preços/rondas/faturação, migração e restauro. Regenerar inventário e aumentar cache após alterações de frontend. Não enfraquecer testes antigos.
11. Só então publicar a implementação na branch de trabalho, aguardar o CI completo/restauro, registar a aprovação e retomar os relatórios pelos alertas.

## Contexto de implementação

O modelo ExtraVisitRule e o formulário antigo client_tech.html não têm as rotas /rules correspondentes. Não considerar esse percurso implementado nem transformar três visitas contratadas em três extras além de uma regular.

ClientRateBusiness.save/read ainda são os anteriores: NÃO verificam servicePlan contra a base, impacto ou UUID. Não expor este rascunho como funcional. O motor de preços proposto usa épocas anuais por meses completos dentro de startsOn/endsOn; proporção diária mensal mantém-se para início/fim de contrato. Outros preços/períodos datados mantêm o contrato anterior.

RoundAssignmentBusiness.generateVisit é a geração regular existente e usa lock de ronda/advisory lock de piscina e deduplicação diária. roundController gera uma semana a partir de hoje, escolhendo rondas ou fallback de piscinas. AdminWeeklyPlanningBusiness mostra rondas e visitas existentes. Esses percursos ainda NÃO foram alterados.

Harness local anterior: /tmp/task247-runtime/run.cjs e pglite-socket em /tmp/task247-runtime/node_modules, porta 51214, connection_limit=2, Chromium /tmp/chromium. É QA isolado com fornecedores desligados e db push; não demonstra migração nativa. Não imprimir segredos/ambiente completo.

Publicação já autorizada apenas na branch de trabalho. Sem main, deploy/VPS, fornecedores ou mensagens reais. Não pedir novamente essa autorização. Não criar subagentes.
