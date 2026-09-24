# TASK336 — Confirmação dos dados históricos de relatórios individuais

## Publicação

Publicada em `55544f548bc073aadac574770786920f0d0ba68b`, árvore `cd534409b7c9d6afae8bb06b6e5503d47684c52c`, idêntica à validada. [CI 36048931532](https://github.com/ts7520305-svg/cristalwater/actions/runs/36048931532), job `107799314394`, em execução; aprovação completa e restauro por confirmar. [Evidência local](evidence/20260924_task336_local.json).

## Âmbito

A consulta administrativa da TASK334 permite inspecionar uma visita com cliente divergente, mas não confirma os dados para partilha. Este lote acrescenta uma revisão explícita REGULAR/EXTRA para a visita concluída que conserva um cliente e uma instalação identificados no registo original.

A administração confirma o cliente já inscrito na visita e indica nome histórico da instalação, zona/morada opcionais, evidência consultada e motivo. Não existe seleção de outro cliente. A confirmação não atualiza a visita, consumos, pagamentos, custos ou documentos financeiros. Uma visita sem cliente identificado ou sem conclusão válida continua por rever.

## Comportamento

- **Confirmar dados históricos**, nas configurações de relatórios, abre a visita pelo tipo e ID. A página distingue os dados atuais da instalação dos dados históricos propostos e apresenta os comprovativos conservados.
- A proposta liga o registo técnico completo, cliente original, contexto atual da instalação e revisão anterior. A confirmação exige motivo, evidência e ação explícita; uma alteração entretanto ocorrida produz uma recusa recuperável.
- Confirmar, substituir e anular geram comprovativos imutáveis, com UUID e autor ADMIN. A visita, comprovativo, histórico técnico mínimo e auditoria ficam protegidos por transação e bloqueios. O histórico técnico partilhado não contém a evidência privada nem as notas originais.
- O relatório confirmado continua sujeito ao cliente original, atribuição técnica, opções de visibilidade e idioma preferido atuais desse cliente. Usa os dados históricos confirmados e o nome do cliente conservado na revisão. Nenhum dado atual de nome/morada/zona/equipamento/casa técnica da instalação substitui esses dados.
- PDF e HTML apresentam a revisão e a sua data em PT/EN/FR/ES. Evidência e motivo aparecem apenas na versão completa ADMIN. Fotografias e observações mantêm a origem tipada da visita, com as verificações existentes de ficheiro, conteúdo e acesso.
- A consulta administrativa `history=review` permanece um percurso separado. Uma revisão confirmada usa `X-CW-Report-Origin: historical-confirmed` e `X-CW-History-Version`; o navegador verifica ambos antes de abrir o PDF. O idioma e a versão das configurações são consultados no cliente original.
- Alterações técnicas ou comprovativos inconsistentes bloqueiam o relatório confirmado. Mudanças exclusivamente financeiras não invalidam o registo técnico. A prova inclui todas as referências de fotografias, mesmo depois das 24 apresentadas no documento.
- A anulação conserva o histórico. A abertura volta a obedecer às regras normais, incluindo o bloqueio quando visita e instalação mantêm clientes divergentes.

## Recuperação e validação

Rascunho por conta/tipo/visita; pedido persistido antes do envio, conferido antes de reenviar, mesmo UUID após perda de resposta ou modo offline, recuperação só pela conta original. Mudança de conta limpa a apresentação. Falha de armazenamento conserva os dados e impede um novo envio.

Base integrada: TASK334 `93fb9aa452017b0391b4116c204c58256711ba1f` e TASK335 de PDFs de guias `4325bf01e173b3f94df42f2281aebf3de5f7f0c5`, com fecho documental `93695172b5611154046423ef75bc5261fd9e79c1`. Sem novas dependências, tabelas ou migrações; cache v149; runner com 233 grupos distintos.

- 587 unitários/80 ficheiros, quatro técnicos e sintaxe de 624 ficheiros backend, 220 frontend e 62 scripts inline aprovados.
- QA isolada com 40 migrações aditivas: API de dois processos, mesmo ID REGULAR/EXTRA, acesso do cliente original e recusa dos restantes, prova exata/repetição/corrida entre revisões, alteração técnica, corrupção de comprovativo, anulação e rollback de comprovativo/histórico/auditoria.
- PDF/HTML nos quatro idiomas, opções do cliente, notas privadas, fotos tipadas, alteração depois do limite de 24 fotos e invariância de visitas/stock/finanças. Os nomes/moradas/equipamento/casa técnica do novo titular ficam ausentes das duas representações.
- Chromium real: entrada pelas configurações, rascunho/recarregamento, proposta e resposta adulteradas, perda da resposta depois da gravação, duplo clique, offline, pedido local alterado, quota, idioma preferido, comprovativo do PDF errado, anulação e isolamento de conta. Larguras 320/390/1440 e modo escuro; duas páginas do PDF francês de cliente inspecionadas visualmente.
- Regressões aprovadas: `test-field-report-history-review.js`, `test-field-visit-report.js`, `test-field-extra-report.js`, `test-field-visit-report-photos.js`, `test-field-report-opening-ui.js` `test-field-client-services-ui.js` e `test-field-guide-pdf.js`.

Na preparação do novo ensaio corrigiram-se o nome do router da fixture, a localização da preferência de idioma e a ordem de remoção dos dados com chaves estrangeiras. Estas correções pertencem ao teste; não relaxam nenhuma validação da aplicação.

## Falhas iniciais do CI do editor

Os CI da TASK332 (`36042944183`) e TASK333 (`36043258018`) executaram os 230 grupos previstos: 229 passaram e apenas `test-field-client-services-ui.js` falhou. A asserção dos nomes completos também recolhia a nova descrição da mensalidade. A correção publicada na TASK335 usa `.serviceRule .serviceSelection`, mantendo exatamente os nomes esperados e todas as restantes verificações. O grupo completo voltou a passar localmente, incluindo cadências, exceções, geração e recuperação.

O teste de tempos históricos passou nos dois CI. O restauro foi ignorado devido à falha do editor; nenhum destes dois commits recebe aprovação de CI completo. Evidências iniciais [TASK332](evidence/20260924_task332_initial_failure.json) e [TASK333](evidence/20260924_task333_initial_failure.json). Nesta revisão foram igualmente conferidos os 230 resultados distintos, hashes dos logs completos, commits/árvores/parentes e estado das etapas.

Confirmar um novo CI completo e restauro PostgreSQL 16 do código publicado. A revisão não atribui um cliente ausente, não resolve comprovativos corrompidos por substituição silenciosa e não corrige faturação histórica. Restantes PDFs/páginas, critérios de volume e validação de produção continuam abertos. Sem merge, deploy ou contactos reais.
