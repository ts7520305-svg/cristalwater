# Documentos no portal do cliente — TASK274

Data: 21/09/2026. Branch: `work/field-readiness-20260915-simulation`.

## Objetivo e comportamento

O portal apresentava apenas oito documentos e usava ligações diretas sem o cabeçalho de autenticação exigido pela API. A consulta genérica passa a apresentar todos os documentos disponibilizados pela API para o cliente selecionado, com pesquisa por título/tipo/nome e seis entradas por página. O botão **Transferir** recebe o ficheiro autenticado como anexo. Os relatórios mensais conservam o seu painel e a abertura própria de PDF.

- CLIENT consulta exclusivamente o próprio cliente; a pré-visualização ADMIN acompanha a seleção exata, incluindo a sequência A–B–A.
- Lista e ficheiro exigem HTTP 200 e identificação do cliente/documento nos cabeçalhos. A lista também exige JSON válido, `ok: true`, identificadores únicos/canónicos e ambas as ligações autenticadas exatas.
- IDs antigos de 13 dígitos e o limite `Number.MAX_SAFE_INTEGER`, incluindo a representação em string, são aceites. Documentos históricos identificados pela visita podem legitimamente ter `clientId: null`; o cabeçalho da API e a ligação continuam a confirmar o titular. Datas ausentes/inválidas não escondem esses documentos.
- O ficheiro exige `application/octet-stream`, `Content-Disposition: attachment` e os identificadores da resposta. O tamanho declarado é confirmado quando não existe compressão. Um ficheiro genérico vazio é válido. As regras de integridade dos relatórios PDF/HTML anteriores mantêm-se.
- A transferência usa um Blob e um elemento `download`, sem abrir janela nem navegar para conteúdo HTML/SVG. O nome confirmado pelo servidor conserva Unicode e recebe tratamento de separadores/carateres de controlo. A mensagem confirma **transferência iniciada**; a gravação final pertence ao navegador.
- Mudança de cliente, idioma, pesquisa, página ou sessão cancela a operação anterior. Respostas e corpos atrasados não recuperam dados de uma seleção antiga. Pedidos têm limite de 20 segundos; URLs temporários são revogados ao cancelar/sair ou após 60 segundos. O regresso pelo histórico do navegador volta a consultar os documentos.
- Falhas mantêm uma nova tentativa explícita. Não existe repetição automática ao recuperar a ligação nem armazenamento persistente das listas/bytes privados pelo componente. Rascunhos dos outros formulários são preservados.
- Interface PT/EN/FR/ES/DE, pesquisa sem distinção de acentos e controlos com altura mínima de 44 px. O painel usa o estado manual existente para evitar que o adaptador visual o transforme num indicador.

## Ficheiros da tarefa

| Ficheiro | Alteração |
| --- | --- |
| `frontend/cw-client-documents.js` | Componente de consulta, pesquisa, paginação, tradução e recuperação. |
| `frontend/client-portal.html` | Painel, controlos, estilos e inclusão do componente. |
| `frontend/client-portal.js` | Sincronização de cliente/idioma; retirada do limite de oito e das ligações diretas. |
| `frontend/cw-report-download.js` | Modo documental que reutiliza o ciclo de autenticação, cancelamento e revogação. |
| `frontend/sw.js` | Atualização da cache de recursos para `cristalwater-field-20260921-v91`. |
| `scripts/test-field-client-documents-ui.js` | Percurso integrado de API, navegador, downloads reais e falhas. |
| `scripts/test-field-suite.js` | Inclusão do 157.º grupo. |
| `docs/product/CLIENT_DOCUMENT_PORTAL_20260921.md` | Âmbito e evidência da tarefa. |
| `docs/product/CURRENT_WORK_CHECKPOINT.md` | Ponto de retoma. |

Nove ficheiros, uma responsabilidade; sem alteração de rotas, respostas JSON, Prisma ou migrações.

## Verificação

O novo grupo percorre 14 documentos próprios e um de outro cliente, as três páginas, pesquisa, nomes Unicode, texto semelhante a HTML, um documento histórico sem data/titular explícito e um ficheiro vazio. Confirma os bytes efetivamente recebidos pelo navegador e a ausência de execução de conteúdo ou janelas novas. Exercita respostas/cabeçalhos/URLs inválidos, identidades divergentes, duplicados, HTTP 202/302/403/404/503, corpo JSON inválido, tamanho divergente, cliques repetidos, atrasos no cabeçalho/corpo, mudanças A–B–A, mudança de idioma, timeout, offline, revogação, pagehide/BFCache, mudança de sessão noutra janela e o tratamento real do HTTP 401. Manifesto e ficheiros são repostos; contagens de visitas, relatórios mensais e registos financeiros ficam iguais.

