# TASK333 — Preparação temporal dos ensaios e fecho nativo das devoluções

O CI da TASK327 executou os 229 grupos e falhou apenas em `test-field-equipment-history-time.js`, ao associar um lembrete a uma visita cuja hora de conclusão, arredondada para o segundo seguinte no ensaio, ainda estava no futuro. O restauro foi omitido. [Evidência inicial](evidence/20260924_task327_initial_failure.json).

A preparação do ensaio aguarda esse instante, no máximo cerca de um segundo, antes de marcar a visita como concluída. Conserva o intervalo de 180 segundos, a conclusão original do equipamento, os comprovativos e todas as validações da aplicação. Não aumenta tempos limite, não repete pedidos falhados e não altera a regra que recusa conclusões futuras. Uma primeira tentativa local de recuar a conclusão foi descartada porque deixava o equipamento fora do intervalo; o ensaio final conserva a sequência real dos eventos.

Passaram 576 testes unitários em 78 ficheiros, quatro testes técnicos e sintaxe 622 backend / 218 frontend / 62 inline. O percurso completo de API e Chromium passou com a correção: sobreposições, recursos associados, parcelas de custo, provas históricas, duas instâncias, falhas atómicas, resposta perdida e recuperação. O lote acrescenta três verificações de normalização do acordo: igualdade do cálculo no backend/navegador, rejeição de cobranças contraditórias e preservação exata dos acordos mensais anteriores. A consulta de visitas faturáveis limita a leitura a 10 001 registos para aplicar o limite já existente de 10 000 antes de bloquear as linhas.

A documentação atualiza o fecho da TASK326 com os 229 grupos e o restauro PostgreSQL 16 de 127 tabelas/46 ficheiros aprovados. Essa aprovação pertence a `b0b3b7f95c8ae5255bdf1cd1262c1565b3f23e89`; não aprova os lotes posteriores. CI e restauro do presente lote permanecem pendentes até confirmação nativa.

Sem migrações, dependências, alterações de produção ou contactos reais. Cobertura financeira integral e operação de produção continuam por confirmar.
