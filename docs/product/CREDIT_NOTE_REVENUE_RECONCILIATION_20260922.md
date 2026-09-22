# TASK293 — conciliação de notas de crédito internas

Evolução posterior: a TASK294 implementa a atribuição explícita das reduções e a nova confirmação de parcelas mensais brutas. Ver `CREDIT_REVENUE_ALLOCATION_20260922.md`; o contrato v6 e os limites abaixo descrevem o estado histórico desta TASK293.

## Problema e resultado

Uma nota interna de crédito de 20 EUR sobre um serviço documentado de 100 EUR fazia desaparecer os 100 EUR da repartição financeira. A reprodução controlada falhou com `linkedServiceAmountCents=0`, quando devia conservar o valor original e distinguir a redução. Não havia erro no recebimento nem na emissão da nota: a análise recusava integralmente qualquer documento ajustado.

O contexto financeiro e `/admin-ai` passam a distinguir parcelas antes das notas, reduções comprovadas e total documental líquido. A igualdade em cêntimos é:

`soma das sete parcelas = grossDocumentAmountCents`

`grossDocumentAmountCents - creditNotes.amountCents = reconciledDocumentAmountCents`

`creditReleasedCents` é o crédito disponibilizado ao cliente no momento das notas. É um subconjunto do valor das notas, não dinheiro novo nem o saldo atual de crédito. Um documento totalmente pago pode libertar todo o valor da nota; num parcialmente pago, apenas o excedente incremental; num não pago, nenhum. Pagamentos existentes ficam intactos.

## Fontes e limites de confiança

- `creditNoteRevenueSourceService` consulta a cadeia de `FINANCE_CREDIT_NOTE_CREATED` e os comprovativos atómicos `invoice-payment:<requestId>` existentes. Não cria provas retroativas nem altera a emissão.
- Confere autor ADMIN, comando/fingerprint, motivo, montantes, crédito antes/depois, linha exata e cada fotografia do documento guardada nos recibos. O resultado de uma nota tem de ser a origem da seguinte, com todas as linhas anteriores preservadas. Notas duplicadas, sem prova ou com prova alterada deixam o documento por rever.
- Confere cliente histórico, período documental, imposto, preços, tipos, referências e todas as linhas atuais. Consultar o dono atual da piscina não reatribui a receita histórica. Alterar ou retirar uma linha não apaga a auditoria anterior.
- Pagamentos posteriores e transições válidas de estado financeiro não reescrevem os valores originais. Rascunhos, documentos retirados e depósitos continuam excluídos. Tipos/descontos/ajustes sem conciliação própria, saldos transportados e impostos continuam por rever.
- Fontes lidas na transação RepeatableRead do contexto financeiro. Uma falha de leitura torna os valores indisponíveis, sem zeros inventados ou exposição do erro interno.

O mês é o do documento original e usa os valores atuais. `recordedAt` identifica a data real da nota, que pode pertencer a outro mês. Não é fecho histórico, período fiscal de uma nota externa ou receita pelo mês de execução.

## Repartição e interface

O contrato `revenueCoverage` sobe para versão 6. Os sete subtotais de serviços/mensalidades continuam anteriores às notas de crédito; `creditNotes` contém a redução separada, totais completos e até dez exemplos identificados. As reduções têm `serviceAllocation=UNALLOCATED`, sem atribuição automática ou proporcional. Cobertura permanece PARTIAL, receita completa e lucro permanecem nulos.

Uma mensalidade com nota continua bloqueada para novas repartições; parcelas anteriores ficam por rever e conservam o histórico e as reservas. A conciliação documental não aprova novamente essas parcelas.

O ecrã mostra valor antes das notas, redução e valor líquido, com detalhes de cada nota, cliente/documento/linha, data, motivo e crédito disponibilizado. Textos são literais. Os campos novos são validados juntamente com contagens, somas, datas e amostras; falhas, mudança de mês/conta, offline e retoma limpam dados anteriores. A resposta local e o contexto da IA explicitam a mesma base e proíbem atribuição implícita ou margens com valores brutos.

## Validação

Reprodução anterior guardada em `/tmp/cw293-reproduction.log`. O novo grupo `test-field-credit-note-revenue.js` exercita notas sucessivas e reenvio, valores exatos, documentos pagos/parciais/não pagos/total líquido zero, alteração/ausência/duplicação de comprovativos e linhas, titularidade/período, invalidação de mensalidades, totais para mais de dez notas, ausência de escritas durante consulta e falha da fonte.

