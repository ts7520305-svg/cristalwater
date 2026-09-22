# TASK286 — Repartição explícita das mensalidades

## Âmbito e compatibilidade

Base: `4c8f96eab8bf18bebae462612c634422384d336d`, branch `work/field-readiness-20260915-simulation`. Continuação autorizada da gestão financeira e da TASK285. A principal `feature/technicians-v25` permanece ancestral no SHA `6f27081e1d183ff584a62255b016b373836734db`.

A nova área `/admin-revenue`, acessível pela navegação financeira e pela Gestão com IA, reparte valores já documentados em linhas MONTHLY. Não altera preços, pagamentos, crédito, linhas de faturação ou frequências; não emite documentos fiscais nem executa contactos/transferências. IVA continua no programa externo. Valores e frequências dependem de cada contrato, época e instalação.

## Regras da repartição

- O documento tem de ser uma obrigação reconhecida, com linhas e aliases conciliados com o total; impostos não repartidos, créditos, ajustes, dívidas transportadas, valores divergentes e tipos desconhecidos exigem revisão.
- `sourceMonth` explícito e válido define o mês da mensalidade; na sua ausência usa o mês canónico do documento (`monthRef`, depois os formatos históricos). Períodos inválidos não são inferidos. O mês do documento continua separado do mês da mensalidade/execução.
- Destinos REGULAR e EXTRA mantêm identidades distintas mesmo com IDs numéricos iguais. Só se admitem serviços concluídos e datados no mês UTC da mensalidade, com o cliente histórico registado diretamente no serviço. A propriedade atual da piscina e a inatividade do cliente não transferem o histórico.
- REGULAR com `INCLUDED_MONTHLY` é elegível; serviço histórico sem snapshot exige confirmação explícita do contrato e motivo. Outra condição comercial explícita é recusada. EXTRA exige `billingMode=INCLUDED` e `includedInPackage=true` consistentes.
- Referências de cobrança SERVICE/EXTRA_VISIT em documentos ativos de qualquer mês bloqueiam a atribuição; aliases em conflito reservam ambas as identidades. Uma única parcela mensal ativa por serviço, entre todas as origens; não se pressupõe que duas linhas representam contratos independentes para a mesma visita.
- O ADMIN indica um valor positivo em cêntimos, motivo e confirmação. A soma das parcelas ativas não pode ultrapassar a linha. Pedidos concorrentes verificam o estado consultado; valores por rever continuam reservados.
- O snapshot inclui a linha, o documento e os dados originais do serviço. Alterações relevantes ou origens retiradas deixam a parcela por rever, preservando o histórico. Liquidação válida e transições de pagamento não mudam o preço documentado.
- Reservas por rever também bloqueiam outras linhas da mesma fatura. A substituição de uma linha não volta a disponibilizar o orçamento enquanto existirem parcelas antigas pendentes de revisão.
- A correção faz-se por anulação com motivo e nova confirmação, sem reescrever a parcela anterior. A anulação também funciona após a retirada do documento. Origens retiradas/excluídas sem parcelas ativas mantêm histórico, mas não perpetuam alertas nem entram nos totais.

## Persistência e recuperação

26.ª migração aditiva: `20260922080000_monthly_revenue_allocation`. Acrescenta `RevenueAllocation` e `RevenueEvent` (119 tabelas esperadas no restauro), índices, unicidade da parcela ativa e checks de valores/tipos/períodos/estado. Sem dependências novas. IDs históricos não têm FKs para documentos/linhas/serviços: os percursos existentes de substituição/remoção não ficam bloqueados e o histórico não sofre cascade. A existência e validade das origens são verificadas na escrita e em cada consulta.

API `/api/revenue-allocations`, apenas ADMIN ativo, respostas privadas/no-store. Pedidos `ALLOCATE` e `VOID` têm UUID, titular, hash canónico e estado esperado. Bloqueios de pedido, linha, documento e destino protegem reservas concorrentes. Parcela e decisão são gravadas atomicamente; falha na auditoria reverte a operação. Recibos aplicados e recusas são duráveis e não mudam com a fonte. Repetição exata recupera o resultado; UUID reutilizado por outra conta ou conteúdo é recusado. Cancelamento explícito do pedido ainda não aplicado grava uma recusa que impede aplicação tardia.

Navegador: pedido persistido em IndexedDB por conta antes de enviar, coordenação entre janelas por Web Locks, sem reenvio automático. Consulta, repetição e cancelamento usam o pedido original. Só um recibo que corresponde ao titular, comando, linha, estado e conteúdo guardados permite remover o pendente; a confirmação é guardada atomicamente. Armazenamento indisponível/corrompido bloqueia novas escritas. Mudança de conta/token, filtros, seleção, offline e respostas atrasadas não reutilizam contexto antigo. Dados de clientes/documentos são apresentados como texto literal.

## Gestão com IA e limites

