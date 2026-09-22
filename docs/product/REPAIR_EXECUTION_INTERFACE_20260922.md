# TASK290 — Confirmação operacional de reparações

## Âmbito

Continuação autorizada da TASK289 a partir de `28877d7ed3180fd69430cf8867be9f4ffc9f9e2b`, na branch `work/field-readiness-20260915-simulation`. Acrescenta o ecrã `/repair-execution`, acessível nos menus de administração e técnico, com pesquisa por reparação/piscina, paginação de dez e consulta da reserva antes da declaração de execução. Mantém as permissões de reparação ADMIN/TECHNICIAN e a implicação TEAM_LEADER existentes. Não associa automaticamente a reparação a uma visita ou técnico diferente.

A declaração regista a data atual do sistema e consome os materiais da reserva aprovada. Não é uma verificação física independente nem uma data histórica inferida. Faturação e pagamentos conservam os percursos existentes; faturação fiscal com IVA externa. Valores/frequências dependem de cada cliente, contrato e época.

## Integridade e recuperação

- Leitura e comandos novos em `/api/repairs/execution`, `/:id/execution` e `/:id/execution/requests/:requestId`. Respostas sem cache. Lista com contagem completa e dez resultados; nenhuma consulta cria confirmação, stock ou fatura.
- O detalhe mostra reparação, piscina, estado e produtos/quantidades/unidades/origem da reserva. Os novos contratos usam listas explícitas de campos, sem preços, contactos, notas comerciais ou identidade de cliente no perfil técnico. A reserva completa e a identidade do titular entram apenas no hash opaco de contexto.
- A revisão usa os bloqueios e as condições da TASK289. Versão inclui a origem operacional, estado/datas, piscina/titular/nome e reserva, com datas serializadas antes do hash. Apenas uma reserva válida e aprovada permite confirmar; materiais vazios ou incoerentes, históricos e confirmações por rever permanecem bloqueados.
- O POST exige identificador de pedido, piscina, versão revista e confirmação explícita. Campos desconhecidos, identidades tipadas incorretamente e confirmações incompletas são recusados. Na transação, recupera primeiro o pedido original, bloqueia a origem, revalida o contexto e só depois executa a conclusão existente.
- Reutiliza `FieldWriteRequest` com âmbito `REPAIR_EXECUTION`. Confirmação, consumo, histórico, auditoria, notificação e recibo recuperável são atómicos. Falha ao guardar o recibo reverte o conjunto. Eventos conservam os campos anteriores e são emitidos depois do commit; a repetição de um recibo não emite novamente.
- O mesmo pedido devolve exatamente o resultado original, mesmo após alterações administrativas posteriores. Pedidos distintos sobre a mesma versão resultam numa aplicação e numa recusa persistente, com um único consumo. Uma versão desatualizada recebe recusa recuperável, sem alterar o estado operacional. O resultado pertence à conta autenticada e é conferido por âmbito, reparação, pedido e hash.
- IndexedDB guarda o pedido por conta antes do envio; Web Locks impedem envios simultâneos entre janelas. Pedido incerto sobrevive à reabertura, com consulta de resultado sem nova execução e repetição explícita do mesmo conteúdo. Não há reenvio automático ao recuperar ligação. Um resultado não encontrado não prova que um envio em curso falhou.
- A interface só remove o pedido pendente depois de conferir o recibo, identidade, contexto e resultado e guardar a confirmação local. Respostas incompletas, falha de armazenamento ou dados locais inválidos preservam o pedido e bloqueiam novos registos. Uma recusa confirmada fica guardada antes de permitir nova revisão.
- Pesquisa/seleção nova invalida respostas atrasadas. Alteração de conta/token, incluindo A–B–A, encerra a vista e preserva os dados da conta original. Ficheiros/rascunhos locais alheios não são apagados. Texto é apresentado como texto literal.

## Validação local

