# TASK230 — Ranking e prioridades com resultados confirmados

## Falhas observadas

- `/ranking` não executava o JavaScript: um ponto após uma instrução terminada interrompia o script. A API agrupava pelo nome histórico, juntando técnicos homónimos e ignorando o nome da relação atual.
- `/admin-priority` tratava `{ ok, pools }` como array. O formulário enviava para `/api/pools/priority/:id`, que não existe, e escrevia sucesso na consola sem verificar a resposta.
- A verificação de sintaxe só cobria o backend. A extensão da verificação encontrou o mesmo erro de encadeamento em `/metrics`, também corrigido. Isso não valida os cálculos nem os gráficos desse módulo.

## Correções

O ranking exige ADMIN e agrupa pela identidade do técnico. Conserva registos históricos sem relação num grupo separado, suporta nomes coincidentes com propriedades de objetos e exclui visitas canceladas. Conta conclusões por estado ou data de fecho. A página explica que a taxa se refere às visitas regulares de todo o histórico; não se atribuem medidas de qualidade nem cobertura de visitas extra a este indicador.

As duas listas distinguem carregamento, vazio, erro e mudança de sessão. Recusam 202/respostas malformadas, oferecem nova consulta e descartam dados de uma conta anterior. Os nomes são texto literal.

As prioridades usam o editor de piscina e a API versionada existentes: escolha explícita, gravação confirmada, pedido conservado antes do transporte, recuperação de resposta perdida e revisão por campo. O novo modo tem armazenamento próprio e conserva a forma v1 dos pedidos/rascunhos do editor geral. As duas variantes usam o bloqueio da mesma piscina e a mesma versão do servidor. Valores antigos fora das três opções são apresentados e preservados até alteração explícita.

Os estilos do editor foram extraídos sem alteração para um recurso comum. A verificação de sintaxe cobre agora também 170 ficheiros JS frontend e 67 scripts inline, além dos 539 ficheiros backend. O runner integrado passa a 125 grupos; não há migração.

## Validação

- `run-1789660719591`: regressão completa do editor geral aprovada. O primeiro ensaio das novas páginas foi corrigido porque o token TEAM_LEADER da fixture apontava para um registo TECHNICIAN; 401 era a recusa correta desse token incoerente.
- `run-1789660821364`: novas páginas/API aprovadas, incluindo três perfis recusados, homónimos, registos legados, cancelamento, dados malformados, perda de resposta depois do commit, recarga sem duplicação, conflito/revisão explícita e conservação de rascunho real do editor geral.
- `run-1789661031335`: versão final das páginas, editor em 320/390/1440 e regressão completa da ficha técnica aprovadas. A prioridade recebe o foco e surge no início do formulário.
- 388 testes unitários e sintaxe backend/frontend/inline aprovados localmente. Os 21 scripts de navegador da TASK229 passaram; confirmar a árvore conjunta no CI PostgreSQL 16, com 125 grupos e restauro.

## Correção complementar da TASK229

O CI `35242801240` do commit `c305b8086e777aff3ab27ca48bc4dd2b0e970379` aprovou 123/124 grupos, unitários e 21 scripts de navegador; não executou o restauro. A revisão da ficha técnica ficava parcialmente sob o cabeçalho após scroll. Reprodução local confirmou `elementFromPoint` no cabeçalho em vez da escolha do formulário. A navegação passa a definir o espaço de deslocação do documento com a altura real do cabeçalho e a barra inferior móvel. O ensaio mantém a asserção de elemento em primeiro plano e aprovou em cinco idiomas/três larguras no teste final acima.

Pendente: validação nativa desta árvore, sem usar o CI falhado como aprovação. Mapas/gráficos com recursos externos, cálculo dos indicadores de `/metrics`, restantes ecrãs/PDFs e ensaios físicos/VPS continuam na revisão global.
