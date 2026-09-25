# TASK371 — Fecho manual revisto da guia de obra

## Comportamento entregue

O fecho antigo aceitava gravações repetidas, podia substituir notas/quilometragem e atualizava o conta-quilómetros da viatura numa segunda gravação cuja falha era ignorada. `/work-guide-close` substitui esse percurso, com entradas no histórico da administração, nos documentos do modo de campo e na página técnica antiga. O POST antigo responde 409 antes de gravar.

- Cada obra é escolhida pelo ID, com viatura, técnico, guia AT, notas originais e leituras atuais visíveis. O motivo do fecho é separado das notas da obra.
- «Conservar a leitura atual» preserva o valor exato, incluindo nulo; «Indicar uma leitura final» aceita zero explicitamente e até três casas decimais, sem coerções ou notação exponencial. Uma leitura nova não pode ser inferior à inicial.
- Atualizar o conta-quilómetros da viatura exige uma escolha adicional. Só é permitido numa viatura ativa e sem diminuir a leitura atual. Pode registar-se uma leitura histórica inferior na obra mantendo o conta-quilómetros da viatura.
- A revisão identifica os valores anteriores/finais e todos os saldos conservados. Fechar não movimenta materiais, repõe consumos, transfere saldos, resolve alertas ou muda o estado da guia AT. Documentos, notas, referências, visitas e finanças ficam conservados.
- Apenas obras abertas sem data de fecho anterior podem ser fechadas. Uma segunda tentativa independente é recusada; repetir o pedido já confirmado devolve o comprovativo original. ADMIN pode fechar uma obra histórica sem viatura conservando a leitura; não é inventada uma associação.

ADMIN autenticado por User, TECHNICIAN e TEAM_LEADER têm acesso. As duas identidades de campo, PIN/técnico e User associado, exigem o técnico ativo e a obra pertencente ao próprio técnico e à sua viatura atual ativa. Partilhar viatura não permite fechar a obra de outro técnico. CLIENT e ENV_ADMIN são recusados. Listas são paginadas em 25 obras, com pesquisa e filtro por ID; os dados devolvidos são selecionados explicitamente e privados. A fotografia está limitada a 100 linhas de stock; dados históricos incoerentes ou acima desse limite exigem revisão separada.

## Gravação e recuperação

Prova de cinco minutos assinada para conta, UUID, proposta, obra, viatura, técnico/atribuição, guia AT e stock. A confirmação relê a fotografia sob bloqueios, partilhando a ordem de viatura/obra usada pela abertura e gestão de transporte. Consumo, alteração da viatura ou reatribuição posterior à revisão impedem a gravação desatualizada.

Fecho, leitura final, eventual quilometragem da viatura, auditoria com autor autenticado e comprovativo são gravados na mesma transação. Quatro falhas SQL forçadas comprovaram reversão total. Duas revisões concorrentes têm um único vencedor; o mesmo UUID não duplica o fecho. Resposta perdida, reinício do processo e consulta/repetição conservam o resultado original; a prova recuperada em JSONB é validada por conteúdo. A consulta fica disponível ao autor mesmo depois de mudar a atribuição. Encerrar uma tentativa pendente cria uma anulação persistente que impede uma confirmação tardia.

Campos e proposta ficam apenas em memória. O separador guarda por conta apenas versão, proprietário, ID da obra e UUID do envio. Falha de armazenamento ou referência ilegível impede nova gravação sem substituir os dados existentes. Expiração, suspensão e troca de conta limpam campos/respostas e abortam pedidos. PT/EN/FR/ES/DE, largura móvel e alvos de 44 px verificados; nomes potencialmente ativos são apresentados como texto.

## Correção do CI anterior

TASK369 executou exatamente os 274 grupos previstos: **273 aprovados**, falhando apenas `test-field-equipment-time-review.js`. A recuperação de documentos corrigida na TASK369 passou. O restauro foi omitido após a falha; [evidência nativa](evidence/20260925_task369_ci.json).

Na revisão de tempos, a inicialização podia habilitar por instantes a consulta do pedido antes da primeira leitura do histórico. O teste instalava então uma resposta de histórico deliberadamente suspensa sobre essa leitura inicial; a consulta aguardava que essa mesma leitura terminasse. O editor partilhado mantém agora `loading` desde a inicialização. O teste espera também pelo histórico visível antes de suspender a atualização posterior à recuperação. Mantém o limite de tempo e todas as verificações de comprovativo, campos limpos e histórico atualizado. Os grupos de tempos, materiais e origem histórica são verificados integralmente.

## Validação e publicação

Evidência detalhada em [20260925_task371_local.json](evidence/20260925_task371_local.json). 857 unitários em 108 ficheiros, quatro técnicos e sintaxe 669 backend/279 frontend/44 scripts inline. Onze grupos locais distintos aprovados: nova API e navegador, gestão de transporte, consumo, revisões partilhadas, frota, documentos e preferências de navegação, em ambiente isolado com dados sintéticos. Dezoito capturas, cinco idiomas e larguras 320/390/1440. Nenhuma migração nova: permanecem as 43 migrações e 128 tabelas. Cache v182; runner passa a 278 grupos.

Publicação preparada na branch de trabalho; commit e CI serão registados após publicação. PostgreSQL nativo, suite integral e restauro permanecem por confirmar. A execução local usa PGlite e Chromium, não substitui esse gate. TASK370 ainda em execução na última consulta; último gate integral aprovado continua a ser TASK366, 268/268 e restauro.

## Continuação

Rever manutenção/custos da frota em `/admin-vehicles`: criação, conclusão, leituras e valores, auditoria, concorrência e recuperação. Atribuições, presets e regras de alertas conservam revisão própria. A abertura de dia e a eventual reativação não são criadas implicitamente pelo fecho. Volume real, conciliação histórica, política de arquivo/cópias, VPS e piloto físico permanecem abertos. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
