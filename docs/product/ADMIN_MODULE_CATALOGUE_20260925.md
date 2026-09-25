# TASK360 — catálogo administrativo e destinos de navegação

## Problemas confirmados

O menu tinha listas fixas apresentadas como “Recentes” e “Favoritos”, sem corresponder ao histórico ou às escolhas da conta. O índice mantinha uma lista separada de páginas públicas, administrativas e de outros perfis, sem guarda ADMIN explícita. As listas podiam divergir da navegação comum. A ficha técnica exigia uma piscina que a ligação genérica não fornecia. Os parâmetros antigos `tab=products`, `tab=movements` e `scope=repairs` não eram consumidos pelos destinos. O centro de testes antigo combinava dois encaminhamentos e perdia o idioma.

## Alteração

- Menu e índice usam a mesma projeção imutável dos grupos ADMIN da navegação comum. São **68 entradas, 13 áreas e 67 destinos distintos**: 61 ligações distintas já existentes e sete entradas complementares explícitas. Ligações repetidas ficam num só cartão, conservando as áreas e os termos antigos de pesquisa.
- Pesquisa literal, sem distinguir acentos ou maiúsculas, pelos nomes nos cinco idiomas, termos antigos, áreas e destinos. Filtros e idioma conservam-se no endereço, na recarga, na alternância entre menu/índice e no regresso à página. Parâmetros desconhecidos, repetidos ou inválidos têm estado próprio e podem ser limpos. Não há abertura automática de resultados.
- As listas fictícias foram substituídas por **atalhos diários**, expressamente estáticos. O índice mostra o destino de cada ligação. Conteúdo próprio em PT/EN/FR/ES/DE; o idioma segue para o módulo escolhido. O menu carregado permite procurar sem ligação, com indicação offline.
- A ficha técnica abre a lista de piscinas com instrução para escolher a piscina primeiro. Stock e movimentos apontam para `#stock` e `#movements`; reparações e orçamentos para `#commercialQuotes`. Não se inventa uma identidade nem um filtro inexistente.
- As duas páginas declaram ADMIN e usam a guarda existente. O catálogo recusa sessões incoerentes, trocadas ou expiradas, limpa os cartões na suspensão e recupera os filtros do endereço. Não consulta APIs de negócio nem grava preferências ou listas pessoais. O antigo estado de formulário sem proprietário não é recuperado.
- `/admin-test-center` usa o encaminhamento único de sessão já validado para entradas antigas, com alternativa de login sem JavaScript. Só um idioma suportado segue no endereço. A tabela histórica de rotas conserva as entradas e os perfis registados, mas passa a distinguir os cartões atuais das entradas de outros perfis e dos aliases.

## Validação

**698 testes unitários em 97 ficheiros, quatro técnicos, sintaxe de 640 ficheiros backend, 250 frontend e 46 scripts inline.** Oito testes novos verificam o modelo contra a navegação real, duplicados, destinos locais, contexto da piscina, âncoras, pesquisa e parâmetros. O script de integração final também passou na verificação de sintaxe após o ajuste da expectativa de perfil.

Três grupos integrados aprovados: `test-field-admin-catalogue.js`, `test-field-legacy-entry.js` e `test-shared-navigation-browser.js`. O catálogo verifica respostas HTML dos 67 destinos e seis âncoras existentes; os dois ecrãs reais em cinco idiomas e três larguras; pesquisa, área, vazio, recarga, alternância, erro de script, offline, suspensão, histórico do navegador, mudança/expiração da sessão e oito casos das guardas. Um resultado é aberto por teclado até ao resumo diário real, com regresso aos filtros anteriores. Zero chamadas às APIs de negócio durante os percursos do menu/índice, zero escritas e contagens de dados inalteradas. A abertura do resumo diário faz a consulta própria dessa página.

As entradas antigas passaram **60 casos**, duas páginas reais de menu do cliente, três entradas sem JavaScript e três casos de compatibilidade do script antigo. A navegação comum passou oito páginas/perfis e quatro larguras, incluindo foco do menu, pesquisa, teclado e indicador offline. O primeiro ensaio do catálogo falhou porque esperava que TEAM_LEADER fosse encaminhado para o modo técnico pela guarda ADMIN; a guarda existente envia esse perfil para login. A expectativa foi corrigida e o grupo completo repetido com sucesso, sem alterar a política global.

Trinta e duas capturas do catálogo em `reports/field-visual/admin-catalogue/`: 30 páginas em 320/390/1440 e dois cartões de contexto. Revistos menu PT390, índice PT1440, menu/índice DE320 e cartão PT. O conteúdo próprio cabe nas larguras verificadas. A navegação comum permanece parcialmente em português e os dois recursos binários não materializados na cópia local mantêm a ressalva do inventário. Não se declara revisão visual completa dos 67 módulos.

Runtime PGlite isolado, 40 migrações existentes, Chromium com múltiplos processos e segurança web ativa. Sem novas dependências ou migrações. Cache **v171**, runner com **257 grupos distintos**. Inventário estático: 115 HTML, 98 páginas com referência literal em 278 scripts ativos, 17 na fila de pesquisa, zero recursos ausentes do repositório. Referência literal e resposta HTML não provam conclusão funcional.

## CI, publicação e limites

TASK358 confirmada em [255/255 grupos e restauro PostgreSQL nativo](evidence/20260925_task358_ci.json): 17 etapas aprovadas, 676 unitários, quatro técnicos, 127 tabelas e 47 ficheiros com linhas e hashes iguais; duração 36m40s. TASK359, execução `36134907116` e job `108070540081`, permanece em execução no último controlo.

Publicada em `685ba2b44dd95befd6f9bf8194a1082fafbae0a9`, árvore `5c2317073ef6c23c5521caf84c1eb59717282e46`, idêntica à preparada e validada localmente. [CI 36138136641](https://github.com/ts7520305-svg/cristalwater/actions/runs/36138136641), job `108081104612`, em execução; os 257 grupos e o restauro PostgreSQL nativo deste lote continuam por confirmar.

Este lote valida a navegação e o catálogo. As permissões e os dados continuam a ser confirmados nos destinos e nas APIs existentes. O grupo de navegação comum isola os scripts de negócio; não equivale a rever integralmente as oito páginas. O catálogo não cria favoritos pessoais, não certifica a saúde dos módulos nem publica em produção. Conciliação histórica, volume, infraestrutura/VPS, cópias de segurança operacionais, serviços externos e piloto físico iPhone/Android continuam pendentes. Sem merge, deploy ou contactos reais; aplicação não declarada completa.

## Retoma concreta

A inspeção identificou dois trabalhos ainda não alterados neste lote. Prioridade: `/admin-onboarding` guarda um rascunho global sem proprietário, converte a hora local para UTC antes de preencher `datetime-local` e faz um POST de criação seguido de um segundo PUT da piscina, sem recuperação idempotente de resposta perdida. A API ignora campos fiscais apresentados no formulário, trata algumas falhas auxiliares silenciosamente e reutiliza a mensalidade como receita da visita. É necessário rever o contrato e a transação antes de modificar este percurso de criação.

Em `/admin-ui-settings`, as preferências antigas `cw_theme`/`cw_density` são globais ao navegador; o gestor antigo escreve valores por omissão e recarrega a página, enquanto a interface moderna segue sobretudo o sistema operativo e estilos próprios. A aplicação global de tema/densidade requer revisão conjunta; não foi prometida nem alterada aqui. Os restantes 17 HTML da fila estática continuam no inventário.
