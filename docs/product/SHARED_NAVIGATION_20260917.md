# TASK229 — Navegação comum utilizável nas páginas antigas

## Problema confirmado

Na entrada inicial de 45 páginas em QA isolada, 31 títulos apareciam abaixo de 600 px devido ao menu no fluxo do documento. A reprodução do commit `d67e157591f816f1d11aece020bc2a0e11df43ac` na frota confirmou menu `static`, título a 1374,77 px e zero resultados ao pesquisar Ajuda. O código de pesquisa arrancava antes de o menu existir.

## Alteração

- Estilos próprios da navegação gerada, sem aplicar uma nova base visual aos painéis ou portais com navegação própria. Barra lateral fixa no computador, painel móvel com deslocação, atalhos inferiores e espaço para o cabeçalho medido após mudanças de largura/conteúdo.
- Pesquisa ligada também quando o menu é criado depois do script principal; destinos locais sem duplicados, texto literal, resultado vazio e abertura por teclado. A indicação passa a dizer apenas Pesquisar, com nome acessível Pesquisar no menu.
- Abertura do painel coloca o foco no fecho; Tab mantém o foco no painel e Escape devolve-o ao botão de abertura. Indicador online/offline encontra os elementos criados posteriormente.
- CSS incluído no service worker v57. Nenhuma alteração de base de dados.

## Validação

- Reprodução histórica: `CW_NAV_BASELINE_SHA=d67e157591f816f1d11aece020bc2a0e11df43ac node scripts/test-shared-navigation-browser.js`.
- Oito páginas reais em quatro larguras (320/390/1024/1440), quatro perfis, estilos reais e scripts de navegação: posição do conteúdo/menu, foco, pesquisa tardia, entradas maliciosas literais, duplicados, link por teclado, ligação e conservação do trabalho aprovados. Os scripts de negócio da página são excluídos deste ensaio de componente; não confundir com validação de API.
- `run-1789659823969`: login e navegação do chefe de equipa, recuperação offline, preferências, ajuda, pagamentos e recuperação de conversas aprovados com API/base/Chromium. Os cliques técnicos usam o painel móvel visível, conservando as verificações de permissões e rascunhos.
- Mesma execução: revisão inicial das mesmas 45 páginas; zero títulos acima do limite de 600 px. Permanecem erros independentes no ranking, prioridades e páginas dependentes de bibliotecas externas bloqueadas durante o ensaio. Isto é triagem de entrada, não aceitação integral das 45 páginas.
- 388 unitários, 21 scripts de navegador e sintaxe de 539 ficheiros backend aprovados. A primeira regressão encontrou uma espera fixa de 100 ms insuficiente para intercetar um upload; o ensaio de sessão passou a aguardar a interceção real, conservando as mesmas asserções. O ensaio de ajuda aguarda a medição do cabeçalho após redimensionar.
- CI PostgreSQL 16/restauro: confirmar o commit publicado; não atribuir a este lote a aprovação da TASK228.

Próximos pontos: ranking interrompido por erro de sintaxe; prioridades assume array na resposta e envia alterações para um endpoint inexistente. Bibliotecas externas dos mapas/gráficos, conteúdo/tradução da ajuda administrativa, restantes páginas/PDFs e dispositivos/VPS continuam por rever. Não declarar prontidão global.
