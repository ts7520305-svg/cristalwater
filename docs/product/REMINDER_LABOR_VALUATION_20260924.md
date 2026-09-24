# TASK313 — custo do trabalho independente dos lembretes

## Resultado e âmbito

A administração pode atribuir o custo das horas próprias de um lembrete a uma despesa de trabalho confirmada. Em Despesas, escolhe o lembrete concluído e revisto, o intervalo declarado e a base paga do mesmo técnico/período; calcula e confirma o custo antes de guardar. Uma parcela confirmada de um documento repartido também pode financiar esse intervalo. Em Bases compostas de trabalho, a mesma medição pode reunir documentos inteiros e parcelas compatíveis, com confirmação e anulação conjuntas.

A origem é a declaração administrativa da TASK312. Não se deduz trabalho da data prevista, da criação do lembrete, de uma visita próxima ou de materiais declarados. Um lembrete sem horas próprias confirmadas não oferece intervalo para valorização. Esta tarefa não acrescenta consumo de stock nem valoriza materiais.

## Prova e cálculo

- A projeção de trabalho incorpora o comprovativo original completo da declaração, incluindo pedido, conta, evento, prévia e hashes. Tem fingerprint próprio e conserva as identidades do lembrete, cliente, piscina, técnico e declaração. O nome atual do técnico é apresentado separadamente; não é transformado num nome histórico certificado.
- A origem e a decisão comercial têm de continuar válidas, a declaração deve estar ativa e íntegra e o intervalo não pode ter sobreposições conhecidas com visitas REGULAR/EXTRA, reparações ou outros lembretes do técnico. Transferir a piscina não transfere o cliente histórico. Mudar o nome/estado atual do técnico não reescreve a prova original.
- O técnico da base paga tem de coincidir e todo o intervalo deve caber no período inclusivo UTC dessa base. O custo usa o documento confirmado dividido pelo total de minutos pagos, incluindo tempo não atribuído a serviços. Não calcula salários ou encargos sem documento.
- O intervalo é valorizado por inteiro, em segundos. A quantidade e o custo partilham o orçamento da despesa ou parcela com os restantes serviços. O arredondamento usa cêntimos inteiros e conserva o saldo final: no ensaio, três minutos sobre 100 cêntimos distribuem 33, 33 e 34 cêntimos.
- A medição é identificada por `LABOR:MAINTENANCE_REMINDER:<lembrete>:INTERVAL:<declaração>`. Um identificador numérico igual ao de uma reparação não identifica a mesma origem. Componentes de um custo conjunto conservam o identificador comum e a sua própria despesa.
- A atribuição segue o mês UTC da conclusão confirmada do serviço, independentemente do mês do documento. Não divide automaticamente intervalos entre períodos pagos ou meses.

## Histórico, revisão e anulação

Alterar/remover a origem, anular as horas, adulterar um comprovativo ou registar posteriormente tempo sobreposto assinala o custo para revisão. O montante, fontes, recibo e reserva originais permanecem conservados. A alteração dos recursos não cancela silenciosamente uma despesa ou pagamento.

A prévia de anulação dos recursos apresenta os custos LABOR ativos da declaração: atribuição, despesa, valor e eventual custo conjunto. Inclui hashes dos registos afetados. Uma valorização ou anulação financeira ocorrida depois dessa prévia obriga a rever a proposta. Os bloqueios seguem a mesma ordem da valorização: medição, recursos, origem e técnico, evitando que duas APIs confirmem efeitos incompatíveis.

Depois da anulação das horas, a reserva financeira só é libertada pela anulação explícita do custo na despesa, ou pela anulação de todas as parcelas do custo conjunto. O histórico das declarações não reescreve os seus recibos originais. Os comprovativos de anulação da TASK312, anteriores à lista de custos afetados, continuam verificáveis.

## Implementação

`reminderLaborSourceService` valida as declarações atuais e constrói a projeção própria. `expenseValuationSources` passa a usar essa origem no mesmo cálculo/reserva das restantes valorizações. As fontes têm versão 6 para documento inteiro e 7 para parcela; os formatos anteriores de visitas e reparações permanecem iguais.

