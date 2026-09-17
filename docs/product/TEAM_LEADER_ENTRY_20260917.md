# TASK218 — Entrada do chefe de equipa

## Problema e resultado

Os logins por PIN e email já aceitavam TEAM_LEADER, mas os guardiões das páginas técnicas exigiam apenas TECHNICIAN e terminavam a sessão. A entrada passa a reconhecer os dois perfis no modo de campo, página antiga, ficha de visita e no contrato partilhado usado pela rota, mapa, guia, histórico, perfil e GPS. O guardião síncrono verifica ainda a concordância entre o papel local e o papel do token antes de mostrar a página.

As autorizações do servidor mantêm os seus contratos: a ronda do chefe continua limitada ao técnico autenticado, mesmo perante outro `technicianId` no pedido; visitas alheias e gestão de contas continuam recusadas. Este lote não unifica a visibilidade financeira de TEAM_LEADER e TECHNICIAN: a distinção existente é conservada.

Quando a ronda deixa de poder ser carregada, a interface limpa a seleção e os valores visíveis e bloqueia os campos sem visita. Uma recusa de autorização apresenta “Sessão por validar”. A cópia local e os rascunhos permanecem guardados; a resposta recusada não reativa uma ronda a partir da cache. Voltar a entrar com uma conta válida recupera os seus próprios dados.

## Identidade e recuperação

O login PIN mantém a identidade `TECH:<id>`. O login de User associado pelo email mantém `USER:<userId>:TECH:<id>`. Os rascunhos desses dois tipos de conta são distintos, mesmo quando apontam para o mesmo técnico. Logout conserva ambos; não transfere automaticamente conteúdo entre contas.

CLIENT e ADMIN continuam encaminhados para os respetivos portais. Um papel local diferente do token não abre o modo de campo. Sessões expiradas ou desconhecidas seguem para o login sem apagar o trabalho local. O backend continua responsável por validar assinatura, atividade e direitos atuais.

O service worker passa a v47 para atualizar os scripts de entrada. Sem alteração de schema ou migração; mantêm-se 20 migrações aditivas. O E2E geral passa a aguardar explicitamente a gravação assíncrona introduzida na TASK217, incluindo a falha simulada de quota.

## Evidência local

- `scripts/test-field-team-leader-entry.js`: logins reais por PIN/email com base de QA e Chromium; rota REGULAR/EXTRA própria, tentativa de consultar outro técnico/visita/contas, recarga offline, páginas técnicas reais, separação dos rascunhos, logout/reentrada, revogação do perfil e regressão de TECHNICIAN. Destinos de CLIENT/ADMIN e sessões inválidas são verificados no guardião da página real, com apenas as páginas de destino substituídas no ensaio.
- `run-1789634685206`: grupo novo e recuperação da ronda moderna aprovados. O primeiro ensaio identificou os campos editáveis sem visita após recusa de autorização; essa situação foi corrigida antes da aprovação.
- `run-1789634753211`: grupo novo ampliado com revogação durante a sessão aberta, recuperação após restaurar o perfil e preservação no guardião sem reinserir dados; E2E completo aprovado na mesma árvore. 388 unitários, quatro técnicos, 17 scripts de navegador e sintaxe de 538 ficheiros backend aprovados.
- Confirmada no commit `d9cad93f2564c6b85da494774fdf1abeffbff12a`, árvore `6870ceadd405a3ecdf6922c05c699e6299482d9e`, CI `35201773521`: 121/121 grupos, 388 unitários/quatro técnicos, 17 scripts de navegador, 20 migrações aditivas, sintaxe de 538 ficheiros e restauro em PostgreSQL 16 de 110 tabelas/32 ficheiros com linhas e hashes iguais. Backup local `backup/task218-local-20260917`.

## Limites e continuidade

O teste de entrada não demonstra todas as operações administrativas ou financeiras do perfil. As regras do servidor não foram ampliadas. A cache offline não permite descobrir revogações enquanto o dispositivo está sem rede; uma recusa recebida impede o seu uso como ronda ativa. Páginas antigas conservam os seus contratos de escrita próprios.

O corte da lista diária e as páginas explícitas foram tratados em seguida na TASK219, com relatório próprio. Prosseguir o inventário das restantes filas/documentos e páginas. Não há deploy, alteração em main ou conclusão global do sistema neste lote.
