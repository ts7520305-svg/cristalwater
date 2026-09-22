# TASK287 — Conciliação das receitas de manutenção

## Âmbito e compatibilidade

Base: `24a9a92b855b55caf8d44421db288056e850a6b2`, branch `work/field-readiness-20260915-simulation`. Continuação autorizada da gestão financeira após a repartição das mensalidades (TASK286). Principal `feature/technicians-v25` confirmada inalterada e ancestral: `6f27081e1d183ff584a62255b016b373836734db`.

A Gestão com IA distingue agora valores de manutenção conciliados com a decisão comercial e a intervenção originais. Reutiliza os comprovativos imutáveis da TASK268 e as linhas documentais existentes. É uma consulta, sem criar cobranças, alterar preços, emitir documentos fiscais ou executar pagamentos/contactos. IVA permanece no programa externo; valores, serviços incluídos e frequências variam por cliente, contrato e época.

Sem alterações ao esquema, migrações ou dependências. Permanecem 26 migrações e 119 tabelas esperadas no restauro. Cache v103. Runner com 176 grupos.

## Critérios de conciliação

- Identidades explícitas `MAINTENANCE_EQUIPMENT` e `MAINTENANCE_REMINDER`, distintas mesmo quando têm o mesmo número. O alias genérico `MAINTENANCE` pode acompanhar um subtipo. Aliases em conflito não são conciliados. Linhas genéricas sem subtipo continuam por repartir: a descrição não estabelece a origem.
- A decisão comercial guardada em `maintenance-billing:KIND:ID` deve confirmar a mesma origem, cliente, piscina, versão e hash do pedido. Só uma decisão EXTRA positiva, com recibo válido, pode contribuir; uma decisão INCLUDED não cria receita.
- O documento e a linha têm de coincidir exatamente com os IDs do recibo. Quantidade, preço e total conservam o valor original em cêntimos. Alterações da linha ou do preço exigem revisão. A liquidação válida da fatura não invalida a ligação.
- O documento inteiro continua sujeito à conciliação de totais, tipos e aliases da TASK285. Créditos, ajustes, dívidas transportadas, impostos e valores divergentes ficam por rever. Rascunhos, documentos retirados e depósitos de crédito ficam excluídos.
- Uma referência repetida em qualquer documento ativo, mesmo de outro mês ou com aliases em conflito, impede a conciliação. A procura mantém as identidades EQUIPMENT/REMINDER separadas e inclui estados documentais desconhecidos que podem reservar a mesma origem.
- A intervenção deve existir e manter a data, descrição e identidade históricas. Equipamentos exigem exatamente uma visita REGULAR/EXTRA, a piscina original e comprovativo de execução coerente com a versão, data e plano guardados. O título histórico vem do comprovativo, não do nome atual do plano.
- A manutenção de equipamento pode estar concluída enquanto a visita permanece `IN_PROGRESS`; uma visita cancelada ou regressada a um estado anterior deixa a ligação por rever. A data apresentada é a conclusão da intervenção, podendo preceder o fim da visita.
- Lembretes exigem categoria de serviço suportada, conclusão registada, título/descrição e piscina originais. Não recebem uma visita inferida. Uma origem retirada ou alterada exige revisão.
- O cliente do documento e o cliente diretamente registado na visita/lembrete devem ser o cliente da decisão original. Cliente ausente/divergente exige revisão. Mudar o dono ou nome atual da piscina, renomear o plano ou desativar o cliente não transfere os valores históricos.

## Gestão com IA

`finance.revenueCoverage` versão 3 acrescenta `maintenanceLinkedAmountCents`, contagem de linhas e amostra `linkedMaintenance`. A base explícita é `ORIGINAL_EXTRA_DECISION_AND_CURRENT_COMPLETED_INTERVENTION`. As seis parcelas — serviços, manutenções, mensalidades repartidas, mensalidades por repartir, outras linhas e ligações por rever — somam exatamente o valor dos documentos conciliados.

Totais completos, amostra identificada de até dez manutenções, cliente original, documento/linha, origem tipada, piscina, mês UTC de conclusão e visita associada quando existe. O mês dos subtotais permanece o mês documental; não corresponde necessariamente ao mês de execução nem ao recebimento. A interface oferece acesso à área de manutenção da piscina/origem e mantém os dados de origem como texto literal.

