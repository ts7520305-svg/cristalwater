# TASK318 — vários intervalos próprios no lembrete associado

## Resultado

A administração pode declarar até 20 intervalos de trabalho no mesmo lembrete associado a uma visita REGULAR/EXTRA. O formulário conserva o primeiro intervalo e permite acrescentar ou remover os seguintes. A prévia, o pedido pendente e o histórico mostram cada início e fim, em hora local e UTC. O trabalho efetivo é a soma dos intervalos; as pausas não entram na duração nem no custo.

O técnico continua a ser o da visita confirmada. Cada intervalo tem de ter início e fim válidos, em segundos inteiros, estar ordenado, ter duração positiva e ficar dentro da visita e da conclusão do lembrete. Intervalos que se tocam são permitidos; intervalos sobrepostos, repetidos, fora da visita ou com campos contraditórios são recusados.

## Conservação e compatibilidade

- Os comprovativos anteriores de intervalo único mantêm os campos, a versão e os hashes. Os rascunhos antigos e os pedidos pendentes continuam verificáveis.
- A forma nova usa `workIntervals`, sem `workTime`, na seleção dos recursos. Declaração, prévia e anulação usam esquema 2. A anulação inclui o comprovativo original completo; a cadeia do histórico conserva os anteriores.
- Os intervalos de equipamento e de outros lembretes partilham a disponibilidade da visita. A conferência verifica cada intervalo, incluindo o segundo e seguintes. Um intervalo de outro serviço pode ocupar uma pausa sem consumir o trabalho do lembrete.
- A conferência externa compara cada intervalo com visitas, reparações e lembretes independentes do técnico. O bloqueio existente da visita e do técnico continua a serializar as confirmações. Alterações posteriores obrigam a revisão.
- A repartição de trabalho usa um registo explícito com todos os intervalos e a duração somada. Não cria um intervalo contínuo que inclua as pausas. Quantidades e cêntimos mantêm os limites comuns com equipamentos e lembretes.
- As parcelas de materiais também conservam o comprovativo completo novo. A prévia financeira passa a versão 3 quando usa recursos de esquema 2; as versões 1 e 2 existentes mantêm-se verificáveis.
- Anular recursos conserva os custos e apresenta as parcelas afetadas. A correção só avança depois da anulação financeira expressa exigida pelo percurso existente. Os documentos, as atribuições originais, os pagamentos e as reservas não são reescritos.

O código partilhado verifica as mesmas formas, intervalos, contas e provas no servidor e no navegador. A visualização financeira mostra cada intervalo e explica que as pausas ficam excluídas. Cache v133. Sem novas tabelas, migrações ou dependências.

## Validação

Base `dc30d3d6f5a6edd83abe43f8563c9c8e175c93bc`, correção isolada do ensaio TASK317 sobre o código `46025c4cf9c025abd1fe48f1a441270564100ec6`. O CI inicial da TASK317 falhou por colisão de ID no ensaio e não executou o restauro; [relatório e evidência](REMINDER_VISIT_COSTS_20260924.md). A correção passou com sentinela já existente, 489 unitários e quatro testes técnicos. O CI completo deste lote deverá aprovar em conjunto as TASK317–318.

- 494 testes unitários em 72 ficheiros e quatro testes técnicos aprovados. Cinco casos novos cobrem provas Node/navegador, compatibilidade, limites de 20 intervalos, sobreposições, somas sem pausas, versões contraditórias, alteração de uma parcela e original conservado na anulação.
- Sintaxe: 616 JS backend, 215 frontend e 62 scripts inline.
- Grupo API/navegador novo `scripts/test-field-reminder-visit-intervals.js`: recursos de esquema 1/2 e custos de versão 2/3 no mesmo histórico, REGULAR/EXTRA, corridas entre dois processos, repetição exata, falha atómica, sobreposições em intervalos posteriores, pausas disponíveis, conferência com equipamento e trabalho externo, conservação de custos de material/trabalho e stock, comprovativo adulterado e correção expressa.
- Navegador real: acrescentar/remover intervalos, rascunho após recarregar, consentimento não recuperado, duplo clique, perda de resposta, consulta sem novo POST, anulação com original completo, seleção financeira e mudança de conta. Capturas em 320/390/1440 e modo escuro em `reports/field-visual/reminder-visit-intervals/`. Os campos de data/hora foram ajustados para caberem em ecrãs estreitos e manterem o ícone legível no modo escuro.
- Seis regressões dirigidas aprovadas: recursos e custos associados, materiais e trabalho de equipamento, recursos independentes e tempo de equipamento.
- Runner com 221 grupos. CI nativo e restauro deste lote ainda pendentes nesta versão documental.

O lote tem 19 ficheiros: sete frontend, sete serviços, três de testes/runner e dois documentos. Bases descartáveis, fornecedores externos desligados. A publicação autorizada permanece na branch de trabalho.

## Continuação e limites

Este percurso cobre múltiplos intervalos de lembretes associados. As declarações independentes e as revisões de equipamento continuam a ter o seu intervalo único; a extensão desses percursos exige a respetiva prova e valorização. Repartições entre meses, registos antigos sem comprovativo verificável, restantes custos/receitas, serviços sazonais, volume/operação prolongada, páginas/PDFs/idiomas, integrações, VPS e piloto físico continuam abertos. O lucro e a cobertura financeira completa continuam por apurar.
