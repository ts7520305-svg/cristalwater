# TASK259 — Fotografias autorizadas no relatório individual

## Resultado

O PDF e o HTML imprimível passam a incorporar as fotografias da visita regular em vez de publicar referências textuais aos ficheiros. A projeção comum respeita `showPhotos` na apresentação do cliente, incluindo a pré-visualização ADMIN; a apresentação administrativa conserva todas as fotografias verificáveis. Mantêm-se a autenticação, titularidade histórica direta, atribuição ao técnico, versão de configurações e cabeçalhos privados já existentes. A renderização PDF passa do controller para o serviço de relatório; o controller delega leitura e geração.

A preparação ocorre depois da autorização e da leitura consistente, fora da transação de base de dados. Só aceita registos da visita pedida e nomes canónicos `visit-{id}-{categoria}-{sha256}` emitidos pelos percursos atuais de envio. Confirma categoria, tipo de visita e hash do conteúdo. A leitura limita-se à raiz de uploads configurada e a ficheiros regulares; recusa ligações simbólicas, caminhos atravessados/codificados, URLs externos, referências EXTRA, ficheiros de outra visita, alteração de bytes e ficheiros em falta. Não faz pedidos HTTP. URLs e nomes de armazenamento não são publicados no relatório.

As imagens são descodificadas com `sharp` antes de chegar ao PDFKit, com orientação EXIF aplicada, metadados retirados, transparência sobre fundo branco e tamanho máximo de 1600 por 1600 píxeis, conservando a proporção. JPEG, PNG, WebP, GIF e AVIF foram exercitados; animações apresentam o primeiro fotograma, identificado na legenda. A saída JPEG normalizada é incorporada no PDF e em data URLs no HTML, dispensando pedidos de imagem ou credenciais adicionais. Os originais permanecem intactos.

A secção de fotografias permanece com a primeira imagem. Legendas e imagens são mantidas juntas, com margens e rodapés numerados; as imagens não são cortadas. Fotografias que não possam ser verificadas ou descodificadas apresentam mensagem de indisponibilidade, sem impedir as restantes secções.

## Limites explícitos

- Até 24 registos fotográficos, por ordem de identificador. O total excedente aparece no documento e remete para o registo da visita.
- Até 25 MiB por ficheiro, 64 MiB de entradas lidas por relatório e 48 milhões de píxeis por imagem. Há orçamento de 10 segundos para iniciar novas conversões e prazo de 3 segundos por operação sharp; imagens não processadas por limite ficam identificadas.
- HEIC/HEIF depende dos codecs do ambiente; não se promete suporte universal. O pacote nativo usado no ensaio confirma AVIF. Formatos não suportados, referências antigas sem identidade/hash canónicos e dados incoerentes exigem revisão e ficam indisponíveis.
- Esta tarefa trata a incorporação autorizada no relatório. Não altera as rotas legadas de acesso direto aos uploads, nem migra fotografias antigas. Relatórios EXTRA, Unicode fora das fontes latinas e tradução integral permanecem pendentes.

## Verificação

Novo grupo `test-field-visit-report-photos.js`: envio pelo endpoint real, seis imagens em cinco formatos, orientação de retrato, remoção de EXIF/ICC/XMP, primeiro fotograma de GIF animado, extensão legada em maiúsculas, autorização de cliente/técnico, pré-visualização e apresentação ADMIN, opção desligada, visita sem fotografias e leitura sem escrita. Recusa referências estrangeiras/EXTRA/externas, traversal, symlink, hash divergente, ficheiro ausente, SVG disfarçado, PNG truncado, imagem de 49 milhões de píxeis e ficheiro acima de 25 MiB. Servidor de captura confirma zero pedidos externos; asserções verificam hashes dos originais. O symlink sintético é removido no fim do ensaio para manter válido o teste de restauro.

Navegador Chromium 149: seis imagens efetivamente descodificadas, zero pedidos secundários e sem overflow a 320/390/1440 px. PDFs com cinco páginas de cliente e seis ADMIN renderizados e revistos com Poppler do sistema; cabeçalhos, rodapés, proporções e limites das imagens confirmados com pdfplumber. Ajustado o título inicialmente separado da primeira imagem. A prova visual usa imagens sintéticas, sem dados de clientes reais.

Ensaios locais: primeiro percurso aprovado em `run-1789729457088`; regressões do relatório individual, abertura das configurações/centro mensal e abertura pelos alertas aprovadas em `run-1789729652071`. Cobertura com GIF animado e limite de píxeis aprovada em `run-1789729741398`, limpeza do symlink confirmada em `run-1789729888038`; duas execuções intermédias identificaram apenas problemas na preparação do ensaio (fotogramas iguais otimizados para um e symlink residual), corrigidos sem retirar asserções. Último ensaio da árvore a publicar, incluindo extensão em maiúsculas e limpeza: `run-1789729966664`, aprovado. Evidência visual: `reports/field-visual/visit-photos-1789729748223`.

395 testes unitários/63 ficheiros, quatro técnicos e sintaxe 553 backend/182 frontend/56 inline aprovados. Runner passa a 150 grupos. Sem migração ou alteração de cache de frontend. Dependência `sharp` 0.35.4 e respetivo lockfile, incluindo semver exigido pela dependência, confirmados com `npm ci`; requer Node >=20.9, e o CI usa Node 24. A aprovação final exige a mesma árvore publicada no CI nativo e restauro PostgreSQL 16.

Publicação apenas na branch de trabalho, com autorização existente; sem merge, deploy, envios reais ou emissão fiscal.

Referências da dependência: [construtor e limites de descodificação](https://sharp.pixelplumbing.com/api-constructor/), [normalização e metadados de saída](https://sharp.pixelplumbing.com/api-output/).
