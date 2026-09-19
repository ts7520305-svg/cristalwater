# TASK272 — Consulta dos relatórios mensais no portal do cliente

## Problema e comportamento

Os relatórios mensais CLIENT guardados já tinham consulta autorizada e geração por período, mas faltava a sua entrada no portal atual. A secção «Relatórios e documentos» passa a apresentar uma lista própria, sem reativar `frontend/client.js` nem alterar o manifesto dos restantes documentos.

- O cliente consulta os seus relatórios guardados e o administrador consulta o cliente selecionado na pré-visualização. Usam-se as rotas existentes de listagem e PDF, sem novas rotas, alterações de JSON, migrações ou geração de documentos durante a consulta.
- Lista ordenada do mês mais recente para o mais antigo, filtro de mês, seis relatórios por página, atualização manual e estados claros de carregamento, ausência, falha e sessão alterada. Cada entrada identifica mês, data de geração e estado guardado, revisão necessária ou histórico.
- Interface em português, inglês, francês, espanhol e alemão. A interface explica que os PDFs guardados continuam em português; esta tarefa não traduz o conteúdo dos relatórios.
- A abertura reutiliza o leitor autenticado existente através do modo explícito `CLIENT_MONTHLY`. O modo ADMIN anterior continua predefinido. URLs canónicos, mesma origem, cliente autenticado e ausência de credenciais na URL são confirmados antes do pedido.
- A listagem exige HTTP 200, JSON e identidade do cliente/tipo. Cada linha exige ID único, cliente/tipo corretos, mês válido e data de geração. O PDF exige HTTP 200, tipo PDF, cliente, relatório, mês e idioma exatos, conteúdo não vazio e assinatura/início/fim válidos antes de criar a URL temporária.
- A seleção inclui revisão do cliente, idioma, filtro, página e relatório. Mudanças cancelam pedidos/aberturas e descartam respostas antigas, incluindo A–B–A e corpo recebido depois do cancelamento. Uma mudança de sessão esvazia a lista e impede nova abertura nessa instância.
- Pedidos têm limite de 20 segundos. Janelas bloqueadas não iniciam transferência; cliques repetidos não duplicam a abertura. O leitor reserva a janela no clique, remove `opener`, revoga o ficheiro temporário e fecha a janela quando o contexto deixa de ser válido. Regresso pelo histórico do navegador exige nova consulta.
- Falha de rede não limpa a sessão nem provoca repetição automática. A atualização explícita recupera a lista. Rascunhos dos pedidos existentes continuam preservados. Nenhum JSON/PDF privado é persistido pela nova secção e a exclusão das APIs na cache mantém-se; versão pública v90.
- O painel usa a opção existente `data-cw-state-managed="manual"` para gerir os seus próprios estados acessíveis. Isto impede o adaptador global de converter a secção inteira num aviso flexível.

## Verificação local

- `run-1789767132039`: regressões de acesso mensal e abertura autenticada ADMIN aprovadas. A nova interface passou identidade, paginação, falhas e idiomas, mas detetou excesso de largura a 320 px. `run-1789767259720` identificou as classes globais de aviso aplicadas ao painel; ambas as falhas ficam registadas.
- `run-1789767517966`: novo percurso integral aprovado após a opção de estado manual, incluindo seleção ADMIN A–B–A, cliente sem relatórios, sessão entre separadores, HTTP 401 real e preservação integral dos relatórios, visitas e registos financeiros. A regressão dos pedidos de visita/aviso de pagamento passou nos cinco idiomas, falhas de rede/armazenamento, duas janelas e recuperação de rascunhos.
- `run-1789767604019`: repetição final do percurso mensal aprovada após ajustar o espaço interior dos cartões. Imagens de 320/390/1440 px em `reports/field-visual/client-monthly-portal-1789767616849/` revistas; textos e controlos cabem nas larguras verificadas. A barra fixa de navegação existente aparece nas capturas longas do telemóvel e mantém a navegação normal da página.
- O novo grupo cobre 14 meses e três páginas; PDF histórico e atual; respostas com identidade divergente, JSON inválido, PDF vazio/truncado, erro de autorização/servidor e resposta atrasada; cancelamento durante leitura do corpo, tempo excedido, modo sem rede, janela bloqueada e regresso pelo histórico. As verificações de largura incluem o painel, campos e botões a 320/390/1440 px.
- Gates locais aprovados: sintaxe de 560 ficheiros backend, 184 frontend e 56 scripts inline; 396 testes unitários em 63 ficheiros e quatro testes técnicos. O runner integral passa de 154 para 155 grupos. Mantêm-se 21 migrações.

CI PostgreSQL 16 e restauro aprovados para o commit `447e0024a6c7f2dfa4de5402fbe4d18472aac584`, árvore `8270a57ec5126549d1acb2e515fa616db53682ee`: [run 35398149793](https://github.com/ts7520305-svg/cristalwater/actions/runs/35398149793), job `105771615641`, workflow concluído e atualizado em 18/09/2026 às 22:00:47 UTC. Confirmados 155/155 grupos distintos, todos com código zero e sem sinal; novo percurso mensal em 13799 ms, acesso mensal em 735 ms e geração mensal em 970 ms. Sintaxe 560/184/56, 396 unitários/63 ficheiros, quatro técnicos, 21 scripts do gate de navegador e 21 migrações aditivas aprovados. Restauro de 110 tabelas e 46 ficheiros carregados, com linhas e hashes iguais.

A atualização final de 19/09/2026 altera apenas este relatório e o checkpoint, conservando o código/testes da árvore aprovada. Publicação na branch autorizada `work/field-readiness-20260915-simulation`, sem merge ou instalação no VPS. Backup local da implementação: `backup/client-monthly-portal-local-20260918`.

## Limites e próximo percurso

Esta tarefa permite consultar relatórios já guardados. Não recalcula históricos nem gera cobranças. A frequência e os preços continuam definidos por cliente, época e instalação: três visitas ou mais conforme cada caso.

Continuam para revisão própria o manifesto/acesso aos restantes documentos do portal, a correção explícita de relatórios antigos, os agregados do gerador mensal global ADMIN e a seleção de mês no envio por email. Instalação no VPS, ensaios físicos e fornecedores continuam pendentes. Publicação apenas na branch de trabalho autorizada, sem merge, instalação em produção, envios reais ou emissão fiscal.

## Ficheiros (10)

1. `frontend/cw-client-monthly-reports.js`
2. `frontend/client-portal.html`
3. `frontend/client-portal.js`
4. `frontend/cw-report-download.js`
5. `frontend/sw.js`
6. `src/controllers/clientReportController.js`
7. `scripts/test-field-client-monthly-reports-ui.js`
8. `scripts/test-field-suite.js`
9. Este relatório.
10. `docs/product/CURRENT_WORK_CHECKPOINT.md`
