# TASK250–251 — abertura autenticada e relatório individual

## Estado

Implementado e aprovado localmente; confirmação nativa da correção para ecrãs estreitos pendente. Publicação anterior: `1d858eeb8cd6ef23d89749368655535cfbd79c61`, árvore `e61fce900a08d6bc58ba0d9879e2e3517a11318a`, CI `35309723057`, job `105489052421`. Base do lote: `b86cd7549a0c1f94c374a76bea07a01964d12191`. Cache v75, sem migração nova. TASK250 trata a abertura nas páginas de configurações e centro de relatórios; TASK251 trata o acesso, as opções e a apresentação do relatório individual PDF/HTML.

## Abertura no navegador

- As páginas `/report-settings` e `/report-center` usam `cw-report-download.js`. A janela é reservada durante o clique, antes da rede; uma janela bloqueada apresenta instruções e permite nova tentativa explícita. Credenciais seguem apenas em Authorization para a origem da aplicação, nunca no URL. O helper anterior de guias/faturas/anexos permanece independente.
- Só HTTP 200, tipo PDF/HTML correto, corpo não vazio com assinatura/marcador final esperados e cabeçalhos com a identidade esperada permitem abrir. Visita, cliente, apresentação e versão das configurações têm confirmação explícita; no mensal, mês e filtro têm confirmação explícita. Respostas parciais/202, redirecionamentos, tipos/identidades trocados, PDFs truncados e HTML incompleto são recusados.
- A operação fica ligada ao token, aliases de conta, prazo de sessão e seleção. Mudanças de conta, cliente, visita, opções, mês/filtro, nova leitura das configurações, pagehide/BFCache e janela fechada invalidam a operação. Respostas tardias, incluindo depois da leitura do corpo, não abrem o documento. Uma geração de leitura distingue regressos rápidos à mesma seleção.
- Prazo de 20 segundos e cancelamento por AbortController. URLs temporários são revogados ao invalidar a operação, ao fechar a janela ou após 60 segundos. Não há reabertura automática com o regresso da rede. Sessão expirada segue o logout comum, fecha a janela e conserva o trabalho local.
- A pré-visualização exige um cliente confirmado, a configuração atual carregada e ausência de alterações/pedidos por confirmar. Rascunhos não são confundidos com opções guardadas. Um cliente arquivado permanece consultável depois de uma leitura confirmada; a edição/gravação continua bloqueada. O servidor confirma que a visita pertence ao cliente e que a versão ainda corresponde à leitura.

## Conteúdo e acesso

`visitReportService.js` fornece uma projeção comum ao PDF `/api/report-visit/visit/:id` e ao HTML `/api/reports/visit/:id`. ADMIN pode selecionar `view=admin` ou `view=client`; `role=CLIENT|ADMIN` continua como alias antigo de apresentação. Nenhum parâmetro concede autoridade. CLIENT consulta apenas o próprio cliente; TECHNICIAN/TEAM_LEADER apenas a visita atribuída. Perfis fora destes quatro, IDs não canónicos e parâmetros desconhecidos/duplicados/objetos são recusados.

A leitura usa RepeatableRead, inclui as configurações da mesma ficha e não grava registos. É obrigatório o cliente histórico associado diretamente à visita. O proprietário atual da instalação não substitui esse vínculo; a falta de cliente ou clientes contraditórios exigem revisão, sem produzir um documento ambíguo. CLIENT recebe recusa se não é o titular histórico. As respostas usam `private, no-store` e `nosniff`; falhas de geração produzem JSON de erro antes de enviar qualquer PDF parcial.

As 15 opções regem ambas as representações para o cliente, incluindo o estado anteriormente repetido na barra de resumo. Notas internas pertencem exclusivamente à apresentação ADMIN. Texto guardado, incluindo nomes e referências de fotos com HTML, é literal; o HTML não interpola código ou imagens externas dos campos.

O PDF mede linhas e permite a continuação de valores/notas extensas entre páginas, com cabeçalho e rodapé numerado. Corrigidas páginas extra do rodapé. Inclui os valores registados de sal, temperatura e ORP, a unidade guardada dos químicos e o campo real `brokenLightsCount`. Equipamento/casa técnica são explicitamente o registo atual, não um inventário histórico da data da visita. Datas indicam hora de Portugal.

## Evidência local

