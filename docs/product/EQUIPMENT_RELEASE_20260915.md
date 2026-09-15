# TASK110 — Integração da manutenção preventiva

O calendário por componente liga a central administrativa à visita do técnico, sem criar um portal independente. Configuração e conclusão têm permissões próprias. A atribuição da visita controla o acesso do técnico; histórico e auditoria permanecem na base de dados.

A integração monta /api/equipment-maintenance e inclui a nona migração aditiva na verificação cumulativa. A suite passa a 29 grupos: inclui testes de API do calendário e um percurso em navegador sem mocks, desde a configuração administrativa até à execução pelo técnico. Testes de browser isolados verificam resposta incerta, reenvio, sessão, visita errada e desenho móvel.

Validação unitária: 198 testes, incluindo três novos de calendário, mais quatro testes específicos de técnicos. Datas de agenda são civis de Lisboa, com armazenamento sem ambiguidades de hora. Intervalos mensais respeitam o último dia dos meses curtos. A execução calcula o próximo prazo a partir do dia em que foi confirmada.

A migração acrescenta duas tabelas; a validação de restauro deve compará-las juntamente com todas as anteriores. O workflow conserva imagens reais de QA em reports/equipment-flow junto da restante evidência.

Limites: este calendário não envia push de vencimentos nem cria visitas automaticamente. Os prazos aparecem na visita atribuída e na configuração administrativa. O técnico continua responsável por confirmar o trabalho real. O plano identifica o componente por tipo/título, sem sincronização automática do número de série. O rascunho de observações é conservado em memória durante a sessão, não é uma nova fila persistente para encerrar a aplicação offline.
