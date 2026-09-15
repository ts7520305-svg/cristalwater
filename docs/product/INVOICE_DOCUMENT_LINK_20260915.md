# TASK162 — Link do documento com regresso após autenticação

O botão «Copiar link PDF» passa a copiar um endereço absoluto de `/invoice-document?id=…`, sem credenciais. A página apresenta a entrada de cliente/administração e conserva apenas esse destino permitido durante o login. A consulta continua a ser feita pelo endpoint autenticado da TASK161; conhecer o link não concede acesso.

O regresso aceita exclusivamente o caminho interno do documento e um identificador inteiro positivo válido. URLs externos, caminhos arbitrários e parâmetros adicionais são rejeitados. A página permite nova tentativa, troca de conta e abertura do PDF com a sessão atual. IDs inválidos não originam pedidos ao endpoint financeiro. O conteúdo público da página não contém dados da fatura.

Ensaio `field-qa-runtime/run-1789504756197` aprovado: entrada real de cliente e administração, regresso ao documento, abertura do PDF do titular, recusa de documento de outro cliente, URLs externos/IDs inválidos e cópia do endereço canónico. Inclui regressão de acesso aos PDFs e dos quatro formulários de login. Verificação móvel a 390 px sem deslocamento horizontal. Testes unitários/técnicos/sintaxe executados antes do commit; runner com 67 grupos.

Dez ficheiros: página/script do documento, autenticação comum, dois formulários de login, script de faturação, teste, runner, relatório e checkpoint. Não envia mensagens. Os emissores antigos de email/WhatsApp e o envio completo ainda requerem revisão própria para usar este destino e registar corretamente a entrega.
