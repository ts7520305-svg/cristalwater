# TASK342 — encerramentos no portal cliente

Data: 25/09/2026. Base: `8ea6a8eeab2018bff8e688d47b39d05a545e224e`. Código publicado: `a2afce1c38f2f2e3bd1c709fdc2f66c9a9d54e31`, árvore `ed4b739fb5ed298c8f49a2f31ed41ec95d30dd9e`, idêntica à validada localmente. [CI 36091953492](https://github.com/ts7520305-svg/cristalwater/actions/runs/36091953492), job `107936060318`, em execução; os 240 grupos e o restauro nativo ainda não estão aprovados.

## Comportamento entregue

O portal cliente apresenta uma secção de férias e encerramentos antes da agenda. A nova leitura autenticada `GET /api/client-portal/:clientId/company-closures` publica apenas encerramentos `ACTIVE`, com `showOnClientPortal`, ainda não terminados. Inclui datas futuras, para permitir preparação antecipada. Planeados, cancelados, ocultos e terminados ficam excluídos. A administração conserva a pré-visualização de um cliente existente.

A projeção contém apenas ID, título/mensagem para clientes, início/fim e contactos de emergência. Não expõe metadados, autores, aprovação, exceções, prioridades, preferências de visitas, ações de rondas ou auditoria. Um `User` com papel `CLIENT` não recebe identidade de um registo `Client` cujo ID coincida. IDs canónicos, titularidade, autenticação e existência do cliente são conferidos no servidor. As rotas administrativas continuam reservadas a ADMIN.

Datas e horas originais são conservadas; o último instante é incluído e o instante seguinte é excluído. Dias completos novos são apresentados como datas; intervalos antigos com horas específicas mostram também as horas, em UTC. A substituição de `{startDate}` e `{endDate}` ocorre apenas na mensagem de apresentação. Os textos recebidos e os contactos são nós de texto, sem interpretar HTML ou URLs. As mensagens da equipa mantêm o idioma original e têm uma indicação explícita dessa origem.

O navegador distingue carregamento, lista, vazio confirmado, limite parcial, erro e sessão alterada. A resposta tem versão, cliente, tipo, instante de leitura e limite verificáveis; IDs repetidos, identidade divergente, datas inválidas, respostas incompletas ou HTTP inesperado são recusados. Há limite de 100 avisos com sinalização explícita, sem apresentar uma lista truncada como completa.

A sessão é capturada por token, identidade, aliases e expiração. Mudança de conta elimina a lista apresentada e impede nova consulta nessa página. Seleção do cliente, idioma, navegação, regresso pelo histórico, resposta tardia, timeout de 15 segundos e offline não reutilizam uma fotografia anterior como atual. A lista é consultada novamente a cada 60 segundos, ao recuperar foco/visibilidade e pelo botão Atualizar. Uma falha remove a fotografia anterior; um aviso deixa de ser mostrado quando chega ao fim do intervalo. Um cancelamento no servidor aparece na consulta seguinte; isto não é uma emissão instantânea por socket.

Interface da secção em PT, EN, FR, ES e DE. Também foi corrigida a escolha do idioma quando a entrada contém `lang` ou `language`: a escolha explícita atualiza o endereço e mantém-se após recarregar, em vez de regressar ao idioma inicial do link. Seleção do cliente e restantes parâmetros são conservados.

Na página administrativa, o texto junto de “Mostrar no portal cliente” explica que guardar como ACTIVE ou ativar torna o aviso visível, incluindo datas futuras. A emissão de notificações continua uma ação separada. A publicação não pausa nem reagenda visitas e não altera dinheiro, comprovativos ou registos de execução.

## Validação

- 606 testes unitários em 83 ficheiros; quatro testes técnicos.
- Sintaxe: 629 ficheiros backend, 222 frontend e 62 scripts inline.
- Seis grupos reais, todos com código zero: API do portal, navegador do portal, encerramentos administrativos, documentos do cliente, permissões administrativas antigas e recuperação da preferência de idioma.
- Chromium com processos separados e segurança web ativa. Secção revista nos cinco idiomas e em 320/390/1440 píxeis; sete capturas. Testes de texto histórico com HTML, contactos, UTC, lista parcial/vazia, respostas inválidas, offline, timeout, navegação, consulta periódica, termo do intervalo, cancelamento, conta/idioma/cliente trocados e expiração.
- Originais dos encerramentos iguais após as leituras; fontes originais restauradas após a simulação explícita de cancelamento. Contagens financeiras, visitas, notificações, auditoria e comprovativos de escrita iguais. Limpeza apenas dos dados próprios do ensaio.
- Ambiente temporário reconstruído; 40 migrações aditivas existentes aplicadas em PGlite. A ligação final desativa a cache de prepared statements. IDs dos clientes de ensaio isolados das referências antigas de chat; nenhuma mensagem histórica foi apagada para permitir a limpeza. O ensaio final completo terminou com código zero, incluindo a limpeza.

[Evidência local e hashes](evidence/20260925_task342_local.json). Não há migrações, tabelas nem dependências de aplicação novas. Cache v154; runner com 240 grupos distintos. Os componentes instalados para reconstruir o executor são temporários e não alteram `package.json`/lockfile.

## CI anterior e limites

TASK341 aprovada no CI `36063033475`, job `107846242260`: 238/238 grupos previstos distintos, sem faltas, entradas inesperadas, duplicações ou códigos não zero; 17 etapas aprovadas. Restauro nativo de 127 tabelas e 47 ficheiros, com linhas e hashes iguais. [Evidência verificada](evidence/20260925_task341_ci.json).

TASK342 aprovada no CI `36091953492`, job `107936060318`: 240/240 grupos esperados distintos, sem faltas, entradas inesperadas, duplicações ou falhas; 17 etapas aprovadas e restauro PostgreSQL de 127 tabelas/47 ficheiros com linhas e hashes iguais. [Evidência nativa](evidence/20260925_task342_ci.json). O [inventário](PAGE_INVENTORY_20260925.md) mantém 115 HTML, 78 páginas com referência literal em 261 scripts ativos e 37 na fila de pesquisa; não comprova revisão universal. A tradução desta secção não certifica todos os textos do portal. Reagendamento automático, prioridades históricas, restantes páginas e dependências de produção continuam em aberto. Sem merge, deploy ou contactos reais.
