# TASK339 — Abertura autenticada de documentos e inventário de páginas

## Resultado integrado

A TASK338 financeira publicada entretanto foi integrada integralmente: conserva o gerador, a ordem das linhas, a recusa de extras sem cliente histórico, os estados HTTP, os cabeçalhos `invoice-pdf` / `extra-billing-pdf` / `X-CW-Invoice-Id` e os ensaios correspondentes. Esta continuação estende a confirmação de identidade às guias de transporte/obra, seguro e anexos do chat; não cria outro gerador PDF.

O leitor partilhado só aceita as seis rotas PDF existentes e a rota de anexos, com ID canónico e sem opções, credenciais, fragmentos ou origens externas. Confere HTTP 200, identidade, tipo de conteúdo, cabeçalhos privados e, nos PDFs gerados, início/fim do ficheiro antes de criar o URL temporário. A última guia confere a viatura pedida e o ID da guia efetivamente encontrado. As guias históricas sem viatura conservam a consulta pelo seu ID, com `unassigned` explícito; o servidor continua a decidir a autorização por papel/viatura.

A sessão é capturada antes da abertura e conferida após as leituras assíncronas, incluindo mudanças apenas nos dados da conta. O limite de 20 segundos, cancelamento explícito, fecho da janela e expiração interrompem o pedido. Uma mudança de sessão ou saída da página fecha os documentos abertos e revoga os seus URLs temporários. O token só segue no cabeçalho de autorização; respostas redirecionadas são recusadas. Anexos HTML/SVG e outros tipos não seguros para apresentação continuam descarregáveis como bytes inertes, com o nome original.

Não se alteram registos, permissões da API, valores, faturas externas, comprovativos, stock ou documentos anexados. Sem migrações ou dependências. Cache do shell v151.

## Inventário finito e impressão

O [inventário de páginas](PAGE_INVENTORY_20260924.md) e o [JSON verificável](PAGE_INVENTORY_20260924.json) abrangem 115 HTML: 108 entradas de raiz e sete auxiliares/protótipos/testes. Incluem ficheiro, rota, título, papéis do catálogo, indícios de guarda, recursos locais, scripts de idioma, ação direta de impressão e nomes dos ensaios que referenciam a página.

O auditor reconhece também referências terminadas em `.html`. Distingue ficheiros inexistentes de recursos presentes no índice Git mas não materializados na cópia de trabalho: nenhum recurso realmente ausente, duas imagens apenas não materializadas e nenhuma divergência entre o catálogo e as guardas explícitas. Encontrou referências literais para 76 páginas em 257 scripts ativos; as restantes 39 constituem uma fila finita de pesquisa de evidência, não uma declaração de ausência de testes.

| Superfície | Origem | Acesso e idiomas | Situação |
| --- | --- | --- | --- |
| `/api/reports/monthly-print` | `monthlyPrintableReportService.js` e fontes financeiras comuns | ADMIN; PT/EN/FR/ES | HTML imprimível revisto nas TASK anteriores; não é outro gerador PDF |
| `/api/reports/visit/:id` | `visitReportService.js`, REGULAR/EXTRA e versões/origens explícitas | Projeção por papel e titularidade; PT/EN/FR/ES | HTML imprimível; inspeção histórica ADMIN e confirmação histórica separadas |
| `/invoice-document?id=…` | `invoice-document.html` e leitor autenticado | Entrada pública; PDF apenas ADMIN/CLIENT titular | Página de abertura, sem dados financeiros nem outro modelo de impressão |
| PDFs gerados | Oito famílias e dez rotas no [inventário PDF](PDF_INVENTORY_20260924.md) | Conforme cada família | Modelos PT e visita multilingue; a língua da interface não traduz todos os PDFs |

Referências estáticas, indícios de idioma e recursos existentes não equivalem à revisão visual/funcional universal. A fila por página mantém os critérios de dados, carregamento, vazio, falha/repetição, perfil, teclado, larguras 320/390/1440 e idiomas. Esta tarefa fecha o inventário atual, sem declarar toda a aplicação concluída.

## Validação

- 595 testes unitários em 81 ficheiros, quatro técnicos e sintaxe 626 backend / 220 frontend / 62 scripts inline.
- Seis grupos distintos de API/Chromium após integrar a TASK338: abertura autenticada, PDF financeiro, acesso financeiro, anexos do chat, PDF de guias e recuperação operacional de documentos.
- O novo ensaio confirma seis rotas PDF reais e duas guias históricas sem viatura. Recusa identidade/MIME trocados, HTML, PDF truncado, cabeçalhos ausentes, HTTP parcial/redirecionado/erro, conta alterada durante a resposta/corpo, expiração, aliases contraditórios, popup bloqueado, offline, timeout, cancelamento e URL não canónico.
- Confere revogação depois de mostrar o ficheiro, anexo HTML descarregado sem execução, cliente titular e igualdade dos originais/contagens financeiras, guias, chat, stock e recibos.
- As regressões mantêm acesso por perfil/viatura, anexos antigos, intervalos HEAD/range privados, documentos de campo offline, recuperação, quota, cache corrompida e respostas tardias.

Os mocks antigos passaram a representar respostas com cabeçalhos, Blob e eventos de navegador reais, mantendo as verificações de sessão e de autorização; o teste estático foi adaptado à expressão atual do cabeçalho, que também é verificada funcionalmente. O primeiro ensaio novo corrigiu apenas a ligação de `setTimeout` na fixture e a troca completa dos aliases da conta antes do caso CLIENT. Nenhuma verificação foi retirada para aprovar a aplicação.

Ambiente isolado: PGlite, Chromium normal e 40 migrações aditivas; sem contactos reais. O cenário de duas ligações concorrentes na geração mensal continua a depender do PostgreSQL nativo. Runner com 236 grupos. A aprovação completa/restauro do novo código depende do CI.

## Publicação e continuação

Base inicial `08dfea0711b6236f2896317e4eeebac52fc10f86`; integrada a publicação TASK338 `31e18feec8ed4e87f9d6c80b47f217870ef5fe1a` antes do ensaio final. Publicação na branch `work/field-readiness-20260915-simulation`. Publicada em `e20b0d47f42b2eee0a6862cb97e58f553c33b1bc`, árvore `e5f44c27429fbeefb14581d96f6b6db6e69fe210`, idêntica à validada localmente. [CI 36054372854](https://github.com/ts7520305-svg/cristalwater/actions/runs/36054372854) em execução; os 236 grupos e o restauro nativo continuam por confirmar.

Retomar os CI pendentes e a fila finita do inventário, preservando as provas existentes. Os critérios de capacidade em produção, VPS/fornecedores, piloto físico e IA avançada continuam separados. Sem merge, deploy ou envio real a terceiros.