- Reprodução inicial `run-1789706437115`: o teste falhou na versão anterior porque a pré-visualização CLIENT continha `INTERNAL_SECRET`.
- API/PDF/HTML e regressões das configurações e imprimível aprovadas em `run-1789706741659` (1013/22044/1253 ms). A revisão visual posterior detetou páginas adicionais de rodapé, corrigidas antes da validação final.
- `run-1789707212597`: API/15 opções (1112/1010/983 ms em três execuções para investigar uma asserção de extração de texto), abertura real (7191 ms), configurações recuperáveis (21872 ms) e acesso mensal (1271 ms), todos aprovados. A falha intermitente do extrator do ensaio foi posteriormente reproduzida com um stream comprimido cujo último byte era CR: a expressão regular confundia-o com uma quebra de linha e descartava o stream. O extrator passou a respeitar o comprimento declarado e tem uma reprodução determinística dessa fronteira binária; a inspeção visual usa o Poppler do sistema.
- O ensaio de 401 conserva o logout comum real. A atualização de configurações externas conserva o conflito do rascunho e exige descarte/revisão explícitos; os testes não tratam estes comportamentos esperados como falhas da aplicação.
- Ensaio final de abertura `run-1789707387022`: 8609 ms, incluindo expiração do token com a janela aberta e desativação dos controlos.
- 388 testes unitários/62 ficheiros aprovados. Sintaxe: 547 backend JS, 181 frontend JS e 56 scripts inline. Runner: 144 grupos de integração e 21 scripts no gate de navegador.
- PDF de cliente e administrador de `visit-report-1789707216890`: quatro páginas cada, oito páginas renderizadas e revistas. Margens verificadas com pdfplumber, início/fim da nota extensa uma única vez, notas internas apenas em ADMIN, sem páginas adicionais criadas pelos rodapés.
- Inventário: 101 HTML, 94 entradas de raiz/sete auxiliares, 59 páginas com referências literais em 165 scripts ativos, zero recursos locais em falta e zero divergências catálogo/guarda. Referência literal não comprova cobertura universal.

## Revisão final de titularidade

A primeira publicação `721ff7adb5ac79c9efbb01fa2abbb17e615c05d2` iniciou o CI `35309036752`. A revisão cruzada com o contrato de histórico identificou o fallback ao proprietário atual da piscina como insuficiente para provar titularidade de uma visita antiga. A correção seguinte exige o cliente direto da visita e acrescenta ensaios PDF/HTML de recusa para ausência/conflito. Publicada em `c9e190d8a19361ecadd955f50b25e09991533c16`, árvore `efe23cc0823500b36978891e2193b16f86bfdd7e`, CI `35309433429`. O primeiro CI não valida essa correção posterior. `run-1789707813021` aprovou a versão corrigida: API/PDF/HTML 1078 ms, abertura 8281 ms e proteção mensal 1287 ms, incluindo a reprodução do extrator.

A revisão final da interface separa consulta de edição para clientes arquivados: a marca `editable:false` já desativa a gravação, mas não deve invalidar uma leitura bem-sucedida nem bloquear a consulta do PDF histórico. Regressão de navegador acrescentada; cache v74. Abertura e regressão das configurações aprovadas em `run-1789708090045` (8420/21885 ms). A reprodução anterior `run-1789708003696` encontrou ainda o primeiro clique após nova leitura consumido apenas pelo cancelamento da janela antiga: o helper passa a encerrar o contexto anterior e a atender o novo clique na mesma sessão. Esta correção posterior exige confirmação da sua própria árvore.

## Limites e próximo percurso

O primeiro CI (`35309036752`) terminou com falha no ensaio de largura do centro de relatórios, após a abertura real do documento. O botão passa a permitir quebra de linha e os controlos/cartão deixam de impor largura mínima; o teste regista agora as medidas, fonte e overflow de cada elemento em caso de falha. Esta correção passou localmente em `run-1789708615654` (8401 ms), nas larguras 320/390/1440. Só o CI da árvore que inclui esta correção pode fechar o lote; o restauro do primeiro CI foi omitido devido à falha anterior.

O imprimível mensal continua a usar os cálculos antigos (`Invoice.total`, `amountPaid`, `amountOpen` e lista de faturas), ainda sem o contrato financeiro revisto da API mensal. A autenticação da abertura não valida essas contas nem transforma número de faturas em número de clientes. Esse é o próximo trabalho.

As fotografias no relatório individual são referências textuais, explicitamente identificadas. A incorporação das imagens autorizadas, relatórios EXTRA, caracteres fora das fontes latinas e tradução integral continuam por rever. O link direto de relatório nos alertas (`admin-alerts.js` / `alertPresentationService.js`) ainda precisa de um percurso autenticado próprio; esta tarefa fecha os dois pontos de entrada acima. Sem merge em main, deploy, fornecedores, envios reais ou emissão fiscal.

### Pontos concretos da revisão mensal seguinte

| Tema | Código atual e critério de revisão |
|---|---|
| Universo de documentos | `reportController.js` usa só `monthRef`; `adminMonthlySummaryService.js` usa `documentMonthWhere` para os formatos históricos. |
| Total e saldo | Imprimível soma aliases diretamente; a API mensal distingue aliases positivos contraditórios, valores por rever, documentos excluídos e saldo atual. |
| Recebimentos | O imprimível lista pagamentos de cada fatura sem separar o mês do pagamento ou crédito interno; `cashReceiptReportService.js` usa `paidAt` UTC e exclui métodos internos. Não confundir crédito aplicado com dinheiro recebido. |
| Contagem | A caixa «Clientes» usa `invoices.length`. Contar clientes distintos e documentos separadamente. |
| Filtro e referência temporal | Manter explícito se o filtro se aplica a documentos/clientes/recebimentos, usar uma leitura consistente e indicar valores atuais, sem afirmar fecho histórico. |
| Acesso pelos alertas | `admin-alerts.js` e `alertPresentationService.js` produzem link direto `/api/reports/visit/:id`. O endpoint já tem projeção segura, mas a navegação ainda não envia Authorization. |
