# TASK357 — configuração real dos lembretes e opções antigas

## Problema confirmado

O formulário `/admin-payment-settings` apresentava quatro opções globais guardadas em `SystemSetting`, mas nenhum percurso atual de lembretes lia essas chaves. Além disso, `PUT /payment-policy` era capturado por `PUT /:id` antes de chegar ao controlador pretendido. O controlador inacessível gravava quatro linhas separadamente, convertia valores com `Boolean()` e não garantia uma configuração coerente. Assim, mostrar uma política antiga como «Desativado» não significava que os avisos estivessem desativados.

O controlo efetivo dos avisos automáticos no portal é `PAYMENT_REMINDERS_ENABLED`, já editável na central de configurações. A rotina atual regista avisos a partir de sete dias de atraso, repete semanalmente e conserva os seus critérios de cliente/documento elegível. Os lembretes manuais revistos têm regras e canais próprios. Não se inventou um novo interruptor que controlasse todos estes percursos.

## Alteração

- A página passa a consulta administrativa do estado real e dos quatro valores antigos. Liga à opção existente nas configurações operacionais, com âncora própria, e à revisão de documentos para lembretes manuais.
- Nova leitura `GET /api/notification-rules/payment-policy/review`: uma consulta limitada a cinco chaves numa transação RepeatableRead. Projeta valor original, origem e data; não inclui notas nem outras configurações. Reutiliza a função de interpretação booleana do serviço operacional, sem alterar a sua semântica.
- Ausência é explícita: avisos do portal desativados por defeito e valores antigos sem registo, sem criar linhas ou presumir opções antigas ativadas. Valores não reconhecidos conservam o texto exato. O ecrã distingue o valor inválido da interpretação feita pela rotina, sem o apresentar como confirmação válida.
- As quatro opções antigas são identificadas como não aplicadas aos lembretes atuais. Edição antiga retirada; `GET`, `HEAD` e `PUT /payment-policy` respondem 409 com `PAYMENT_POLICY_REVIEW_REQUIRED` e `applied:false`. Esta é uma mudança intencional do contrato antigo. Os dados existentes são conservados; chamadas antigas não recebem sucesso fictício nem modificam outra regra.
- Rotas específicas antes do identificador dinâmico; atualização administrativa de regras numéricas conservada. Autenticação ADMIN também no router isolado, respostas privadas/no-store antes dos dois níveis de autorização, cabeçalho de identidade e versão. Falhas de origem devolvem 503 sem detalhes internos.
- Conteúdo próprio em PT/EN/FR/ES/DE, valores originais em nós de texto, ligações ao percurso correto, proteção contra respostas incompletas, antigas ou de outra sessão. Erro, timeout, offline, suspensão ou expiração retiram os valores apresentados. O idioma fica no endereço e conserva-se na recarga. Nenhuma gravação ou contacto parte desta página.

## Validação

665 testes unitários em 94 ficheiros, quatro técnicos e sintaxe de 637 ficheiros backend, 243 frontend e 49 scripts inline. Quatro grupos distintos de integração aprovados:

- Novo grupo de configuração: API real e Chromium, valores ausentes/guardados/inválidos, portal ativado em simultâneo com política antiga DISABLED, rota numérica, recusas antigas inertes, autorização direta e global, falha sanitizada e notas excluídas.
- Acesso administrativo antigo, incluindo recusas sem efeitos.
- Automatismo mensal/avisos no portal, incluindo desativação, início aos sete dias, concorrência, repetição semanal, pausa e pagamento.
- Lembrete manual por documento, preferências registadas, recuperação do mesmo pedido e resultados por canal com fornecedor simulado.

O grupo novo foi repetido após a revisão visual e a melhoria do ensaio de resposta atrasada: uma resposta antiga «desativado» não substitui a consulta mais recente «ativado». Navegador também testa corpo/cabeçalhos, offline, 503, timeout, suspensão/retoma, mudança de administrador, expiração e conservação do armazenamento alheio. Configurações originais iguais antes/depois; nenhuma escrita de API pelo navegador, nem alteração das contagens de mensagens, notificações, emails, comunicações ou lembretes pela consulta/recusa.

Trinta e uma capturas regeneráveis em `reports/field-visual/payment-policy/`: página e cartão nas três larguras 320/390/1440 e cinco idiomas, mais cartão inválido PT390. PT390/PT1440, DE320 e cartões PT revistos visualmente; título alemão ajustado para evitar quebra de palavra e capturas de cartões centradas fora da navegação fixa. Navegação comum mantém o âmbito anterior de tradução; dois recursos binários não materializados nesta cópia não são ausência confirmada na aplicação.

PGlite isolado com 40 migrações existentes, Chromium com múltiplos processos e segurança web ativa. Sem nova migração ou dependência. Cache v168; runner com 254 grupos. Inventário: 115 HTML, 93 páginas com referência literal em 275 scripts ativos e 22 na fila de pesquisa. Referência literal não certifica conclusão de uma página.

## Limites e publicação

Esta página consulta configuração; não confirma que a rotina foi executada nem que um destinatário recebeu um aviso. Não altera os critérios, os canais ou os envios dos automatismos existentes, nem transforma as opções antigas num controlo global. A edição na central operacional mantém o seu percurso anterior e não é uma nova edição versionada neste lote. Não se apagaram nem migraram preferências antigas. A API antiga passa a exigir o percurso revisto.

TASK355 confirmada em [252/252 grupos e restauro nativo](evidence/20260925_task355_ci.json), 17 etapas e 127 tabelas/47 ficheiros com linhas e hashes iguais. TASK356 continua em execução no último controlo. Publicada em `d49bcd81eee9cd7c7d63af4c6b5716a4202a1de4`, árvore `8d2542ddbc9ba9f5f24af31630a744fd3b8d7da7`, idêntica à preparada e validada localmente. [CI 36129627534](https://github.com/ts7520305-svg/cristalwater/actions/runs/36129627534), job `108053651745`, em execução; os 254 grupos e o restauro PostgreSQL nativo deste lote continuam por confirmar. Sem merge, deploy de produção ou contactos reais. Aplicação não declarada completa.