A interface valida versão, bases, contagens, somas, identidades, valores e amostras antes de apresentar o retrato. Respostas inválidas, mudança de conta/mês, indisponibilidade e respostas atrasadas não reutilizam valores anteriores. A conversa local e o contexto do modelo incluem o novo subtotal, as causas de revisão e os limites; não recebem comandos financeiros executáveis. Falha de leitura da origem deixa o contexto `UNAVAILABLE`, valores nulos e impede a chamada ao fornecedor externo.

Não somar estas parcelas novamente aos documentos, recebimentos ou despesas. A cobertura continua parcial, com receita completa e lucro nulos. Reparações, linhas de manutenção antigas sem identidade explícita, ajustes e alinhamento dos períodos continuam pendentes; restantes custos também são necessários antes de margens ou previsões.

## Validação local

- Nova API de cobertura: decisões originais reais através de `MaintenanceBillingBusiness.review`, EQUIPMENT/REMINDER com IDs iguais, visitas REGULAR/EXTRA, datas em meses diferentes, cliente/plano históricos, cliente inativo, duplicados em outros meses/aliases, fontes alteradas/retiradas, decisões incluídas, valores exatos e amostras maiores que dez.
- Coerência do comprovativo de execução: versão, sucesso, data e título alterados deixam a origem por rever. Quantidade, preço, linha comercial, hash, cliente direto ausente/divergente e visita associada cancelada também são exercitados.
- Regressões locais aprovadas: cobertura documental, IA financeira no navegador real, repartição mensal API/interface e faturação de manutenção API/interface. Leituras/conversas preservam faturas, pagamentos, decisões, parcelas, auditoria e notificações; fornecedor externo simulado e serviços reais desativados.
- UI a 320/390/1440 px e preferência escura, texto literal, ligações tipadas, valor conciliado, sessão/filtros, falhas e payloads malformados. Revisão visual em `reports/field-visual/financial-ai-1790069613577`; testes mantêm as proteções existentes de rascunhos, respostas perdidas e duplo clique.
- 396 testes unitários em 63 ficheiros. Sintaxe: 579 backend, 190 frontend e 58 scripts inline. `git diff --check` aprovado.
- Evidência transitória: `/tmp/cw287-final-focused.log`, `/tmp/cw287-receipt-final.log`, `/tmp/cw287-unit.log`, `/tmp/cw287-syntax.log`. Um ensaio inicial identificou uma expectativa antiga da cobertura documental: manutenção tipada sem comprovativo passou de “outras linhas” para revisão. As expectativas foram atualizadas para conservar a partição completa; nenhuma proteção foi removida.

## Publicação e validação nativa

Código publicado sem força: `3505dc1828ba634af0dbf40cdda1ab7587da46c5`, árvore `05b94a90a2535f85409b77a3183ef385fd8f89c0`, idêntica à validada localmente. Backup `backup/maintenance-revenue-local-20260922` (`3aae3bf6834593c6e9cc9d3c6fdd9402f3f9fc21`). Sem merge na principal, deploy ou contactos reais.

[CI 35711882957](https://github.com/ts7520305-svg/cristalwater/actions/runs/35711882957), job `106694186594`: sucesso nas 17 etapas, das 09:42:17 às 10:03:05 UTC de 22/09/2026, duração 20m48s. Logs confirmam 176/176 grupos distintos com código zero/sem sinal, 396 unitários/63 ficheiros, quatro técnicos, gate de navegador, 26 migrações e sintaxe 579/190/58.

Nova conciliação 23741 ms; IA API/interface 7043/18801 ms, cobertura documental 22420 ms, repartição mensal 6250/10941 ms, faturação de manutenção 16475 ms e E2E 30860 ms. Restauro PostgreSQL 16 aprovado: 119 tabelas e 46 ficheiros, com linhas e hashes iguais. O encerramento altera apenas este documento e o checkpoint, conservando o código validado. TASK287 concluída neste âmbito; cobertura completa e margens continuam por estabelecer.

Próximo âmbito: outras origens e ajustes com comprovativos adequados, alinhamento dos períodos e custos completos antes de margens/previsões. A reconciliação de emails permanece separada.
