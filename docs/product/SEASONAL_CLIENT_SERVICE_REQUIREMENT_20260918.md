# Serviços, visitas e valores sazonais por cliente

## Pedido e estado

Requisito reforçado pelo utilizador em 18/09/2026: o mesmo cliente pode contratar serviços, frequências de visita e valores diferentes ao longo do ano. O exemplo dado é um condomínio com uma visita e um valor entre setembro e maio, passando a três visitas por semana e outro valor entre junho e agosto, com as visitas a refletirem-se no agendamento.

Este documento regista o requisito e a verificação do código; não declara a funcionalidade integrada implementada. É a próxima prioridade, antes de continuar a abertura de relatórios pelos alertas. Nenhum cliente, preço, contrato, ronda ou visita real foi alterado. O exemplo «condomínio X» não identifica um cliente real e não contém valores monetários nem dias da semana aprovados.

## Regra funcional a assegurar

Cada plano do cliente deve conservar os serviços incluídos, as instalações abrangidas, os períodos de vigência, a frequência e os dias/horários acordados, o valor e a modalidade de cobrança. A mesma versão do acordo deve orientar o planeamento e a faturação.

| Período do exemplo | Visitas | Valor |
|---|---|---|
| Setembro a maio, atravessando a mudança de ano | Uma visita, com unidade de frequência a indicar no contrato | Valor acordado para este período |
| Junho a agosto | Três visitas por semana, nos dias definidos para o cliente | Valor acordado para este período |

O utilizador explicitou a unidade semanal para o verão, mas não para a visita do primeiro período. Não assumir silenciosamente visita diária, semanal ou mensal na configuração real. Para ensaios de QA pode usar-se uma visita semanal no primeiro período, identificando essa escolha como fixture, não como condição comercial confirmada.

A repetição anual deve ser configurável quando prevista no acordo, conservando datas de início/fim de contrato e exceções datadas. A frequência contratada é o total de visitas do período: três visitas por semana não significam automaticamente três visitas extra além de uma visita regular. Visitas incluídas no preço do contrato não podem voltar a ser cobradas como serviços avulsos. O valor acordado não deve ser inferido multiplicando a frequência por um preço antigo.

## Estado observado no código

| Área | Evidência | Limite atual |
|---|---|---|
| Preços por período | `src/business/finance/ClientRateBusiness.js` valida versões, datas finais inclusivas, ausência de sobreposição e cálculo mensal proporcional por dias de calendário. | Os períodos são datados; o snapshot não inclui serviços, frequências ou dias de visita. Não representa por si só uma regra anual recorrente. |
| Editor de preços | `frontend/admin-client-settings.html` e `frontend/admin-client-rates.js` permitem base e períodos. A ajuda pede criar o período do ano seguinte. | Não associa o preço a um programa sazonal de visitas. |
| Faturação mensal | O plano de preços já é usado nos geradores revistos, incluindo o antigo gerador mensal, conforme `MONTHLY_RATE_ALIGNMENT_20260915.md`. | Essa aprovação não comprova a aplicação conjunta de serviços/frequências sazonais. Preservar documentos existentes e o preço total do contrato, sem o somar novamente aos preços antigos das piscinas. |
| Rondas | `src/services/roundScheduleService.js` suporta frequências DAILY/WEEKLY/MONTHLY e janela datada da ronda; `src/controllers/roundController.js` usa as ocorrências da ronda ou o recurso a frequência/dias atuais da piscina. | A janela pertence à ronda, não a um período do contrato de cada cliente. A geração não consulta `ClientRatePlan` nem um acordo sazonal de serviços. |
| Geração e duplicados | `src/business/admin/RoundAssignmentBusiness.js` bloqueia a geração por piscina, confirma a ronda e evita nova visita ativa no mesmo dia. | Reutilizar estas proteções não substitui resolver qual período e frequência contratados se aplicam a cada data. |
| Regra sazonal antiga | O modelo `ExtraVisitRule` contém campos sazonais e `frontend/client_tech.html` apresenta controlos de repetição e visitas por semana. | A rota montada `src/routes/extraVisitRoutes.js` não implementa os endpoints `/rules` usados por esses controlos. A presença do formulário/modelo não prova gravação ou geração funcional. Não usar esse ecrã como evidência de conclusão. |

Esta verificação é de leitura do código na base `580e438ce02eca897c64eabea17c15a8658e2343`. Não foi executado um ensaio ponta a ponta da sazonalidade. A aprovação do CI `35316029494` continua a comprovar a árvore de código TASK252–253; o presente registo altera apenas documentação.

## Critérios para fechar a implementação

1. Configurar e consultar, no percurso administrativo existente, serviços/instalações, preço e calendário de cada período do mesmo cliente, sem alterar por engano outros clientes da ronda.
2. Resolver setembro–maio através da mudança de ano e aplicar as transições em 1 de junho e 1 de setembro sem lacunas ou sobreposições. Em semanas que atravessam uma mudança, cada dia usa a regra que lhe corresponde.
3. Gerar as visitas nos dias selecionados, com atribuição real de técnico/ronda quando definida; frequência sem dias/atribuição suficientes deve ter estado explícito de planeamento pendente, sem inventar uma agenda confirmada.
4. Verificar o exemplo de QA de uma visita semanal versus três visitas semanais em pelo menos dois anos, incluindo um ano bissexto. Contar as ocorrências reais do calendário, sem assumir quatro semanas por mês.
5. Confirmar que o número de visitas de verão é o total contratado, que repetir/concorrer na geração não duplica visitas e que uma visita incluída não produz cobrança avulsa adicional.
6. Aplicar o valor vigente ao período faturado e ao modo de cobrança acordado; conservar a regra mensal de proporcionalidade já existente quando aplicável. Simular antes de gravar e demonstrar que os documentos já emitidos não são recalculados retroativamente.
7. Versionar o acordo e preservar o vínculo histórico usado no agendamento/faturação. Uma revisão deve mostrar o impacto sobre visitas futuras; não apagar ou reescrever visitas iniciadas/concluídas ou documentos existentes.
8. Ensaiar autorização ADMIN, mudanças de conta/cliente, falha de rede, repetição e concorrência na gravação/geração, além das transições de data e do efeito financeiro. Confirmar a implementação no CI nativo e no restauro antes de a declarar concluída.

Após este requisito, retomar os próximos percursos já identificados: abertura autenticada de relatórios pelos alertas, fotografias autorizadas, relatórios EXTRA e restantes validações da matriz.
