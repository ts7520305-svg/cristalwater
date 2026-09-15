# TASK131 — Conclusão coerente dos lembretes no CRM

## Falha reproduzida

Concluir um lembrete de serviço pela lista geral atualizava apenas essa lista. A lista da piscina conservava a ação Concluir no mesmo registo já fechado. Reprodução em `field-qa-runtime/run-1789474663761`: um botão indevido permaneceu visível. As duas funções de conclusão também não validavam a confirmação recebida nem apresentavam falhas de rede de forma controlada.

## Alteração

As listas geral e por piscina partilham uma leitura e um estado. O filtro de piscina é aplicado localmente ao conjunto recebido. São visíveis as duas categorias de serviço reconhecidas pela API; estados fechados/cancelados deixam de oferecer conclusão, mesmo no histórico geral. Mantém-se o histórico na lista geral.

Uma função comum trata os dois pontos de conclusão, impede cliques simultâneos no mesmo lembrete e verifica o ID, piscina, categoria, estado e próxima ocorrência da resposta. Só a confirmação válida atualiza as duas listas. Uma resposta perdida ou trocada conserva a possibilidade de repetição explícita, aproveitando a idempotência existente no servidor. Uma falha de leitura depois da conclusão não transforma o sucesso confirmado em falha nem volta a oferecer a ação antiga.

Cada leitura tem uma revisão. Ações e confirmações invalidam consultas anteriores; uma consulta antiga não pode repor o estado pendente. Leituras malformadas conservam os dados anteriores e apresentam erro. Mudanças de sessão impedem novos pedidos e limpam ambas as listas quando detetadas; respostas da conta anterior não são aplicadas.

As mensagens de conclusão têm áreas próprias junto das listas, sem substituir mensagens de criação pendente. Textos PT/EN/FR/ES/DE. A confirmação distingue a próxima ocorrência do lembrete acabado de concluir. A apresentação usa a prioridade real e melhora o contraste do botão Eliminar e dos textos secundários.

Sem alteração de backend, schema, migração, emissão de mensagens externas ou instalação no VPS. A ficha técnica e a agenda mantêm os seus percursos existentes. A conclusão continua a usar a API idempotente da TASK125.

## Validação

Ensaio dirigido aprovado em `field-qa-runtime/run-1789474965482`: novo percurso CRM, eliminação existente e recuperação de criação. Inclui ambos os pontos de conclusão, três cliques simultâneos, resposta perdida depois de gravar, repetição pelo outro ponto, resposta de outra piscina, falha na consulta após sucesso, cinco idiomas, categorias alternativas, histórico, cancelamento entretanto, filtro por piscina, consulta atrasada e duas mudanças de sessão durante o pedido.

272 testes unitários em 54 ficheiros, 4 testes de técnicos e os 17 scripts de navegador aprovados. Os 37 grupos integrados passaram em `reports/field-suite/1789475096683/results.json`. A revisão final de mensagens/contraste passou em `field-qa-runtime/run-1789475349814`, incluindo larguras 320/390/1280. Imagem revista: `reports/field-visual/crm-reminders-1789475367994/crm-lembrete-concluido.png`. O workflow do commit publicado confirma separadamente PostgreSQL 16 e restauro.

## Ficheiros

`frontend/admin-crm.js`, `frontend/admin-crm.html`, `frontend/cw-i18n.js`, `scripts/test-field-crm-reminders.js`, `scripts/test-field-reminder-delete.js`, `scripts/test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.

## Limites

A consulta continua a carregar o arquivo selecionado completo; paginação de arquivos muito grandes e revisão de outros ecrãs não fazem parte desta tarefa. A simulação local usa PGlite/Chromium e não mede desempenho do VPS ou de telemóveis físicos.
