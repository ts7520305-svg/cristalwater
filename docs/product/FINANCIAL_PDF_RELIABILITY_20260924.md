# TASK338 — Identidade e abertura dos PDFs financeiros

## Resultado

A abertura autenticada de conta corrente e extras confere agora o tipo de documento, os IDs de cliente/documento, o MIME PDF e os marcadores de início/fim antes de criar a janela com o conteúdo. Confere novamente a sessão após as leituras assíncronas, recusa redirecionamentos e limita a espera a 20 segundos. Respostas de outro cliente/documento, HTML, ficheiros incompletos e respostas após mudança de conta são recusados; uma falha de rede permite nova tentativa. A ligação partilhada continua a regressar ao documento após login.

Os endpoints validam IDs numéricos canónicos e recusam opções de consulta inesperadas. A autorização permanece ADMIN/CLIENT exato, incluindo o bloqueio dos estados não partilháveis. Um extra sem cliente original registado é recusado, em vez de atribuído ao titular atual da piscina. As linhas da conta corrente têm ordem estável por ID.

O PDF fica completo antes de receber os cabeçalhos de identidade `X-CW-Document-Type`, `X-CW-Client-Id` e, na conta corrente, `X-CW-Invoice-Id`. Usam-se `private, no-store`, `nosniff` e `Content-Language: pt`. Uma falha do gerador produz JSON sanitizado com HTTP 503, sem cabeçalhos de sucesso ou PDF parcial.

A integração conserva o gerador partilhado e todos os modelos da TASK337: documento interno não fiscal, nome `documento-interno-ID.pdf`, referências, Unicode, paginação, valores guardados e PDFs de orçamento/mensais. Não cria um segundo gerador. Os percursos das guias e dos anexos de conversa continuam verificados.

## Dados de ensaio e erros da prévia

A TASK337 passou a criar o cenário de histórico divergente como `NO_CHARGE`, sem cobrança. Este complemento conserva essa classificação e elimina apenas os registos e fotografias criados pelo ensaio depois de verificar todos os invariantes. A sequência de inspeção histórica e execução de extras continua a conferir o cenário completo.

A prévia global de extras passa a devolver o estado HTTP apropriado quando a origem é contraditória, em vez de HTTP 200 com corpo de erro. O novo teste verifica HTTP 409 e cache privada. As falhas nativas iniciais continuam registadas nas evidências [TASK334](evidence/20260924_task334_initial_failure.json) e [TASK335](evidence/20260924_task335_initial_failure.json); os respetivos restauros foram omitidos.

## Validação

A primeira versão deste complemento foi ensaiada sobre `c807600878f5a87dc5f0e4a366a4bb67dece7765`: 590 unitários, quatro técnicos e sete grupos de API/navegador. Antes da publicação entrou a TASK337 `dea120f545d638bd83597bdb5815b41900163029`, seguida do fecho `08dfea0711b6236f2896317e4eeebac52fc10f86`. Os commits remotos foram importados integralmente e a alteração foi adaptada ao gerador/modelos publicados. Os testes unitários equivalentes ficaram nos ficheiros existentes, sem duplicar o gerador nem os ensaios.

A versão integrada tem 592 testes unitários em 81 ficheiros, quatro testes técnicos e sintaxe de 626 ficheiros backend, 220 frontend e 62 scripts inline. O runner passa de 234 para 235 grupos distintos. O novo grupo abrange:

- Unicode latino/grego/cirílico, glifos ausentes, texto HTML literal, texto longo completo, cabeçalhos e páginas, montantes guardados, soma em cêntimos, preço efetivo e datas em Portugal; fontes conservadas.
- ADMIN/cliente exato e recusas para terceiros/técnicos/sem sessão, documentos retirados, cliente histórico ausente/divergente, IDs/opções inválidos e falha injetada do gerador antes da resposta.
- Navegador em 320/390/1440 px, identidade/tipo/cliente falsificados, HTML, PDF truncado, offline, tempo limite, sessão alterada nos cabeçalhos/corpo e login real de retorno.

A sequência integrada passou integralmente os oito grupos: documentos financeiros/mensais/orçamentos, novas verificações de PDFs, acesso a PDFs de faturação, abertura da fatura, recuperação de documentos, guias, inspeção histórica e execução de extras. Evidência e resultados finais em [20260924_task338_local.json](evidence/20260924_task338_local.json).

Foram revistas visualmente as duas primeiras páginas da conta corrente (seis páginas no total) e a página de extras. Cabeçalhos, referências, caracteres, valores e rodapés legíveis, sem cortes nem sobreposições; não constitui revisão visual de toda a aplicação.

Ambiente local isolado, PGlite com protocolo PostgreSQL, 40 migrações aditivas e Chromium multiprocesso; fornecedores e tarefas de fundo desligados. A opção temporária antiga `--single-process` foi retirada do executor local depois de uma falha de segundo contexto, sem enfraquecer as asserções da aplicação.

## Limites e retoma

Base integrada `08dfea0711b6236f2896317e4eeebac52fc10f86`. Sem novas migrações ou dependências; cache v150. Mantêm-se a apresentação portuguesa e a natureza não fiscal. O controlador antigo de recibos continua sem rota montada. O [inventário de PDFs](PDF_INVENTORY_20260924.md) conserva as pendências de idiomas, HTML/impressão, histórico e volume.

A publicação é apenas no ramo `work/field-readiness-20260915-simulation`. A aprovação integral dos 235 grupos e o restauro PostgreSQL 16 dependem do CI deste código. Sem merge, deploy ou contactos reais.

## Publicação

Publicada em `2f808da1dc86b2f03ba432e1357f3c52a672bc5e`, árvore `caaa43f40687bd3856bc1c2b46d8a192292961da`, idêntica à validada localmente. [CI 36053066253](https://github.com/ts7520305-svg/cristalwater/actions/runs/36053066253), job `107813196189`, em execução; os 235 grupos e o restauro PostgreSQL nativo ainda não estão aprovados. Branch principal conservada em `6f27081e1d183ff584a62255b016b373836734db`.

O CI da TASK336 foi entretanto conferido integralmente: 232 dos 233 grupos aprovados, com a mesma falha da visita de ensaio deixada na base para extras e restauro omitido. A confirmação histórica passou no CI. [Evidência inicial](evidence/20260924_task336_initial_failure.json). As correções estão integradas nas TASK337/338; o novo CI conserva a sua própria validação.