O ensaio real de navegador de Gestão com IA passa a usar uma reparação com nota de crédito, compara os três valores e o conteúdo literal, testa respostas adulteradas e inclui os detalhes novos nas verificações de sessão, falha, larguras 320/390/1440 e contraste escuro. Regressões de mensalidades, visitas, manutenção, reparações, confirmações de execução e IA acompanham a alteração.

Validação local aprovada: oito grupos focados (nota de crédito, cobertura documental, mensalidades, manutenção, reparações, execução, IA API/interface), 401 testes unitários em 64 ficheiros e sintaxe 586 backend/192 frontend/59 inline. Notas e totais revistos visualmente em mobile/desktop. A preparação inicial do ensaio repetia a chave única cliente/mês: corrigida usando documentos avulsos com a referência mensal histórica existente. Não foi uma alteração às restrições da aplicação. Logs `/tmp/cw293-focused.log`, `/tmp/cw293-units.log`, `/tmp/cw293-syntax.log`.

185 grupos previstos no runner; sem nova migração ou dependência, cache v108. Validação completa do commit publicado e restauro PostgreSQL 16 aprovados, conforme o encerramento abaixo.

## Restante âmbito

Repartir explicitamente notas pelos serviços, conciliar descontos/outros ajustes, completar custos atribuíveis e alinhar períodos antes de calcular margens. Não foram criadas notas fiscais externas, integrações bancárias, alterações no VPS ou contactos reais.

Critérios de aceitação para a repartição futura, ainda não implementada:

- Escolher explicitamente a nota original e os serviços/parcelas afetados, confirmando cliente, origem e motivo. O texto livre da nota não decide o destinatário.
- Respeitar simultaneamente o saldo da nota e o valor ainda disponível do destino, considerando todas as notas. Parcelas por rever continuam reservadas até correção explícita; não libertar valor por desaparecimento de uma origem.
- Guardar autor, fontes e valores originais, decisão e recibo atómicos; suportar concorrência, resposta perdida, repetição exata e anulação com histórico. Não alterar recebimentos ou voltar a disponibilizar crédito.
- Manter a soma bruto menos reduções igual ao líquido, com remanescente não atribuído explícito. Uma mensalidade ajustada exige revisão das parcelas anteriores, sem divisão automática por visitas.
- Apresentar receita líquida atribuída e custos comprovados pelo mesmo período de execução. Cobertura completa e margens só podem ser declaradas depois de fechar as restantes origens/custos, não apenas por concluir a repartição das notas.


## Encerramento — 22/09/2026

Código publicado sem força no commit `854e041d19283c0e7a73d25eec58279c8741fe0a`, árvore `3cf43ea87ff44fcace152152d4b2e4935817c986`, igual à validada localmente. Backup `backup/credit-note-revenue-local-20260922` (`18a092d1cd2766ea7d196af70b716ce6f9b591ba`). Principal `feature/technicians-v25` conservada no SHA `6f27081e1d183ff584a62255b016b373836734db`.

[CI 35781492312](https://github.com/ts7520305-svg/cristalwater/actions/runs/35781492312), job `106927802133`, aprovado nas 17 etapas, entre 20:37:31 e 20:59:40 UTC (22m09s). Logs conferidos contra o runner: 185/185 grupos distintos previstos, todos com código zero/sem sinal; 401 unitários/64 ficheiros, quatro técnicos, gate geral do navegador, 26 migrações e sintaxe 586 backend/192 frontend/59 inline. Nova conciliação em 20194 ms; IA financeira UI em 21190 ms; cobertura documental em 21060 ms e repartição mensal em 5602 ms.

Restauro PostgreSQL 16 aprovado: 119 tabelas/46 ficheiros, linhas e hashes iguais. Evidência durável `evidence/20260922_task293_ci.json`. A última confirmação local da conciliação/interface, incluindo a igualdade bruto menos notas igual a líquido e apresentação de zero, está em `/tmp/cw293-final.log`.

Este encerramento altera apenas documentação/evidência, preservando o código aprovado. TASK293 concluída neste âmbito. Atribuição de reduções aos serviços, restantes origens/custos, período de execução e validações de produção/campo continuam pendentes.
