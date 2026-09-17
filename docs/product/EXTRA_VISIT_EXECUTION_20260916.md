# Execução de visitas extra — TASK211

Atualização em 17/09/2026: TASK211–212 publicadas e confirmadas no CI `35179629224`, com 115 grupos, 19 migrações e restauro de 110 tabelas/31 ficheiros. Água/bomba em ExtraVisit são tratadas posteriormente na TASK213 (`EXTRA_VISIT_SAFETY_20260917.md`).

## Resultado

ExtraVisit tem agora início/fim, registo próprio de execução, comprovativo de conclusão e fotografias próprias. A migração é aditiva: conserva as visitas antigas, acrescenta ExtraVisitPhoto e identifica os consumos por extraVisitId nas duas tabelas de stock. Não cria ServiceVisits artificiais nem atribui dados históricos por coincidência numérica.

No mesmo ecrã de campo, o técnico pode iniciar, preencher medições/checklist/notas, fotografar, registar produtos e concluir uma visita extra. Rascunhos distinguem conta/tipo/ID. Início, fotografias e conclusão usam pedidos persistidos antes do envio, com UUID, conteúdo e confirmação imutáveis. Uma resposta perdida pode ser repetida sem repetir os efeitos; fotografias pendentes são confirmadas antes da conclusão. A consulta da ronda inclui também extras iniciadas ou concluídas no dia.

O servidor verifica atribuição e piscina, bloqueia alterações concorrentes e guarda conclusão, ambos os movimentos de stock, histórico, aviso ADMIN, registo comercial e comprovativo numa única transação. Produtos repetidos são agregados; nome/unidade têm de corresponder à guia aberta da viatura do técnico. Falta de stock, unidade errada e falha de confirmação revertem os efeitos. Fotografias extra exigem sessão e autorização sobre a visita, incluindo o acesso ao ficheiro. O ecrã carrega-as com autenticação.

## Registo comercial

O antigo appendToBilling podia acrescentar o mesmo item em cada atualização e marcar a visita como faturada sem fatura. O registo mensal passa a ter um item por visita e permanece pendente até à inclusão num documento. Incluídas e gratuitas não são cobradas mesmo que conservem um preço histórico. A geração CORE reserva também as referências de extras já presentes em qualquer fatura, impedindo nova cobrança noutra mensalidade quando uma flag antiga é incoerente. O critério monetário é totalPrice, unitPrice e depois price, sem substituir um zero explícito.

Os antigos endpoints que marcavam todos os extras como faturados e enviavam PDFs sem documento passam a recusar a operação e indicar Faturas. A página de extras mostra fontes concluídas por faturar e abre esse ecrã; não executa faturação em lote. Os PDFs de extras usam a mesma seleção elegível. Faturas existentes e condições comerciais de visitas fechadas são preservadas. Alterar destino/atribuição/preço de uma visita iniciada ou já fotografada exige revisão; não é uma correção silenciosa da execução.

A revisão posterior reproduziu uma marcação indevida de faturada quando totalPrice era zero e price conservava um valor antigo: não existia linha de fatura correspondente. A seleção final exige agora pelo menos um cêntimo segundo a precedência dos preços; zero explícito, unitPrice zero e arredondamento inferior a um cêntimo conservam billed=false. Associações contraditórias entre cliente e piscina recusam a geração para ambos os clientes, com rollback integral; uma correção explícita permite depois gerar uma única linha.

## Evidência

- TASK210 publicada em a34a510773669cde146c0d71d12ac55c43686035, árvore 4e5107e968e497c67d59c3f7dff116b37a8648a2, CI 35150598966: 113 grupos e restauro de 109 tabelas/29 ficheiros.
- TASK211: ensaio de API/base/Chromium aprovado em run-1789593920606 e run-1789594079244. Oito inícios/conclusões simultâneos devolvem a mesma confirmação; visita regular com o mesmo número permanece igual; dois produtos repetidos deduzem uma única quantidade agregada. Ensaiados acesso às fotografias, reenvio, notas do planeador preservadas, duas extras concorrentes no mesmo relatório, incluídas/gratuitas, reserva comercial entre meses e rollback após falha forçada do comprovativo.
- Percurso real: início, fotografia, rascunho e recarga offline, conclusão guardada, perda da resposta após commit, recuperação e consulta final com fotografia privada. Testados 320/390/1440 px. Não são medições de desempenho do PostgreSQL nativo; o executor local usa PGlite por TCP.
- Regressão de fotografias/conclusões antigas aprovada em run-1789593920606; E2E dos três perfis, identidade das visitas e geração de faturas aprovados em run-1789594079244. O E2E revelou que uma atualização do painel podia fechar os detalhes dos envios durante uma repetição; o estado aberto é conservado e a lista é atualizada também após erros.
- A fixture de PDF antigo passou a exigir uma visita concluída: planeadas e gratuitas não são fontes de cobrança. Validação final destes PDFs, interface administrativa e novo fluxo em run-1789594225557.
- 388 unitários, quatro testes de técnicos, 17 scripts de navegador e sintaxe de 536 ficheiros backend aprovados. Dezanove migrações aplicadas à base anterior preservaram os dados e produziram o esquema atual. Runner ampliado para 114 grupos; confirmar CI/restauro da árvore publicada, com 110 tabelas esperadas.
- Regressão de preço zero reproduzida em `run-1789595245543`; correção, associações contraditórias e toda a regressão de geração de faturas aprovadas em `run-1789595299307`. O commit local inicial da TASK211 é `7b2cf929332959bda3d4c6ad5a6ad6a199137d6b`; a publicação deste lote foi bloqueada pela revisão automática por exigir autorização explícita nesta conversa para o repositório público/destino. A branch remota continua na TASK210; não atribuir ao lote novo o resultado do CI anterior.

## Limites e próximos passos

A execução base de extras está implementada. A correção de uma extra concluída, impedimentos/regressos, água aberta/bomba em manual associados à extra e manutenção de equipamento durante a extra continuam a exigir fluxos próprios. Os controlos regulares dessas ações permanecem protegidos; o ecrã indica o contacto com o escritório. Não se declara essa assistência já implementada na aplicação.

A página antiga do técnico conserva o seu contrato de ServiceVisit; o fluxo novo é o modo de campo moderno. A concorrência por campo dos rascunhos modernos, restantes filas, TEAM_LEADER, paginação, inventário visual completo e requisitos avançados continuam na matriz corrente. Históricos comerciais duplicados ou incoerentes não são corrigidos por adivinhação: a operação solicita revisão e conserva-os. Nenhum deploy, fornecedor real, email externo ou emissão fiscal foi executado.
