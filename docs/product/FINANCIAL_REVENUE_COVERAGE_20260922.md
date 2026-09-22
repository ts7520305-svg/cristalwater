# TASK285 — Valores documentados por serviço

Data: 22/09/2026. Branch: `work/field-readiness-20260915-simulation`. Base publicada e sincronizada: `88f29d17e12261f1d1e66932ea97bad7dc3aae77`, encerramento documental da TASK284. Principal `feature/technicians-v25` confirmada no mesmo SHA `6f27081e1d183ff584a62255b016b373836734db` e ancestral da branch de trabalho.

## Resultado e utilização

Gestão com IA, em `/admin-ai`, apresenta **Valores documentados por serviço** no mês de análise e a pergunta **Receitas por serviço**. Quatro cartões distinguem valores ligados a serviços, mensalidades por repartir, outras linhas por repartir e ligações por rever. Listas expansíveis identificam cliente, documento, linha, visita regular/extra e mês de conclusão. O acesso aos documentos usa `/invoices`, já existente.

É uma repartição de valores históricos documentados, em consulta. Reutiliza o contexto financeiro, a autenticação ADMIN, a mesma transação RepeatableRead e os percursos de conversa existentes. Não cria atribuições persistentes, novas cobranças, pagamentos, alterações de preços, ações executáveis ou documentos fiscais. A faturação com IVA permanece num programa externo.

O mês é o de referência do documento, com precedência de `monthRef` e os formatos históricos já suportados. Não é o mês do pagamento nem necessariamente o mês de conclusão. Serviços terminados noutro mês mantêm essa indicação; os valores não são transferidos de período nem subtraídos automaticamente aos custos do mês. Uma consulta a um mês passado usa o estado atual dos documentos e serviços, sem reconstruir um fecho histórico.

## Valores e cobertura

Só entram nos subtotais documentos de cobrança com estado conhecido, totais válidos e linhas cujo total coincide exatamente com o documento. Valores monetários são verificados em cêntimos inteiros seguros. `total` e `lineTotal` de cada linha têm de coincidir; os campos documentais em cêntimos, quando positivos, também têm de corresponder ao total. Não se recalculam linhas por preços atuais, número de visitas ou configurações comerciais atuais.

Documentos sem linhas, com aliases monetários incompatíveis, precisão inválida, tipos desconhecidos/conflituantes, créditos, descontos, ajustes, saldos transportados, imposto não repartido ou soma divergente ficam por rever e fora dos subtotais. São identificados por documento, sem apagar ou corrigir automaticamente os dados. Rascunhos, documentos retirados e depósitos de crédito ficam excluídos conforme a classificação financeira existente. Pagamentos de crédito interno não se tornam novas receitas nem reduzem outra vez o preço documentado do serviço.

As quatro parcelas somam o total dos documentos com linhas conciliadas. Não se somam novamente a documentos, recebimentos ou despesas. Reparações e intervenções periódicas reconhecidas ficam em outras origens por repartir; a referência numérica de uma reparação ou intervenção nunca é usada como se fosse uma visita.

Mensalidades permanecem por repartir conforme o contrato histórico de cada cliente e época. Não há divisão automática em partes iguais pelo número de visitas, nem pressuposição de preço/frequência uniforme. A atribuição explícita dessas mensalidades e das outras origens, a conciliação de ajustes e o alinhamento de receitas/custos pelo período de execução são trabalhos seguintes.

`finance.revenueCoverage` mantém `state: PARTIAL`, `completeRevenueAllocation: false`, `revenue: null` e `profit: null`, mesmo sem lacunas detetadas. Estes indicadores não estabelecem receita completa, lucro, margem ou saldo bancário.

## Ligações aos serviços

Linhas `SERVICE` correspondem a visitas REGULAR e `EXTRA_VISIT` a visitas EXTRA. Os dois espaços de identificadores são separados. Aceitam-se tipos históricos normalizados e um alias único, sem escolher silenciosamente entre tipos incompatíveis.

