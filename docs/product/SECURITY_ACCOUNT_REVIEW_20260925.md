# TASK359 — redefinição de palavra-passe com identidade confirmada

## Problemas confirmados

A página `/admin-security` vinha preenchida com o utilizador 1, não mostrava a identidade desse destinatário e ignorava a opção visível de redefinição forçada. O controlador alterava a palavra-passe e depois tentava criar a auditoria, ignorando a falha desta última. A resposta incluía outros campos da conta, para além do necessário. Os contadores antigos podiam converter erros em zero e o resumo tratava a lista de utilizadores como um valor escalar.

## Alteração

- Página reconstruída com lista de contas paginada (25 por página), totais confirmados num snapshot RepeatableRead e os **20 registos de auditoria mais recentes**, expressamente identificados como tal. Projeções mínimas: a lista não inclui palavras-passe, PINs, IPs, agentes do navegador ou metadados de auditoria. Nomes e valores originais são texto, incluindo caracteres de HTML.
- Nenhuma conta pré-selecionada. O administrador escolhe uma conta ou introduz um ID canónico e consulta nome, email, perfil, estado e indicadores registados antes de confirmar. A revisão dura cinco minutos e está assinada para o administrador, conta e versão exatas. Uma mudança entretanto, uma prova forjada, outra conta/administrador ou uma revisão expirada impede a gravação.
- `GET /api/security/console`, `GET /api/security/users/:id/password-review` e `GET /api/security/users/:id/password-result/:requestId`, com autenticação ADMIN e respostas privadas desde antes do controlo de acesso. Os dois POST antigos de palavra-passe passam a exigir a revisão; o pedido antigo sem prova recebe 409 sem efeitos. O controlador antigo permissivo foi removido. As APIs antigas de estado/auditoria/identidade permanecem para os consumidores existentes.
- Confirmação explícita da identidade e repetição da palavra-passe no navegador. Mínimo de 12 caracteres Unicode, máximo de 72 bytes UTF-8, sem NUL ou substitutos Unicode inválidos; não se cortam espaços nem se permite truncagem silenciosa do bcrypt. Apenas a palavra-passe e a sua data são alteradas; estado ativo/inativo, PIN, bloqueio, tentativas falhadas e obrigação de mudança são conservados.
- Palavra-passe bcrypt e evento `PASSWORD_RESET_REVIEWED` gravados na mesma transação. Uma falha de auditoria reverte a alteração. Atualização condicional pela versão/hash anterior impede sobrescritas concorrentes. O evento regista o administrador autenticado, a conta e a referência do pedido; o comprovativo devolve apenas a referência, data e autor.
- Repetir a mesma prova/conteúdo devolve o comprovativo original sem nova alteração. Conteúdo diferente com a mesma prova é recusado. O identificador do pedido e um resumo HMAC permitem verificar a correspondência; não se guardam palavras-passe em claro nem a prova assinada na auditoria. Os campos de palavra-passe, repetição e prova são retirados do registo de pedidos HTTP.
- Uma resposta perdida fica **por confirmar**. O botão consulta o comprovativo por GET, sem reenviar a palavra-passe. A ausência de comprovativo continua por confirmar, porque o pedido pode estar a ser processado. Os campos são limpos ao enviar, mudar de conta/sessão, suspender ou recarregar; não há rascunhos em armazenamento local. Respostas antigas e contratos/cabeçalhos de outra sessão são recusados.
- Conteúdo próprio em PT/EN/FR/ES/DE, idioma conservado no endereço. Paginação da lista conserva-se na recarga; a seleção e palavras-passe nunca são recuperadas automaticamente. Estados offline/erro/timeout retiram dados não confirmados. A própria conta tem instrução de voltar a entrar depois da alteração.

## Validação

**690 testes unitários/96 ficheiros, quatro técnicos, sintaxe 640 backend/247 frontend/48 inline**. Três grupos API/Chromium aprovados: `test-field-security-review.js`, `test-field-account-access.js` e `test-field-legacy-admin-access.js`.

O grupo novo cria 27 contas isoladas e verifica paginação/totais, identidades desconhecidas/inativas, projeções mínimas, IDs e parâmetros inválidos, autenticação direta e global, invariância das recusas, expiração/alteração da revisão, falha parcial dos contadores, falha de auditoria com rollback real, concorrência da mesma prova, repetição idempotente, conteúdo divergente e consulta de comprovativos ligada ao autor. A conta de teste conserva PIN, atividade, bloqueio e obrigação de mudança.

O navegador verifica ausência de seleção/escritas automáticas, escolha por lista/ID, identidade e confirmação, limites UTF-8, palavras-passe diferentes, envio único, gravação real, resposta perdida depois do commit, ausência de comprovativo sem inferir falha, alteração do ID, resposta antiga, pacotes falsos, offline, timeout, suspensão, mudança de conta e expiração. Três tentativas POST no navegador: duas gravações efetivas e uma interrupção antes de chegar à API; a recuperação não fez novo POST. Outras contas e contagens de notificações, mensagens e emails mantêm-se iguais. Não houve contactos reais.

Trinta capturas em `reports/field-visual/security-review/`, página e revisão em 320/390/1440 para cinco idiomas; PT390, PT1440 e DE320 revistos. O texto cabe nas larguras verificadas. A navegação comum mantém o âmbito anterior de tradução; os dois recursos binários ausentes apenas da cópia local conservam a ressalva do inventário. As capturas longas de elemento incluem a barra fixa da navegação comum na posição do viewport.

PGlite isolado e 40 migrações existentes, Chromium com múltiplos processos e segurança web ativa. Sem novas dependências, tabelas ou migrações. Cache v170 e runner com 256 grupos. Inventário: 115 HTML, 95 páginas com referência literal em 277 scripts ativos, 20 na fila de pesquisa. Referência literal é uma pista de cobertura, não um certificado de conclusão.

## CI, publicação e limites

TASK357 confirmada em [254/254 grupos e restauro nativo](evidence/20260925_task357_ci.json): 17 etapas aprovadas, 665 unitários, quatro técnicos e 127 tabelas/47 ficheiros com linhas e hashes iguais. Duração 37m46s. TASK358 (`36132083159`, job `108061430098`) continua em execução no último controlo.

Este fluxo trata contas `User` da base de dados, não credenciais próprias de clientes ou PINs de técnicos. Não transforma os indicadores registados em prova de aplicação de todos os controlos de segurança. A política global de emissão/revogação de sessões, o login antigo, a edição de identidade e as APIs antigas de panorama/auditoria não foram redesenhados. O acesso de emergência `ENV_ADMIN` não é admitido neste novo fluxo. A revisão/comprovativo fica em memória na página; depois de sair, a auditoria recente permite consultar os eventos. O volume de produção, a conciliação histórica, o VPS e o piloto físico continuam por validar.

Publicada em `01df73fd483ddbf588e6e966639d9da627bf5a54`, árvore `92ac20917eefe71ce6724017107a03e470b9252f`, idêntica à preparada e validada localmente. [CI 36134907116](https://github.com/ts7520305-svg/cristalwater/actions/runs/36134907116), job `108070540081`, em execução; os 256 grupos e o restauro PostgreSQL nativo deste lote continuam por confirmar. Sem merge ou deploy de produção. Aplicação não declarada completa.