`GET /api/expenses/:id/reminder-work-intervals` recebe `reminderId` e, opcionalmente, `laborPart`. A prévia de valorização e `VALUE_LABOR` aceitam `MAINTENANCE_REMINDER` com `workIntervalId` obrigatório. A composição usa a mesma seleção e cálculo por componente. Acesso reservado à administração; recuperação de pedidos continua ligada à conta original.

A migração `20260924100000_reminder_labor_valuation` permite exclusivamente LABOR medido para lembretes, verifica a forma da prova/intervalo/chave e estende as restrições de repartição/composição. Usa `serviceReminderId`, já existente. Não cria tabelas, não preenche valores históricos e não reescreve atribuições antigas. A projeção das parcelas compostas antigas mantém os seus campos originais, preservando hashes e recibos anteriores.

Os ecrãs usam o contrato partilhado `cw-reminder-labor-rules`, validam a declaração incorporada, técnico/período, seleção exata, duração, base e arredondamento. Respostas perdidas ou alteradas conservam o pedido em IndexedDB; consulta e reenvio exatos não criam novas atribuições. Há ligação do custo ao histórico do lembrete. A mudança transitória de conta limpa os dados e a seleção de horas. Cache v128; nenhuma dependência nova.

## Validação local

Base `618845e2b8fc4f39a292aa99bbef6f8d85b6498e`, fecho da TASK312. Passaram 466 testes unitários/70 ficheiros, incluindo oito testes novos do contrato, prova incorporada, cálculo exato, identidade tipada e compatibilidade dos comprovativos. Sintaxe: 610 ficheiros backend, 209 frontend e 62 scripts inline. Atualização de 37 migrações com preservação dos dados anteriores e igualdade do esquema final.

O grupo `test-field-reminder-labor.js` executa duas APIs sobre a base isolada e o navegador real. Verifica permissões, técnico/período, horas desconhecidas, cliente após transferência, reservas comuns, último cêntimo, mesmas identidades numéricas, recibo/reenvio concorrente, duas despesas pelo mesmo intervalo, rollback de evento/atualização e de componente, sobreposição posterior, recibo adulterado, anulação de recursos com custo preservado, prévia desatualizada e corrida entre valorização e anulação. Confirma parcelas individuais, composição mista, revisão/anulação conjunta, origem removida, projeção mensal por execução/técnico e pagamentos originais intactos. O resumo mensal mantém o denominador completo; o filtro do lembrete só reduz as linhas da consulta.

No navegador, passou seleção de horas independentes, rascunho sem consentimento, origem/técnico/duração/cêntimos adulterados, resposta atrasada após mudar e repor o tipo de serviço, bloqueio offline, duplo clique, resposta perdida, recuperação sem novo POST e reenvio idêntico. A anulação apresenta os custos afetados e o custo fica por rever até à anulação financeira. A composição mista passa revisão da fórmula, resposta perdida e consulta do comprovativo, revisão após anular as horas e anulação conjunta. Mudança de conta limpa a informação. Layout a 320/390/1440 px sem transbordo, com capturas claro/escuro revistas em `reports/field-visual/reminder-labor/`.

Regressões dirigidas: recursos dos lembretes, custo/intervalos de reparações, parcelas e composições de trabalho e repartição LABOR das manutenções, incluindo percursos de navegador. O runner passa a 216 grupos. A validação local usa PostgreSQL embebido; o CI completo com PostgreSQL 16 e restauro da árvore publicada ainda tem de ser confirmado antes do fecho.

## Continuação e limites

Prosseguir a origem de consumo e os custos dos materiais próprios dos lembretes. Mantêm-se abertos associação explícita a visitas, múltiplos intervalos separados, repartições entre períodos/meses, restantes gastos/ajustes/origens, históricos/ecrãs/PDFs/idiomas, volume, operação prolongada, fornecedores reais e piloto físico. A cobertura das visitas conserva o denominador REGULAR/EXTRA; este custo entra nas atribuições por execução e técnico sem declarar cobertura financeira integral ou lucro.

Publicar apenas na branch `work/field-readiness-20260915-simulation`. Principal `feature/technicians-v25` preservada em `6f27081e1d183ff584a62255b016b373836734db`. Sem merge, deploy, contactos reais ou alterações destrutivas de produção neste lote; fornecedores desligados nos ensaios.
