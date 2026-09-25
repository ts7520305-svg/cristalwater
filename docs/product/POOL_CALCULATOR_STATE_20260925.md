# TASK345 — calculadora: piscina, campos e resultados coerentes

A página /admin-pool-calculator deixava valores da piscina anterior nos campos nulos e podia aplicar respostas tardias à seleção seguinte. A consulta e a gravação passam a depender da piscina confirmada e dos campos visíveis. [Evidência local](evidence/20260925_task345_local.json).

## Comportamento entregue

- Cada carregamento limpa todos os campos e resultados antes de consultar a piscina escolhida. Nulos, cobertura falsa, perfil inexistente e valores iniciais deixam de herdar dados de outro registo. A forma histórica CIRCULAR e casas decimais existentes são conservadas.
- Endereços inválidos, IDs duplicados ou piscinas ausentes não abrem silenciosamente o primeiro registo. Carregamento, erro e lista vazia são estados diferentes; não se pode gravar antes de confirmar a ficha.
- Os resultados só aparecem após calcular os campos visíveis. Isto também evita apresentar o volume principal antigo quando diverge do volume do perfil mostrado. Editar invalida imediatamente o resultado anterior.
- Os blocos dependentes de volume, medições ou potência em falta indicam dados insuficientes. Uma salinidade explicitamente medida como zero continua distinta de um campo vazio. As fórmulas existentes são conservadas; a página não apresenta os zeros produzidos pelos pressupostos antigos como medições conhecidas.
- As medições químicas guardadas vêm do último resultado da própria piscina. A pré-visualização usa o pedido capturado; foi removido o cálculo paralelo que convertia campos químicos vazios em zero e acrescentava recomendações de outro estado do formulário.
- Texto de clientes, piscinas, formas e fórmulas é apresentado literalmente. Respostas HTTP, tipo JSON, estrutura do cálculo, identidade da piscina e correspondência dos campos após cada espera são conferidos. Timeout de 15 segundos, offline e respostas fora de ordem não mostram sucesso nem resultados anteriores.
- A gravação bloqueia campos, seleção e cliques repetidos. A confirmação verifica o perfil normalizado, o resultado guardado e as medições do pedido. Resposta perdida ou divergente conserva o formulário e bloqueia nova gravação até recarregar e verificar a ficha, com descarte explícito.
- Troca de piscina, recarga e limpeza respeitam alterações por guardar. Cancelar conserva campos, seleção e endereço. O histórico da página preserva o formulário em memória; a memória genérica de navegação não repõe dados sobre outra piscina. Não há novo rascunho persistente.
- Sessão alterada ou expirada remove os dados visíveis e desativa ações. O cancelamento de uma leitura obsoleta deixa de produzir o aviso comum de falha de ligação; erros reais mantêm o aviso. As regressões de sessão e entrada foram executadas.
- Estados geridos pela página evitam o indicador de carregamento permanente do adaptador comum. Contraste, foco, linhas dos resultados e larguras 320/390/1440 foram revistos. A interface deste lote é PT-PT.

## Validação

614 testes unitários em 84 ficheiros, quatro técnicos e sintaxe de 630 ficheiros backend, 224 frontend e 62 scripts inline aprovados. Cinco grupos locais passaram: estado da calculadora em API/Chromium, fórmulas existentes, controlo administrativo antigo, sessão técnica e entrada/autenticação.

O ensaio usa três piscinas reais numa base PGlite isolada: perfil preenchido, perfil parcial e perfil inexistente. Confirma campos nulos, precisão, CIRCULAR, medições do registo certo, divergência entre volume principal e perfil, ausência distinta de zero, respostas tardias/incompatíveis, erros, timeout, offline, descarte cancelado, histórico, sessão e expiração real. Duas gravações deliberadas chegam à base; uma terceira confirmação divergente é simulada e recusada. As piscinas não editadas e as contagens de pagamentos, documentos, notificações e históricos permanecem iguais. A limpeza remove apenas os dados próprios do ensaio.

Seis capturas de formulário/resultados ficam em `reports/field-visual/pool-calculator/`, regeneradas pelo teste. A evidência inclui os hashes das fontes, logs e capturas. Cache v157, runner com 243 grupos distintos, 40 migrações existentes, sem novas dependências ou migrações.

## Estado e limites

Publicada em `07ed3b0f59eba4418b7a608a32fc1e6a093e00f9`, árvore `262c68776350d69575b284cd47ced3157fb458a2`, idêntica à validada localmente. [CI 36099280297](https://github.com/ts7520305-svg/cristalwater/actions/runs/36099280297), job `107958111534`, aprovado: 243/243 grupos esperados distintos, 17 etapas e restauro de 127 tabelas/47 ficheiros, com linhas e hashes iguais. [Evidência nativa](evidence/20260925_task345_ci.json). A TASK344 está publicada em `57724267af9e3512dfb0be739d0b11ddf454dcd4`; [CI 36097287730](https://github.com/ts7520305-svg/cristalwater/actions/runs/36097287730) aprovado: 242/242 grupos, 17 etapas e restauro de 127 tabelas/47 ficheiros.

Esta secção descreve o âmbito original da TASK345; a gravação revista e recuperável foi implementada posteriormente na [TASK346](POOL_CALCULATOR_WRITES_20260925.md). Este lote não altera as fórmulas nem a persistência do backend. As APIs antigas conservam os pressupostos e a projeção anteriores; gravação atómica/versionada, concorrência entre administradores e comprovativo recuperável da calculadora continuam por implementar. Recarregar após uma resposta perdida consulta o estado atual e não substitui esse comprovativo. A revisão visual não certifica os cinco idiomas.

Inventário: 115 HTML, 80 páginas com referência literal em 264 scripts ativos e 35 na fila de pesquisa. Referência literal não equivale a revisão completa. Retomar CI/restauro e os critérios restantes, preservando os registos originais. Sem merge, deploy ou contactos reais.
