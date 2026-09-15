# TASK176 — Anexos privados do chat

## Problema confirmado

`field-qa-runtime/run-1789509559866` criou um anexo QA e confirmou leitura anónima com 200 através da ligação antiga de uploads. A proteção REST/Socket.IO das mensagens não protegia o ficheiro servido por `express.static`.

## Correção

- Novos uploads usam nomes UUID em `documents/client-chat`, fora da área pública, incluindo antes de existir registo na base de dados. Recusas e erros anteriores à gravação da mensagem removem apenas o novo ficheiro. Um erro posterior não elimina um ficheiro já associado à mensagem.
- `GET /api/client-messages/attachments/:messageId` exige sessão ativa ADMIN ou CLIENT titular. Valida ID, caminho real dentro da pasta de uploads e referências ao ficheiro. Conflitos em que o mesmo ficheiro antigo pertence a clientes diferentes não autorizam qualquer desses clientes; ficam acessíveis à administração para revisão.
- Uma guarda anterior aos uploads públicos protege referências antigas em `fileUrl`, `message` ou `text`, sem mover/apagar o histórico. Normaliza o caminho, verifica o destino real e exige o titular também em HEAD/Range/URLs codificadas. Documentos privados nunca passam para `express.static`, incluindo caminhos codificados, symlinks e ficheiros ainda sem referência.
- Uploads sem ligação a conversas conservam o percurso anterior; o ensaio verifica uma fotografia de campo independente. Se a verificação da base falhar, a guarda recusa servir o ficheiro, em vez de o tornar público.
- Chat administrativo e portal usam o identificador da mensagem e o helper de download autenticado. Os anexos de imagem passam a abrir pelo botão protegido em vez de usar um `<img>` com URL pública. A mudança de sessão continua protegida pelo helper existente.
- PDFs e imagens raster permitidas conservam o tipo; HTML, SVG e outros tipos são descarregados como bytes, sem execução numa página/blob com a origem da aplicação. O browser recebe o nome original para o download.

## Evidência

`run-1789509674724`: anexos, fatura no chat, documento autenticado e privacidade Socket.IO — quatro grupos aprovados. Revisão final `run-1789509747826`: anexos, documento autenticado e percurso visual real dos três perfis — três grupos aprovados.

O novo teste cobre anexo antigo, texto antigo sem `fileUrl`, anexo novo, cliente alheio, técnico/chefe, sessão inválida/desativada, HEAD, Range, codificação, symlink privado, ficheiro privado sem referência, caminho exterior, dois uploads simultâneos com o mesmo nome e conteúdos distintos, canais de UI reais em Chromium e download de HTML inerte com nome preservado. Nenhuma mensagem externa é enviada.

323 testes unitários aprovados; sintaxe de 519 ficheiros backend aprovada. O runner passa a 80 grupos. Validar a árvore final com PostgreSQL 16 e restauro. A base anterior TASK172–175 está aprovada no workflow `35028280336`, commit `05c8632a2d1c7462138b489826cff3baa3d8e15e`, com 79 grupos.

## Limites

Não revoga cópias já descarregadas nem identifica ficheiros históricos órfãos sem qualquer referência em ClientMessage. Não é antivírus nem conversão de ficheiros. Não transforma todos os uploads operacionais em documentos privados. A guarda acrescenta consulta de referências aos ficheiros servidos pela área pública; medir o impacto com volume real antes do dimensionamento final. Não houve migração, instalação no VPS ou alteração da branch principal.
