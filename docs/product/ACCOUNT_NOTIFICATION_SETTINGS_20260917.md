# TASK225 — Preferências de conta com confirmação e estados de acesso

## Falha reproduzida

A revisão real TASK224 abriu `/settings` como CLIENT: a API respondeu 403, porque a tabela de preferências pertence a `User`, e a interface lançou `Cannot read properties of undefined (reading 'find')`. A página não tratava a resposta recusada. A gravação antiga também apresentava sucesso na consola sem verificar a resposta. Quando faltava uma preferência, o ecrã assumia som ativado sem haver um registo confirmado.

## Comportamento implementado

- A página de preferências pode ser aberta pelos quatro perfis autenticados. A exceção é restrita a `/settings` e mantém validação de token/expiração/papel na entrada. A API conserva integralmente as permissões existentes: ADMIN e uma identidade User autorizada podem gerir as preferências permitidas; CLIENT e PIN não obtêm acesso à tabela User pela coincidência do ID numérico.
- O menu apresenta Preferências de som para ADMIN e sessões User. O menu PIN não anuncia a função indisponível; a entrada direta continua a ter uma mensagem e ligação de saída úteis.
- A identidade de consulta/gravação vem do payload da credencial e tem de concordar com os dados locais. O ID User explícito tem prioridade sobre o ID técnico. A validação local não verifica assinatura nem substitui a autenticação da API.
- Carregamento, indisponibilidade por acesso, erro e repetição têm mensagem visível. As respostas recusadas, inclusive não JSON, não são interpretadas como listas vazias válidas. Existe uma ligação para as notificações do perfil.
- Preferências ausentes surgem como «Não definida». Um seletor permite escolher ativado/desativado sem presumir valores guardados. As linhas recebidas têm de corresponder à conta, tipo conhecido e valor booleano; respostas contraditórias não são apresentadas.
- A gravação desativa os controlos e mantém o último valor confirmado. Só apresenta confirmação com HTTP 200, `ok: true` e um registo da conta/tipo/valor pedidos. HTTP 202, resposta vazia, valor/conta discordantes ou perda de resposta não produzem sucesso.
- Após uma gravação sem confirmação, atualizar consulta o estado real antes de permitir nova alteração. Uma resposta perdida depois de gravação no servidor pode assim ser recuperada sem assumir falha ou reenviar automaticamente. Não existe fila offline nova para estas preferências.
- Mudança de conta invalida a interface e respostas atrasadas. Os pedidos têm limite de espera de 15 segundos; um timeout de gravação continua a ser resultado não confirmado. Filas, rascunhos e documentos locais ficam conservados.
- O painel tem textos próprios em PT/EN/ES/FR/DE e mantém o estado ao mudar idioma. Os controlos foram verificados em 320/390/1440 px. Service worker v54; nenhum endpoint ou migração nova.

## Evidência

| Ensaio | Resultado e limite |
|---|---|
| `run-1789645818383` | TEAM_LEADER ampliado, controlo de acesso API e revisão de doze combinações aprovados. ADMIN abre `/settings`; CLIENT mantém 403, agora sem erro JavaScript |
| `run-1789645984153` | PIN vê indisponibilidade sem perder sessão/rascunho; login email User guarda a preferência no seu ID User, recarrega o valor e regressa ao rascunho. Repetido após vincular a identidade diretamente ao payload; a seleção pelo menu foi acrescentada na validação final |
| `run-1789646198971` | Grupo TEAM_LEADER final aprovado: menu PIN não anuncia preferências User; o menu da sessão email abre a página e a gravação/recarga/regresso ao rascunho continuam a passar |
| Novo grupo de navegador | Recusa não JSON, falha de rede, leitura inválida/conta alheia, respostas de gravação incompletas/discordantes/202, gravação com resposta perdida, ação repetida, atualização confirmada e resposta atrasada após troca de conta aprovadas. Cinco idiomas/três larguras aprovados |
| Regressão local | 388 unitários, quatro técnicos, os 18 scripts de navegador e sintaxe de 539 ficheiros aprovados |
| CI nativo | Publicar e confirmar a árvore final com 124 grupos de integração existentes, 18 scripts de navegador, 20 migrações e restauro |

O teste de navegador usa respostas controladas para exercitar falhas e confirmações contraditórias. O ensaio User/PIN usa APIs e base reais; não foi alargada a API para fazer o formulário passar. A guarda técnica continua a recusar perfis externos nos restantes percursos.

## Limites

O estado indisponível de CLIENT/PIN é intencional: estas identidades não são User. Este lote não cria preferências de som persistentes próprias para esses perfis nem comprova reprodução de som/push nos seus dispositivos. Guardar uma preferência User não prova emissão de uma notificação ou som.

O inventário mantém 101 HTML, zero recursos locais em falta, 43 páginas com referências literais em 142 scripts e duas divergências por rever: ajuda e configuração local antiga de notificações. A ajuda ainda tem conteúdo/atalhos administrativos com guarda CLIENT; a configuração local antiga ainda usa chaves globais `sound_*`. Não confundir estas pendências com a página User agora corrigida.

Sem alterações ao schema, main, deploy ou fornecedores externos. Os bytes já apagados pelos percursos antigos não são recuperados por este lote.
