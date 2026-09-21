# Gestão com IA e contexto financeiro — TASK280

Data: 21/09/2026. Branch: `work/field-readiness-20260915-simulation`.

## Problema e resultado

O proprietário pediu uma área para conversar com a IA sobre a gestão financeira e receber recomendações para a empresa/sistema. A página `/admin-ai` e a API `/api/ai-admin` já existiam, mas usavam critérios financeiros antigos. A reprodução isolada em `/tmp/cw280-baseline.log` mostrou um DRAFT de 1000 euros contado como pendente e nenhum devedor, apesar de um PARTIAL com 60 euros por cobrar e um ISSUED com 80 euros. O esperado era dois documentos e 140 euros.

A página existente passa a chamar-se **Gestão com IA**, com entrada em Faturação e financeiro, seleção de gestão financeira/operações, mês, consulta explícita e perguntas rápidas. Não foi criada outra API de IA. A conversa financeira mostra os dados e recomendações locais mesmo sem um fornecedor de IA configurado; a resposta externa é opcional e identificada. A área operacional mantém o seu percurso separado.

## Fontes e significado dos valores

`aiFinancialContextService` consulta, numa transação RepeatableRead, os recebimentos do mês, os documentos desse mês, os documentos de todos os meses e os créditos dos clientes. Reutiliza `cashReceiptReportService`, `monthlyFinancialProjection` e as regras de período de `operationalValueReportService`.

- Recebimentos: `Payment.paidAt` no mês UTC selecionado; créditos internos normalizados não representam novas entradas. O mês documental explícito prevalece sobre o campo legado; só se usa o mês legado quando `monthRef` está ausente.
- Por cobrar/vencido: saldo documental atual de todos os meses, com data da consulta. Inclui PARTIAL/ISSUED elegíveis; exclui rascunhos, cancelados e documentos de crédito/depósito conforme a projeção comum. Atraso usa vencimento anterior ao início do dia UTC; falta de vencimento é uma lacuna própria, não um atraso presumido.
- Totais não têm limite de linhas. A lista de clientes mostra apenas os dez maiores saldos identificados e declara quando é uma amostra. Agrupa por ID de cliente, sem confundir nomes iguais.
- Créditos: saldo atual de todos os clientes, incluindo inativos; é um compromisso com os clientes e não novo recebimento.
- Estados/montantes inválidos deixam os totais afetados por confirmar. Falha de consulta devolve fonte indisponível e valores nulos, sem converter falhas em zeros. Fontes operacionais com erro também deixam de produzir contagens fictícias.

O mês selecionado não reconstrói um fecho histórico. Custos completos, lucro, margem, saldo bancário e previsão de tesouraria continuam indisponíveis. Não se utiliza a diferença legada entre recebimentos e contas a receber como saldo bancário. Recomendações locais explicam cobranças vencidas, datas em falta, créditos e necessidade de custos completos; não inventam poupanças nem diagnósticos de desempenho/segurança do servidor sem medições.

## Conversa, acesso e fornecedor opcional

O acesso usa a autenticação ADMIN canónica, incluindo conta ativa e mudança obrigatória de palavra-passe, com respostas privadas/sem cache. Conversas pertencem ao ADMIN que as criou: lista, detalhe e continuação não expõem conversas alheias nem atribuem automaticamente conversas antigas sem titular.

O chat valida campos, mês, âmbito, mensagem e identidade da conversa antes de escrever. O histórico usado pelo modelo limita-se às últimas vinte mensagens compatíveis com o mesmo mês/âmbito. O percurso financeiro escreve apenas mensagens/conversa; não guarda nem executa propostas de alteração financeira, mesmo que um fornecedor devolva ações inesperadas.

O fornecedor recebe apenas o contexto financeiro e o histórico compatível, sem ferramentas de pesquisa web. O esquema financeiro estrito contém resposta e recomendações, com propriedades adicionais recusadas. Resposta incompleta, recusa, JSON inválido ou falha do fornecedor passam para regras locais identificadas. Esta separação segue os requisitos de [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) para objetos estritos e tratamento de respostas incompletas/recusas. Campos de cliente são dados não confiáveis, não instruções; a interface apresenta-os como texto literal.

