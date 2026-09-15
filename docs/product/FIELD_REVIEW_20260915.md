# TASK103 — Revisão comparativa e validação integrada

## Referências consultadas em 15/09/2026

Comparação funcional, sem reproduzir design, código ou alegações comerciais de desempenho:

| Referência oficial | Funcionalidade relevante | Aplicação à Cristal Water |
| --- | --- | --- |
| [Skimmer](https://www.getskimmer.com/) | Rotas, trabalho offline, relatórios de serviço, orçamentos e portal | Rondas, GPS e filas locais já existem. Reforçadas sessões e simulações de falha de transporte. |
| [Pool Brain](https://www.poolbrain.com/) | Orçamentos ligados a trabalhos, alertas, passos orientados e limpeza recorrente de filtros/células | Ligação da decisão do cliente ao fluxo de reparação concluída neste lote; checklists operacionais já existentes. Recorrência preventiva por equipamento continua candidata a especificação. |
| [Jobber Help](https://help.getjobber.com/) | Portal com aprovação de orçamentos, agendas e comunicação | Publicação explícita, versão, preço/IVA, decisão autenticada e notificação persistente no portal. |

Não se afirma equivalência total a estes produtos. O roteiro de equipamentos não foi concluído nesta ronda: calendário por componente, último serviço e reagendamento automático de limpeza de filtro/célula exigem integração com visitas e histórico. Não se automatizam dosagens ou recomendações químicas a partir de alegações promocionais.

## Revisões independentes

Agentes de IA distintos reveram sessões/notificações, concorrência/resiliência e interfaces/fluxos visuais. Cada recomendação foi verificada no código. Identificaram: sockets não encerrados no logout, login repetido, palavras-passe alteradas por trim, risco de transferência de proprietário durante decisão e evento de aprovação emitido antes do commit. Correções têm testes específicos. Isto não é certificação externa ou auditoria humana independente.

## Validação executável

- `npm test`: 195 testes unitários; `npm run test:technician`: 4 testes.
- `npm run test:field-browser`: testes de campo, sessões, push, mapas, notificações cliente, preços, idiomas, proteção de dados, login e orçamentos.
- `scripts/test-field-suite.js`: 27 grupos, incluindo visual real, novo portal e resiliência; falhas devolvem estado não zero e logs.
- `scripts/test-field-resilience.js`: 12 técnicos, 48 submissões GPS, 216 leituras concorrentes, recusa de acesso cruzado, falha 503 antes da gravação e resposta perdida depois de gravar; oito reenvios da conclusão verificam consumo único. Regista latência p50/p95 por endpoint.
- `scripts/test-field-visual-flow.js`: formulários reais, backend real de QA, dados fictícios, três perfis, logout, retorno protegido, preservação de fila local e decisão de orçamento pela interface. Sem mocks de APIs/scripts. Executado primeiro na base isolada para evitar efeitos de paginação no painel de demonstração.
- Teste SQL de falha induzida: rollback após escrita de aprovação não emite aprovação falsa; repetição após recuperação emite uma vez.
- CI aplica oito migrações aditivas e executa restauro com comparação de tabelas e hashes dos ficheiros enviados.

## Limites materiais

Carga limitada e acelerada em QA, não dimensionamento do VPS. PGlite local não representa desempenho de PostgreSQL de produção; CI valida também PostgreSQL 16. Nenhum teste comprova redundância física, failover entre servidores, autonomia de bateria ou entrega de push em iPhone/Android com aplicação fechada. Os canais externos estão desativados nos testes. A aprovação pelo portal deixa a reparação pronta para agendamento; não agenda técnicos, cobra ou emite documento fiscal automaticamente. Novos textos do portal estão em português; revisão linguística integral pendente.