A ligação exige serviço existente, concluído, com data de conclusão e cliente registado diretamente igual ao do documento. Clientes históricos inativos são incluídos; mudar o proprietário atual da piscina não transfere a identidade do serviço antigo. Visitas regulares marcadas como incluídas no contrato, extras incluídos no pacote ou com condição comercial sem confirmação ficam por rever.

A unicidade considera referências em documentos de todos os meses, não apenas o selecionado. Documentos de cobrança com estado desconhecido também bloqueiam uma ligação supostamente única até revisão; rascunhos, retirados e depósitos de crédito são excluídos deste denominador. Uma linha com aliases REGULAR/EXTRA incompatíveis sinaliza ambas as identidades. Referências ausentes, apagadas, repetidas, cliente alterado, serviço reaberto ou data em falta não recebem uma ligação confirmada.

São apresentados os valores guardados nas linhas, sem reconstruir uma tarifa histórica a partir do preço atual da visita. A consulta não modifica documentos, pagamentos, visitas, preços ou ações da IA.

## Interface e integridade

Contagens e valores são completos; listas de ligações e casos a rever têm até dez exemplos, com total e indicação explícita de amostra. O navegador verifica identidade do mês e da consulta, bases, moeda, contagens, somas, limites, identificadores, motivos conhecidos e coerência dos valores da amostra. Nomes são apresentados como texto literal. Mudanças de mês, âmbito ou conta, BFCache e respostas antigas conservam as proteções anteriores e apagam os novos dados apresentados.

Falha de qualquer consulta deixa todo o contexto financeiro indisponível, com valores e cobertura nulos; o fornecedor externo de IA não é chamado. Documentos ou ligações por rever colocam o contexto em REVIEW. Respostas locais e contexto opcional do modelo explicitam as bases e as limitações, sem usar amostras para recalcular totais nem propor ações financeiras executáveis.

Sem nova migração ou dependência: mantêm-se 25 migrações. Cache frontend v101. Runner ampliado de 172 para 173 grupos.

## Validação e publicação

API nova e regressões da IA financeira API/interface aprovadas em `/tmp/cw285-focused.log`. Exercitados formatos históricos de mês e precedência de `monthRef`, identidades REGULAR/EXTRA com o mesmo número, cliente inativo, transferência de piscina, preços atuais diferentes, conclusão noutro mês, crédito interno, referências entre meses/estados/aliases, visitas alteradas/incluídas, valores zero/fracionários, documentos inválidos/ajustados, totais completos, amostras e indisponibilidade sem fornecedor real. Consultas e conversas preservam os registos financeiros e operacionais.

Interface real ampliada com mensalidade e duas visitas tipadas, incluindo conclusão noutro mês, nomes extensos e conteúdo semelhante a HTML apresentado literalmente. Validação em 320/390/1440 px, contraste com preferência escura, pergunta rápida, respostas malformadas, isolamento de conta/mês, perda de resposta e preservação de pergunta. Regressões de cobertura dos custos, atribuições de despesas e valorizações aprovadas em `/tmp/cw285-regression.log`. Versão final da interface aprovada em `/tmp/cw285-final-ui.log`; imagens em `reports/field-visual/financial-ai-1790060994339/`, incluindo `revenue-320.png`, `revenue-390.png` e `revenue-1440.png`. Toast de ligação instável nas capturas provém do ensaio intencional anterior de falha de pedido.

396 testes unitários/63 ficheiros aprovados em `/tmp/cw285-unit.log`. Sintaxe 575 backend/189 frontend/57 scripts inline verificada em `/tmp/cw285-syntax.log`. Validação local em base descartável; confirmar ainda CI nativo PostgreSQL 16 e restauro da árvore publicada. Não usar o CI da TASK284 como aprovação desta alteração.

Publicar os doze ficheiros na mesma branch autorizada, sem força, confirmando igualdade da árvore Git. Sem merge na principal, instalação no VPS, movimentos financeiros, contactos ou fornecedor de IA real. Depois confirmar os 173 grupos e o restauro e publicar o encerramento documental.