- `test-field-repair-execution-command.js`: consulta sem escritas, autenticação/perfis, campos/IDs inválidos, seis pedidos iguais concorrentes, dois pedidos diferentes concorrentes, recuperação por titular, recibo imutável, contexto alterado em reparação/piscina/reserva/data, conclusão anterior, trabalhos sem material e rollback por falha no recibo.
- `test-field-repair-execution-ui.js`: lista/paginação, detalhe, checkbox obrigatório, duplo clique, perda de resposta posterior ao commit e reabertura, consulta sem reenvio, resposta adulterada e repetição exata, duas janelas, offline/online sem envio automático, reserva desatualizada, leituras inválidas/atrasadas/indisponíveis, conta A–B–A, armazenamento corrompido e conclusão pelo técnico sem exposição comercial. Sem fatura criada.
- Interface verificada a 320/390/1440 px e modo escuro; texto de teste com HTML permanece literal e não há transbordo horizontal. Imagens em `reports/field-visual/repair-execution-ui-1790099596756/`. O primeiro ensaio encontrou a reposição da pesquisa pelo navegador após reload, que corretamente invalida a lista antiga; o ensaio passa a clicar Consultar quando a vista exige atualizar a pesquisa, mantendo as verificações.
- Regressões da TASK289 (conclusão, provas e leitura financeira), eventos exatos e percurso operacional completo aprovados em `/tmp/cw290-regression.log`. Ensaios finais dos dois novos grupos aprovados em `/tmp/cw290-final-focused.log`; API inicial em `/tmp/cw290-command.log`.
- 396 testes unitários/63 ficheiros aprovados em `/tmp/cw290-unit.log`; sintaxe 583 backend/191 frontend/59 inline em `/tmp/cw290-syntax.log`. Runner com 181 grupos distintos. Catorze ficheiros, cache v106; sem esquema, migração ou dependência nova, mantendo 26 migrações e 119 tabelas.

## Publicação

Publicada sem força na branch `work/field-readiness-20260915-simulation`: commit `d4e8026a627b6ec4959a8997a8f11bbc0c64c8ad`, árvore `8e486f015c1af2c8c1c36acc9b4bb4db97d127d8`, igual à árvore local validada. Catorze ficheiros desde a base; cache v106, sem esquema, migrações ou dependências novas. Backup local `backup/repair-execution-interface-local-20260922` (`95e2232de9059c3fb9d79db28de5c659097c1e85`).

[CI 35763873430](https://github.com/ts7520305-svg/cristalwater/actions/runs/35763873430), job `106868353584`, aprovado no commit acima. As 17 etapas passaram; job de 17:56:13 a 18:17:40 UTC de 22/09/2026, duração 21m27s. Os registos completos confirmam os 181/181 grupos distintos previstos no runner, todos com código zero e sem sinal, 396 testes unitários/63 ficheiros, quatro testes de técnico e gate geral do navegador. As 26 migrações aditivas preservam os dados anteriores e correspondem ao esquema atual; sintaxe 583 backend/191 frontend/59 inline aprovada. Restauro PostgreSQL 16: 119 tabelas e 46 ficheiros recuperados, com linhas da base de dados e hashes dos ficheiros iguais.

Novo comando em 1288 ms e nova interface em 5068 ms. Conclusão da TASK289 em 3063 ms, conciliação da execução em 15062 ms, IA API/UI em 5287/18235 ms e percurso operacional antigo em 1027 ms. Faturação atómica, reserva mensal, pagamentos, origens documentais, mensalidades, manutenção e E2E também aprovados. Evidência consolidada em `/tmp/cw290-ci-evidence.json`.

O encerramento altera apenas este documento e `CURRENT_WORK_CHECKPOINT.md`, preservando o código aprovado. Principal ancestral e inalterada em `6f27081e1d183ff584a62255b016b373836734db`, sem merge, deploy ou contactos reais.

Próximo âmbito: definir uma declaração própria para reparações sem consumo de material e a eventual ligação explícita ao trabalho/visita de origem; preservar a distinção entre data de registo e data de execução. Períodos históricos e restantes origens/ajustes/custos continuam por estabelecer antes de margens ou previsões. Não transformar uma confirmação administrativa antiga em prova nova automaticamente.
