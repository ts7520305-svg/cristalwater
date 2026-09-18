# TASK262 — Fontes incorporadas nos relatórios individuais

## Alteração

O PDF individual REGULAR/EXTRA usava Helvetica com codificação limitada. Passa a incorporar subconjuntos DejaVu Sans normal e negrito, preservando texto pesquisável e extraível, títulos e medições de paginação. Reutiliza a fonte normal e a licença existentes no repositório e acrescenta a variante negrito da mesma família. A geração deixa de depender das fontes instaladas no leitor do documento.

visitReportPdfFonts.js regista as duas fontes locais e prepara apenas o conteúdo já autorizado pelas opções do relatório. A normalização NFC e a conversão de quebras de linha/tabulações ocorrem só no PDF; não alteram notas, nomes ou HTML guardados. Cada carácter é verificado nas duas variantes antes de medir e escrever o texto.

O percurso suporta caracteres das escritas latina, grega e cirílica, sinais comuns e marcas combinantes cobertos por ambas as fontes. Caracteres em falta, controlos/direcionamento invisíveis e outras escritas aparecem como [U+XXXX], com uma secção explicativa para consultar o registo original. Não se promete Unicode universal nem composição bidirecional/árabe/hebraica. O HTML mantém o texto original. Nenhuma transliteração silenciosa ou remoção do original é feita.

A verificação de caracteres ocorre depois da seleção dos campos visíveis. Uma nota interna oculta não acrescenta marcadores ou avisos à versão cliente. Mantêm-se identidade REGULAR/EXTRA, autenticação, cliente histórico, opções, fotografias e cabeçalhos privados. Sem alteração de rotas, cache (v82), esquema ou dependências npm.

## Testes e prova visual

Os quatro testes de percurso passam a partilhar scripts/lib/reportPdfText.js. O leitor interpreta ToUnicode por fonte e apenas os streams de texto das páginas; não procura texto nos ficheiros de fontes/imagens. Conserva a leitura por comprimento binário e a regressão do byte CR final. O primeiro ensaio em run-1789736084827 encontrou uma limitação do leitor novo: não contava entradas vazias/multicaractere no CMap. Corrigido o leitor, sem retirar asserções do conteúdo.

Regressões do relatório regular, fotografias, EXTRA e alertas passaram em run-1789736139249. Testam nomes Łukasz, Žofie, İpek, François, Björn, Straße, grego e cirílico, variantes normal/negrito, acento decomposto convertido para NFC, marcador explícito para caracteres não suportados, origem intacta, notas longas até ao fim e rodapé em todas as páginas. A versão EXTRA com nome Unicode passou em run-1789736203754. Confirmação final regular e privacidade do aviso (apenas nota interna contém carácter não suportado): run-1789736302164.

Poppler do sistema e pdfplumber confirmaram independentemente extração de texto, ausência de glifos NUL, rodapés e limites das imagens. Revistas 25 páginas: regular cliente/ADMIN com quatro/cinco páginas, EXTRA duas/três e fotografias cinco/seis. Evidência: reports/field-visual/visit-report-1789736144117, extra-report-1789736150723 e visit-photos-1789736147776. As páginas alteradas das fixtures finais foram novamente renderizadas/revistas em visit-report-1789736307225 e extra-report-1789736210315, incluindo nome de químico a negrito. Dados sintéticos, sem clientes reais.

396 testes unitários/63 ficheiros e quatro técnicos aprovados. Sintaxe 555 backend/182 frontend/56 inline; 151 grupos operacionais e 21 migrações aditivas mantidos. CI nativo/restauro pendentes da publicação.

## Fonte e limites

DejaVuSans-Bold.ttf: 708920 bytes, SHA-256 5c1247acef7f2b8522a31742c76d6adcb5569bacc0be7ceaa4dc39dd252ce895. Cópia integral da fonte disponibilizada pelo sistema, abrangida pela licença DejaVu/Bitstream existente em src/assets/fonts/DejaVu-LICENSE.txt. Fonte normal existente: SHA-256 ae7b7855e115a5966d8b1b3f80f254ccc117ec86f9965e202ee2940453837280. Sem conversão para curvas nem perda da camada de texto.

Esta tarefa trata apenas a apresentação textual dos PDFs individuais. Tradução dos rótulos/mensagens e seleção explícita de idioma ainda são a próxima tarefa; os documentos continuam em português. Outros PDFs e referências fotográficas históricas não canónicas permanecem fora deste lote. Não confundir incorporação de fontes com tradução automática dos textos introduzidos pelo técnico.

Dez ficheiros: dois serviços, fonte negrito, leitor de teste, quatro percursos e dois documentos. Publicação autorizada apenas na branch de trabalho, sem merge ou deploy. Frequência individual por cliente/época/instalação preservada, três ou mais conforme cada caso.
