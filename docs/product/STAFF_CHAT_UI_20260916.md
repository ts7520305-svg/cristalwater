# TASK178 — conversa da equipa no ecrã existente

## Resultado

O ecrã `technician-chat` reúne a conversa da equipa e as notificações existentes. TECHNICIAN, TEAM_LEADER e ADMIN usam o mesmo canal; CLIENT não entra. A navegação mantém separadas as conversas privadas dos clientes. Notificações de rotina ficam recolhidas; um novo alerta crítico abre a secção. O técnico pode regressar à operação sem atravessar um painel administrativo.

O formulário conserva o rascunho por conta/janela e guarda um pedido imutável por conta antes do envio, com UUID e texto. O pedido só é removido depois de uma resposta 200/201 com identidade, UUID, texto e registo correspondentes. Resposta perdida, 202 de fila offline, resposta trocada, reload e mudança de sessão não produzem uma falsa confirmação. O reenvio é explícito, conserva o pedido original e usa o contrato transacional da TASK177. Web Locks coordenam janelas; a proteção no servidor continua necessária.

A mudança de conta esconde a conversa e interrompe pedidos pendentes, conservando o registo da conta original para a sua recuperação. Leituras antigas não substituem uma consulta mais recente. Falhas conservam a última lista. O seletor existente fica no fluxo da página, com PT/EN/FR/ES/DE; nomes e mensagens são texto literal. Os nomes dos autores autenticados vêm da conta atual, separados por User/Technician. Um nome atual não é um retrato histórico; mensagens importadas continuam identificadas como autoria não confirmada.

## Evidência

Novo grupo `scripts/test-field-internal-chat-ui.js`, integrado no runner:

- API e Chromium reais em QA; ADMIN, técnico e chefe admitidos, CLIENT recusado.
- Dois cliques/janelas, falha depois do commit, reenvio após reload e um único registo.
- Resposta trocada, resposta 202, quota indisponível, pedido corrompido, offline, rascunho conservado e troca de conta durante resposta pendente.
- Leitura antiga, cinco idiomas sem atraso entre escolhas e conteúdo HTML apresentado literalmente.
- Larguras 1440, 390 e 320 px; seletor sem sobreposição; modo escuro e contraste mínimo de 4,5:1 no botão Atualizar. Imagens revistas em `reports/field-visual/internal-chat/`.

Execução final `field-qa-runtime/run-1789536438369`: este grupo e cinco regressões aprovados. O ensaio usa PGlite através de TCP; o CI final publicado deve confirmar PostgreSQL 16, a bateria completa de 83 grupos e restauro. 323 testes unitários, quatro de técnicos e sintaxe backend aprovados antes da publicação.

## Limites e continuação

Não há envio automático ao recuperar a rede, medição de capacidade de produção, ensaio prolongado em telefone real ou nova entrega push. A lista completa da conversa não é um teste de volume. A persistência do navegador depende de armazenamento disponível; sem confirmação de escrita local, o formulário não envia. Não houve migração neste lote. A confirmação recuperável das conversas CLIENT/ADMIN constitui a próxima revisão própria.
