# TASK242–243 — cadastro de campo e aprovação recuperáveis

## Estado

Implementação e ensaios locais concluídos em 17/09/2026, sobre `1afc751eb3244e272732ea564aa4a74828f2ee51`. Publicação e CI/restauro nativo da árvore final por confirmar. Cache v68; runner com 137 grupos e 21 scripts de navegador. Sem migração: criação e aprovação usam a tabela existente FieldWriteRequest, com âmbitos próprios.

O diagnóstico anterior está em `FIELD_CLIENT_INTAKE_REVIEW_20260917.md`: resposta perdida/reenvio criava dois clientes, coordenadas/volume inválidos eram persistidos, a consulta técnica devolvia configurações alheias ao cadastro e a aprovação podia deixar cliente aprovado/piscina pendente com revisor enviado pelo navegador. As correções seguintes são deste fluxo; não se estendem automaticamente a outros escritores de clientes/piscinas.

## Criação

`FIELD_CLIENT_INTAKE` identifica o proprietário tipado, técnico autenticado, UUID e onze campos exatos do formulário. O contrato moderno não permite ADMIN personificar um técnico. User associado e chefe de equipa usam o Technician autenticado; identidades enviadas pelo navegador não substituem a sessão. Nomes, comprimentos, email, tipo de piscina, volume positivo e par latitude/longitude são validados. Coordenadas zero são válidas e conservadas.

Cliente, piscina, tarefa de completar a ficha, auditoria e comprovativo são gravados na mesma transação. A tarefa e a auditoria são obrigatórias. Repetir o mesmo pedido recupera a resposta original, inclusive após reinício, concorrência entre processos ou desativação posterior da permissão de cadastro. Outro conteúdo com o mesmo identificador é recusado.

A configuração é consultada no servidor durante a criação; a resposta identifica a política efetivamente aplicada. Cliente/piscina ficam ativos ou pendentes conforme essa política. Não se cria visita, fatura, movimento de stock ou ativação de contrato/faturação. A tarefa de completar dados técnicos, preços, acessos e ronda permanece distinta da aprovação do cadastro.

`/settings` devolve apenas as três capacidades do cadastro. As respostas de cliente/piscina usam uma projeção explícita sem credenciais ou valores financeiros. Chamadas antigas sem UUID conservam a resposta identificada como `LEGACY_NO_REQUEST_ID`, com validação e transação, mas sem deduplicação. ADMIN antigo mantém autoria real e pode indicar o técnico de origem conforme o contrato anterior.

## Revisão e aprovação

A lista ADMIN inclui também clientes já aprovados que ainda tenham piscinas pendentes, permitindo reconciliar estados parciais históricos. Expõe os dados do cadastro, piscinas e uma versão opaca autenticada do conjunto. O ecrã usa texto literal para nomes e notas, sem inserir HTML submetido.

`FIELD_CLIENT_APPROVAL` exige administrador autenticado, UUID, cliente, versão consultada e lista explícita das piscinas pendentes. Bloqueia cliente e piscinas, compara o estado e grava ativação, revisor real, uma data comum, auditoria e comprovativo na mesma transação. Não altera valores financeiros nem reativa piscinas já revistas e intencionalmente inativas. Fichas arquivadas/eliminadas, origens incompatíveis e estados sem pendência exigem revisão em vez de ativação cega.

Uma ficha alterada depois da consulta recebe recusa persistida e recuperável. O administrador reconhece essa recusa e consulta os dados atuais antes de preparar outra aprovação. Resposta perdida e reenvios concorrentes conservam a primeira aprovação, data e auditoria. A confirmação continua disponível mesmo depois de o cliente desaparecer da lista de pendentes ou sofrer edições posteriores. Chamadas antigas sem UUID têm atomicidade e autoria da sessão, mas não recebem a proteção de versão/comprovativo do contrato moderno.

## Interfaces

O formulário conserva os onze campos num rascunho por conta. O pedido é guardado antes do POST, com coordenação entre janelas e confirmação exata de conteúdo, cliente, piscina, política e autoria. A ficha só se limpa depois de a confirmação ficar guardada e a limpeza local ser verificada. Falhar essa limpeza permite limpar a ficha confirmada sem repetir o envio.

