# Validação operacional — 14 setembro 2026

Estado: EM EXECUÇÃO. Não certificado para produção ou campo.

Pedido atual: concluir e testar os fluxos do técnico em campo, gestor, cliente e administrador; continuar as correções sem aprovações intermédias. Não implica envio de mensagens a clientes nem alterações destrutivas na base produtiva.

## Base verificada

- Branch principal: `feature/technicians-v25`, commit `6f27081e1d183ff584a62255b016b373836734db` (28 julho).
- Trabalho de campo de hoje preservado: `work/field-validation-ux-20260914`, commit `a584369b7372a71c1aaa280078e5aeca00f8f1d1`.
- Continuação: `work/field-readiness-20260914`.
- Relatórios antigos e testes de presença de texto não demonstram prontidão funcional atual.

## TASK 1 — permissões e documentos autenticados

- Propostas técnicas exigem perfil operacional, com herança de administrador/chefe de equipa existente.
- PDFs das guias: requisição autenticada; apresentação por Blob; tratamento de sessão expirada, falha HTTP e popup bloqueado; rejeição de destinos externos.
- Importação `bcryptjs` no teste mensal restaurada.
- Testes comportamentais verificam autenticação, falhas HTTP e proteção do token.
- Nenhuma alteração de schema.

## Validação pendente

- Base isolada, arranque, dados de ensaio e testes de API.
- Jornada completa e reabertura offline em dispositivo móvel.
- Alertas de água aberta/bomba manual com aplicação fechada, repetição e confirmação.
- Permissões e privacidade entre clientes e técnicos, incluindo notificações e sockets.
- Gestão: rotas, equipamentos, consumos, guias, cobranças, reparações e histórico.
- Validação de produção: configuração, notificações reais no telemóvel, backup/restore e campo físico.

Limite: não há nesta sessão ligação comprovada ao VPS nem um telemóvel inscrito para testar notificações. Estes critérios não podem ser marcados PASS com base em testes locais.