`finance.revenueCoverage` versão 2 passa a separar mensalidades repartidas e remanescente. Nas linhas parcialmente repartidas, a parcela válida e o remanescente somam exatamente a linha. Uma origem/parcela por rever retira toda a linha desses dois subtotais e coloca-a em revisão. A partição completa permanece igual aos documentos conciliados. Contagens de parcelas ativas/por rever abrangem todos os meses, incluindo origens retiradas, para não ocultar revisões.

Subtotais financeiros continuam pelo mês do documento. As parcelas não são nova receita a somar aos documentos ou aos recebimentos. A IA local/externa recebe estas bases e recomenda abrir a repartição ou rever parcelas; não recebe ações financeiras executáveis. Totais completos antes de pesquisa/paginação, amostras identificadas na IA e listas paginadas de dez na nova área. Falha de fonte não é zero: contexto financeiro indisponível, sem chamada ao fornecedor externo. Cobertura de receitas, custos e lucro completos continua por estabelecer.

## Validação local

- Migração desde o esquema anterior: 26 migrações, documentos anteriores preservados, checks/unicidade exercitados, histórico conservado após remoção da origem e schema diff sem diferenças.
- API nova: autorização canónica, clientes inativos, identidade REGULAR/EXTRA, períodos explícitos, origem alterada/retirada, cobrança separada, concorrência, limite do valor, repetição exata, cancelamento, auditoria atómica, paginação/totais, IA e falha de leitura.
- UI nova: 320/390/1440 px, preferência escura, texto literal, seleção paginada, duplo clique, resposta perdida após commit/reload, recibo malformado, repetição/cancelamento explícitos, histórico/anulação, duas janelas, dados atrasados, offline, mudança A–B–A de sessão e armazenamento corrompido. Reabrir após restauro dos filtros pode exigir consulta explícita; dados antigos não são reutilizados.
- Regressões locais: IA API/interface, cobertura documental e despesas aprovadas. 396 testes unitários em 63 ficheiros; sintaxe 578 backend/190 frontend/58 scripts inline. Prisma válido com ambiente QA. Artefactos de QA em `reports/field-visual/monthly-revenue-1790064623980`.
- Evidência transitória: `/tmp/cw286-final-focused.log`, `/tmp/cw286-replacement.log` (API de substituição aprovada), `/tmp/cw286-final-ui.log`, `/tmp/cw286-migration.log`, `/tmp/cw286-unit.log`, `/tmp/cw286-syntax.log`, `/tmp/cw286-prisma.log`. Revisão final acrescentou o bloqueio de linhas novas/substituídas enquanto persistirem parcelas antigas do mesmo documento por rever, reproduzido na API. Primeiro ensaio corrigiu a expectativa de autenticação (token com papel divergente devolve 401, papel não autorizado canónico devolve 403); interface confirmou consulta explícita após restauro de filtros. Nenhuma proteção foi removida.

Runner com 175 grupos. Cache v102. Publicação e validação nativa concluídas conforme o encerramento abaixo. Sem merge/deploy/contactos reais.

Próximo âmbito: conciliar outras origens/ajustes e período de execução, completar gastos e bases de trabalho antes de margens/previsões. Reconciliação de emails permanece separada.

## Encerramento — GitHub e PostgreSQL 16

Código publicado: `afb6e8107ab021c6eb9aa4e95e3666dd86198a20`, árvore `12a7721e01fa6155f4d845009fbf57b7ed35023a`, idêntica à validada localmente. Publicação sem força sobre `4c8f96eab8bf18bebae462612c634422384d336d`. Backup local: `backup/monthly-revenue-allocation-local-20260922` (`2a67fd6e93ff360f5e247c076e8b250aedbe855e`). Checkout alinhado, sem alterações pendentes nem divergência. Principal novamente confirmada inalterada e ancestral (`6f27081e1d183ff584a62255b016b373836734db`).

[CI 35704078046](https://github.com/ts7520305-svg/cristalwater/actions/runs/35704078046), job `106668685193`: sucesso nas 17 etapas; início às 08:18:23 UTC e conclusão às 08:39:34 UTC de 22/09/2026, duração 21m11s. Logs confirmam 175/175 grupos distintos, todos com código zero e sem sinal; 396 testes unitários/63 ficheiros, quatro testes técnicos, 21 scripts gerais de navegador, 26 migrações preservando os dados anteriores e schema diff sem diferenças; sintaxe 578 backend/190 frontend/58 inline.

Nova repartição API 6786 ms e UI 11154 ms; regressões IA API/interface 7776/19066 ms, cobertura documental 24789 ms, cobertura de custos 9866 ms, despesas 2398/7650 ms, atribuições de custos 3065/9693 ms, valorizações 3993/10774 ms, valores operacionais 571/5877 ms e E2E 31523 ms.

Restauro isolado aprovado em PostgreSQL 16: 119 tabelas e 46 ficheiros, com linhas da base de dados e hashes dos ficheiros iguais. Esta atualização de encerramento altera apenas os dois documentos de contexto e preserva integralmente o código testado. TASK286 concluída neste âmbito; restantes origens/ajustes, período de execução e custos completos continuam necessários antes de margens ou previsões.
