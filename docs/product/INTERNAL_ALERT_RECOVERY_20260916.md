# TASK203 — Alerta recuperável para a administração

## Problema e resultado

O botão “Enviar Alerta Admin” da página técnica antiga apagava o texto e anunciava sucesso sem fazer um pedido. Reprodução anterior à alteração: zero pedidos de rede, texto vazio e mensagem “Alerta enviado ao administrador”. O botão passa a usar `POST /api/visits/internal-alert` e só limpa o formulário depois de guardar a confirmação exata no dispositivo.

O técnico escolhe mensagem, prioridade e, opcionalmente, uma visita que lhe está atribuída. A autoria vem da sessão. O servidor regista uma notificação destinada exclusivamente a ADMIN, auditoria e comprovativo `FieldWriteRequest` na mesma transação. Não atribui os campos de destinatário CLIENT/User ao autor nem publica a mensagem no chat geral da equipa. A página real de alertas ADMIN apresenta o texto literal e o nome do técnico.

## Recuperação

- UUID, identidade tipada, mensagem, prioridade e visita vinculados por hash. Repetição exata devolve a confirmação original; reutilização com outros dados é recusada. A confirmação original continua recuperável após reatribuição da visita.
- Pedido guardado em IndexedDB antes da rede. Rascunho separado por conta, sem credenciais. Campos do pedido pendente ficam protegidos; recuperação explícita conserva o conteúdo original.
- Quota antes do envio impede o transporte. Quota ao guardar o comprovativo mantém o pedido. Se só a limpeza do rascunho falhar, o botão limpa localmente depois de reparar o armazenamento, sem criar outro alerta.
- Respostas com destinatário/campos errados, troca de conta e dados locais corrompidos não autorizam apagar ou substituir o texto. Conflito de rascunho entre janelas exige rever o texto guardado.
- A barra antiga inclui os alertas por confirmar. O service worker conserva os recursos públicos necessários à recarga offline real da página, incluindo estilos, biblioteca Socket.IO e ícones.

## Evidência

`scripts/test-field-internal-alert.js`: resposta perdida após commit, reinício, seis pedidos em dois processos, um alerta/uma auditoria, reversão transacional forçada, validação de campos, reatribuição de visita e isolamento ADMIN/TECH/CLIENT. O endpoint geral de notificações e o de alertas foram exercidos.

`scripts/test-field-internal-alert-ui.js`: formulário real em Chromium, recarga totalmente offline, larguras 320/390/1440, três fronteiras de quota, confirmação trocada, resposta tardia após mudança de sessão, duas janelas, corrupção e apresentação literal na página ADMIN. `tests/field-write-contract.test.js` acrescenta seis recusas de confirmações com campos divergentes.

Quatro grupos dirigidos aprovados em `run-1789583409083`; regressão do armazenamento de fotografias/conclusões em `run-1789583346914`. 361 testes unitários, quatro de técnicos, 17 scripts de navegador e sintaxe de 533 ficheiros aprovados. Recarga offline com os ícones finais aprovada em `run-1789583704186`. O runner passa a 106 grupos, sem migração nova; confirmar o CI nativo e o restauro da árvore publicada.

## Limites

Registar para ADMIN não demonstra que alguém leu, recebeu push ou email. Não há envio para fornecedor externo, abertura automática de reparação, alteração de stock ou efeito financeiro. O texto historicamente apagado pelo botão antigo não pode ser reconstruído. Esta tarefa não implementa rascunhos persistentes dos restantes campos de visita nem traduz integralmente a página antiga. Janelas antigas já abertas precisam de recarregar para reconhecer o novo tipo de pedido; não devem eliminar dados desconhecidos. Sem ensaio físico iOS/Android, deploy ou declaração de conclusão global.
