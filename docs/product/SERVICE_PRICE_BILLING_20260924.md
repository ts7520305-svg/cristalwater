# TASK331 — Cobrança dos preços por visita acordados

Cada época pode usar mensalidade com visitas incluídas ou um preço por visita concluída. É possível alternar os modos ao longo do ano. A normalização recusa a soma involuntária de mensalidade e preço por visita na mesma época e mantém intacta a estrutura dos acordos mensais anteriores. O cálculo partilhado apresenta a mensalidade e o preço unitário separadamente; visitas planeadas não são apresentadas como receita realizada.

A confirmação administrativa conserva o hash do acordo e da simulação. O calendário guarda o preço na coluna financeira da visita e a proveniência sem montantes. Revisões alteram apenas visitas automáticas ainda intactas; visitas realizadas, manuais ou com preço divergente ficam preservadas. Exceções datadas e cadências das TASK327–328 continuam integradas e sujeitas à prova da TASK330.

Os cinco percursos — CORE, OPERATIONAL, CORE_LEGACY, página de faturação e rotina mensal — usam a mesma seleção de visitas concluídas, pelo mês UTC de conclusão. Criam linhas SERVICE identificadas, reservam as origens e marcam a cobrança na mesma transação. Preço zero ou ausência de visitas concluídas não gera prematuramente um documento vazio que bloqueie a cobrança posterior. Documentos anteriores não são recalculados. Linhas manuais com preço divergente são recusadas e a consulta de receitas marca fontes alteradas para revisão.

## Verificação

- 569 unitários em 78 ficheiros, quatro técnicos e sintaxe 622 backend / 218 frontend / 62 scripts inline aprovados.
- API em base descartável com 40 migrações: cinco percursos de documentos, prova administrativa, confirmação repetida, concorrência, mudança de preço, origens adulteradas, preservação de documentos/visitas e proteção de mensalidades.
- Épocas mistas, gratuitas, proporcionalidade civil, exceções datadas a um cêntimo, reservas de rascunhos retirados e revisão independente de receitas aprovadas. Regressão do calendário de 24 meses, frequências, exceções e preços anteriores aprovada.
- O primeiro ensaio local detetou a dependência do cálculo partilhado ainda não integrada; o ficheiro foi acrescentado e o ensaio completo da API voltou a passar.

Ensaios locais em PGlite/socket, com provedores desligados. O editor e a inclusão do novo ensaio API/navegador no runner são a continuação imediata. Não há novas migrações ou dependências. CI nativo e restauro desta integração ainda pendentes. A app continua a produzir documentos internos; a fatura fiscal é emitida externamente.
