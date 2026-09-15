# TASK133 — Visibilidade completa dos alertas administrativos

## Problemas reproduzidos

O endpoint `/api/alerts` devolvia apenas 150 notificações, 150 alertas técnicos, 150 visitas e 100 alertas gerais. Com 506 registos abertos por origem, os quatro alertas antigos desapareceram da resposta, incluindo água aberta e bomba em manual. Evidência inicial: `field-qa-runtime/run-1789477295325/test-field-alert-visibility.log`.

Uma consulta sem token também devolveu HTTP 200 durante o ensaio seguinte. O router não tinha autenticação. Os dois consumidores encontrados no frontend são administrativos e já enviam Authorization: `admin-alerts.js` e `admin-live-map.js`.

O ecrã substituía a última lista por uma lista vazia após erro de rede e mostrava «Sem alertas abertos». Uma resposta atrasada podia ainda substituir uma consulta mais recente.

## Alterações

- A consulta delega em `AlertListBusiness`, com uma transação RepeatableRead e leitura por ID em lotes de 500. Notas e reparações associadas usam o mesmo snapshot; os IDs das consultas associadas também são divididos em lotes. Nenhuma origem ou consulta associada falhada é convertida numa lista vazia.
- A resposta conserva os campos existentes, os critérios de seleção e os contextos de visitas/reparações. Todos os resultados selecionados são devolvidos, com críticos antes dos avisos e restantes prioridades; dentro de cada prioridade, os mais recentes primeiro e desempate estável por referência. A consulta não altera leitura, resolução ou entrega dos avisos.
- Os formatadores existentes passam para um serviço comum, reutilizado pelas ações atuais. A rota exige o middleware ADMIN existente para consulta, criação, resolução e conversão; as recusas seguem os códigos 401/403 existentes.
- O ecrã valida a coleção, quantidade, referências e prioridades antes de a aceitar; conserva a última consulta após falha com aviso explícito. Antes da primeira resposta válida mostra estado por confirmar; apenas uma resposta vazia válida mostra zero. Ignora consultas ultrapassadas e limpa a lista quando a sessão muda. Contextos de visita já recebidos não voltam a ser pedidos individualmente.
- Resolver um alerta ou criar uma reparação deixa de anunciar que a lista foi atualizada quando o refrescamento falhou.

## Validação

Ensaio dirigido aprovado em `field-qa-runtime/run-1789477690689`: visibilidade dos alertas, percursos de água/regresso e controlo de acesso. Cobertura nova: 506 registos por origem, contagens sem duplicados, prioridade dos críticos antigos, contexto completo, exclusão dos estados fechados/inativos, histórico conservado, recusas de leitura/escrita sem sessão e nos perfis técnico/cliente, HTTP 503, respostas malformadas/duplicadas, consulta atrasada, mudança de sessão, recuperação da primeira consulta e ecrãs 320/390/1280 px.

278 testes unitários em 55 ficheiros, incluindo seis falhas de consulta que têm de propagar o erro; 4 testes de técnicos; 17 scripts de navegador. Sintaxe verificada nos 493 ficheiros backend e nos scripts alterados. O novo grupo integra a bateria de 39 grupos. A confirmação final de PostgreSQL 16, atualização aditiva e restauro pertence ao workflow do commit publicado, não ao ensaio PGlite local.

## Ficheiros

| Ficheiro | Alteração |
| --- | --- |
| `src/routes/alertRoutes.js` | Autenticação administrativa e delegação da consulta |
| `src/business/admin/AlertListBusiness.js` | Snapshot completo e ordenação |
| `src/services/alertPresentationService.js` | Formatadores comuns existentes |
| `frontend/admin-alerts.js` | Estado de consulta, validação e recuperação |
| `frontend/admin-alerts.html` | Estado inicial e versão do script |
| `tests/alert-list.test.js` | Propagação de falhas de todas as consultas |
| `scripts/test-field-alert-visibility.js` | Ensaio API/base/Chromium |
| `scripts/test-field-suite.js` | Inclusão do novo grupo |
| `docs/product/ALERT_VISIBILITY_20260915.md` | Este relatório |
| `docs/product/CURRENT_WORK_CHECKPOINT.md` | Ponto de retoma |

## Limites e riscos

A lista completa aumenta a resposta e o custo de apresentação quando existe muito histórico ainda selecionado pelos critérios atuais; os lotes limitam cada consulta, não a memória total nem o número de cartões. O ensaio com 2.024 alertas não certifica desempenho do VPS. O serviço mantém os critérios existentes para visitas e notificações; não redefine quando cada origem deve ser considerada resolvida. Não altera a entrega em segundo plano, o fecho físico da água/bomba, o esquema, a emissão fiscal ou o ambiente de produção. Integrações não identificadas que chamassem esta rota sem credenciais administrativas passam a ser recusadas.