As sugestões externas precisam de revisão com os valores apresentados. Não há validação matemática de cada frase gerada. A configuração/chave da VPS e uma chamada a um fornecedor real não foram verificadas nem ativadas neste lote. O teste usa uma chave fictícia e um servidor HTTP local isolado. As APIs legadas paralelas e o motor de ações operacionais não foram consolidados nem integralmente auditados nesta tarefa.

## Interface e recuperação

A interface identifica o período dos recebimentos, a natureza atual dos saldos, a data da consulta e as limitações. Mudar mês, âmbito ou conta invalida respostas e conversas anteriores. Protege mudanças A–B–A, outras abas, BFCache, timeout e respostas antigas/malformadas. Uma pergunta fica conservada após perda da resposta, sem repetição automática; mudança de conta elimina o conteúdo privado e preserva rascunhos alheios.

Os cartões usam uma coluna até 520 px para conservar valores elevados legíveis no telemóvel. Conteúdo dinâmico é literal, ligações de recomendações têm destinos permitidos e o modo local/externo é visível. Cache frontend v96. Não há migração: mantêm-se as 22 existentes.

## Verificação

- API: permissões, conta inativa, isolamento de conversas, validação antes de escrita, critérios de rascunho/parcial/emitido, mês legado, limites UTC, crédito interno/inativo, totais sem truncagem e amostra de dez clientes. Confirma isolamento do contexto enviado ao modelo, ausência de ferramentas web, recusas/incompletos/erros, fontes indisponíveis sem chamada ao fornecedor e preservação de documentos/pagamentos/ações.
- Chromium real: conversa local e fornecedor simulado, texto literal, larguras 320/390/1440, contraste em modo escuro, duplo clique, resposta perdida, fonte indisponível, respostas inválidas, offline/timeout, mês/sessão A–B–A, BFCache, conta noutra aba, modo operacional e ausência de escrita financeira.
- `/tmp/cw280-final.log`: os dois novos grupos, caixa com mais de 10000 movimentos e interface de relatórios ADMIN aprovados. Ajuste visual final aprovado em `/tmp/cw280-mobile-final.log`; imagens revistas em `reports/field-visual/financial-ai-1790018570561/`. A primeira espera de recarga do teste foi corrigida para respeitar a invalidação real após restauro do mês pelo navegador, sem retirar asserções.
- 396 testes unitários/63 ficheiros, quatro técnicos, 21 scripts de navegador e sintaxe 565 backend/186 frontend/56 inline aprovados localmente. `git diff --check` sem erros.
- Runner passa de 163 para 165 grupos. O limite global do workflow passa de 20 para 25 minutos porque o CI anterior demorou 19m19s antes destes dois grupos; todos os gates e o limite individual de 120 segundos permanecem. As flags de IA externa/web ficam explicitamente desativadas no ambiente QA.

Publicação e CI PostgreSQL 16/restauro da árvore final pendentes neste registo inicial. Base `af690b5de4bb816ca9b1b28869906901a9ec71ea`; comparação com o GitHub sem divergência e principal `feature/technicians-v25` (`6f27081e1d183ff584a62255b016b373836734db`) como antepassado. Publicação autorizada na mesma branch, sem força.

## Ficheiros e continuação

17 ficheiros: workflow, `frontend/admin-ai.html`, `frontend/admin-ai.js`, `frontend/crystal-os-v2-nav.js`, `frontend/sw.js`, fixture QA `financial-ai-server.js`, grupos `test-field-financial-ai.js`/`test-field-financial-ai-ui.js`, runner, controller/auth/routes `aiAdmin`, serviços `aiAdminContextService`/`aiAdminLlmService`/`aiFinancialContextService`, este documento e `CURRENT_WORK_CHECKPOINT.md`.

Próxima evolução financeira: registo e conciliação de despesas/custos, com fontes históricas e atribuição por cliente/instalação, antes de calcular margem ou previsão. Preços/frequências continuam caso a caso por cliente, época e instalação, com três ou mais visitas quando necessário. A faturação fiscal com IVA continua no programa externo. A reconciliação explícita e auditável dos emails mensais antigos/FAILED/UNKNOWN/PENDING permanece uma tarefa própria. Este lote não inclui merge na principal, instalação na VPS ou contactos reais.