Recarga offline, quota/corrupção, resposta tardia, troca de conta, BFCache e divergência entre janelas preservam o pedido. Uma resposta GPS tardia não substitui coordenadas depois de o formulário mudar; a apresentação das coordenadas também é limpa quando muda a sessão. A revisão do dia mostra cadastro por confirmar e rascunho por enviar. O novo fluxo não apaga nem reatribui filas históricas.

Na administração, a aprovação é persistida antes do transporte. O painel mostra pedidos guardados independentemente da lista atual do servidor, distingue falha de consulta de lista vazia e permite recuperar confirmação ou rever uma recusa. Ativar o cadastro não anuncia visita agendada, contrato ativo ou ficha técnica completa.

## Evidência

| Ensaio | Resultado local |
|---|---|
| API de cadastro | Resposta perdida, reinício, seis reenvios entre dois processos, UUID/conteúdo, User/chefe de equipa e permissão desativada após commit; um cliente/piscina/tarefa/auditoria. |
| Falhas de criação | Inserções obrigatórias de Pool, Task, UserAuditLog e FieldWriteRequest falham por trigger; todas as escritas revertem e o pedido original pode ser repetido. |
| Aprovação | Falhas em piscinas/auditoria/comprovativo revertem o conjunto; versão obsoleta produz recusa imutável; reenvios conservam autor e data. Duas piscinas pendentes são ativadas, outra já revista/inativa é preservada, assim como montantes, crédito e estado de contrato/faturação existentes. |
| Formulário real | Onze campos após recarga offline, quota antes do POST, GPS tardio, conteúdo de resposta alterado, quota na confirmação/limpeza, mudança de conta, BFCache, duas janelas e JSON corrompido. Revisão do dia inclui o cadastro pendente. |
| Painel ADMIN real | Texto literal, aprovação offline, reload, recusa por alteração concorrente, revisão explícita, resposta perdida após saída da lista, revisor de resposta falsificado e troca tardia de conta. |
| Apresentação | 320/390/1440 px sem transbordo; botões de recuperação/aprovação visíveis. Aviso com contraste corrigido e medido; título humano do cadastro e ações ADMIN sem fragmentar o link. Capturas Chromium revistas. |

API e regressão de autenticação aprovadas em `run-1789677722606` (3124/1132 ms). API final com várias piscinas e valores financeiros não nulos aprovada em `run-1789678107472` (3913 ms). Uma execução conjunta anterior, `run-1789678016004`, teve 401 num ensaio de falha que esperava 503; não é aprovação global. A mesma API passou na repetição isolada sem alteração de produção; nessa execução conjunta, UI de cadastro e regressão de ocorrências passaram em 10378/18982 ms. O CI PostgreSQL nativo continua obrigatório.

UI com revisão do dia, contraste e regressão de material aprovada em `run-1789678174509` (12378/14716 ms). Ajuste final das ações ADMIN aprovado em `run-1789678272634` (12038 ms). 388 unitários e sintaxe de 543 JS backend/179 frontend/57 inline aprovados. Inventário: 101 HTML, 94 páginas de raiz, sete auxiliares, 56 referências literais, zero assets ausentes e zero divergências de guardas/catalogação; 158 scripts ativos. Referências literais não demonstram cobertura global.

## Limites

- Rascunho e recuperação dependem do dispositivo original, armazenamento local, IndexedDB e Web Locks. Não há cópia remota do rascunho ainda não enviado; uma falha de gravação é apresentada como tal.
- Uma ficha por confirmar por conta; uma aprovação pendente por cliente. Recuperação e revisão são explícitas. Não foi acrescentada transferência ou cancelamento de pedidos já tentados.
- O formulário técnico tem recarga offline ensaiada. O painel ADMIN tem preparação sem rede e recuperação após reload com a página disponível; não se declara a central administrativa integralmente disponível offline.
- A tarefa de completar a ficha não é concluída automaticamente pela aprovação. Dados antigos de origem incompatível/arquivada exigem revisão, e chamadas antigas sem UUID mantêm as limitações indicadas.
- Português e três larguras foram ensaiados. A revisão global de idiomas/PDFs, dispositivos reais e serviços externos continua na matriz.
- Próximo percurso já reproduzido: relatório ADMIN que omite o período e apresenta fontes indisponíveis como zeros/estado atualizado. Não foi corrigido neste lote.
