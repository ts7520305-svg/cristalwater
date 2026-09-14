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

## TASK 2 — arranque a partir de clone limpo

- A primeira execução real falhou antes de abrir a API: `CrystalBrain` importava `../logs/BrainLogger`, ausente no repositório.
- Corrigido para reutilizar `services/loggerService`, já existente.
- `check:syntax` passa também a resolver os imports locais, pois `node --check` não deteta esta falha.
- TASK 1: 25 ficheiros / 63 testes passaram; testes específicos do técnico 4/4; sintaxe e resolução a revalidar após esta correção.

## TASK 3 — interface móvel e sincronização de água

- Chromium real reproduziu bloqueio da interface: o observador DOM reagia às suas próprias alterações sem parar. Observação suspensa durante a decoração.
- Respostas offline HTTP 202 mantêm o lembrete pendente. Só uma confirmação com ID do servidor confirma sincronização.
- Fecho antes da primeira sincronização reproduz criação seguida de fecho; exclusão de tentativas concorrentes no mesmo ecrã.
- Teste comportamental `npm run test:field-browser`: interface responsiva, check-in explícito, resposta offline e criação/fecho após reconexão passaram. Usa API controlada; não substitui ensaio integral nem telemóvel físico.
- API real: ensaio operacional do técnico e simulação mensal passaram numa base isolada PGlite/TCP, incluindo concorrência no fecho da visita. Não equivale a validar desempenho PostgreSQL de produção.

## Ensaios por concluir

- Base isolada, arranque, dados de ensaio e testes de API.
- Jornada completa e reabertura offline em dispositivo móvel.
- Alertas de água aberta/bomba manual com aplicação fechada, repetição e confirmação.
- Permissões e privacidade entre clientes e técnicos, incluindo notificações e sockets.
- Gestão: rotas, equipamentos, consumos, guias, cobranças, reparações e histórico.
- Validação de produção: configuração, notificações reais no telemóvel, backup/restore e campo físico.

Limite: não há nesta sessão ligação comprovada ao VPS nem um telemóvel inscrito para testar notificações. Estes critérios não podem ser marcados PASS com base em testes locais.