O ensaio no navegador encontrou a perda do primeiro clique depois de pesquisar: o evento `change`, disparado ao sair do campo, reconstruía o botão antes de receber o clique. A pesquisa passa a responder ao evento `input`; o mesmo percurso confirmou a correção sem retirar a asserção de download.

Primeiro ensaio integral aprovado: `/tmp/cw274-documents-ui.log`, imagens em `reports/field-visual/client-documents-1790000471401/`. Ensaio final com a mudança de idioma pendente: `reports/field-visual/client-documents-1790000505447/`. Imagens 320/1440 revistas; a geometria 320/390/1440 é verificada automaticamente. Runtime local: Node 24.19.0, Chromium 153 e PGlite com as 21 migrações existentes. As limitações iniciais de preparação local foram corrigidas no runtime temporário; não alteraram a aplicação. A telemetria Prisma foi desativada com `CHECKPOINT_DISABLE=1` após rejeição automática da preparação anterior.

Gates locais: sintaxe 562 backend/185 frontend/56 inline, 396 testes unitários em 63 ficheiros e quatro técnicos aprovados. `/tmp/cw274-regression.log` confirma os cinco grupos dirigidos: novo portal documental, autorização dos documentos, portal mensal, leitor ADMIN e pedidos do portal. O gate geral de 21 scripts do navegador também passou com `CW_CHROMIUM_PATH=/tmp/cw274-chromium` (`/tmp/cw274-browser-gate.log`). A execução nativa PostgreSQL 16 e o restauro também foram aprovados, conforme o registo seguinte. As falhas anteriores do runtime local não são apresentadas como resultados da aplicação.

## Publicação e aprovação nativa

- Commit de código: `21d43974aaff61e44a45fe9d1b574bc0995f2ded`; árvore `b91a50be094e483aa102cf93dc9cc654dd5f71e1`, igual à árvore local publicada.
- [CI 35612202285](https://github.com/ts7520305-svg/cristalwater/actions/runs/35612202285), job `106373848899`: concluído com sucesso e workflow atualizado em 21/09/2026 às 14:44:10 UTC.
- 157/157 grupos distintos, todos com código zero e sem sinal de interrupção. Novo portal documental: 16490 ms; autorização documental: 1830 ms; portal mensal: 14316 ms; leitor ADMIN: 9826 ms; pedidos do portal: 8213 ms.
- Sintaxe 562 backend/185 frontend/56 inline, 396 unitários em 63 ficheiros, quatro técnicos, 21 scripts do gate de navegador e 21 migrações aditivas aprovados.
- Restauro aprovado de 110 tabelas e 46 ficheiros enviados, com igualdade das linhas da base de dados e dos hashes dos ficheiros.

Branch autorizada publicada sem força. Backup local `backup/client-documents-portal-local-20260921`. A atualização posterior à aprovação altera apenas os dois documentos desta tarefa e conserva o código/testes aprovados.

## Limites e continuação

Mantém-se a política da TASK273: referências históricas ambíguas não são disponibilizadas automaticamente e precisam de revisão explícita. Agregados globais ADMIN e escolha de mês no email continuam por rever. A consulta do código para a próxima tarefa confirmou que já existem `Client.requiresInvoice`, `Invoice.requiresInvoice`, `externalInvoiceNo` e o ecrã `to-issue`; não recriar este fluxo. Priorizar a revisão da associação/checklist de serviços e da confirmação do número externo. A leitura estática encontrou diferenças entre `POST /api/invoices/:id/mark-issued` (associado à guarda de emissão fiscal) e o alias `POST /api/core/invoices/:id/mark-external-issued` (atualização direta); reproduzir e delimitar o registo interno, a validação e a concorrência antes de corrigir. Não é uma validação funcional dessas rotas nesta tarefa. A diretiva comercial mantém frequência/preços por cliente, época e instalação, com três ou mais visitas conforme o caso; a emissão fiscal com IVA continua externa, com pedido/checklist/número externo a acompanhar na aplicação.

Publicação apenas na branch autorizada; sem merge, deploy na VPS, envio real de mensagens ou emissão fiscal. A aprovação desta tarefa não equivale à conclusão global do sistema.
