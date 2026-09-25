# TASK370 — Documentos e versões das guias

## Comportamento entregue

O carregamento anterior substituía o apontador de `SystemSetting`, guardava o ficheiro numa pasta pública e escrevia a auditoria separadamente. O percurso `/transport-guide-documents`, acessível no histórico da frota e pelo botão geral «Gerir documentos das guias», exige ADMIN autenticado, guia explícita, motivo, ficheiro e revisão antes da confirmação.

Cada confirmação cria uma versão com os bytes originais, nome, formato, tamanho, SHA-256, autor autenticado, motivo, UUID e data. A nova tabela `TransportGuideAttachment` conserva também o registo completo de `SystemSetting` anterior à primeira substituição e, quando disponível, os bytes desse anexo antigo. Ficheiros antigos em falta, referências externas, ligações simbólicas e registos ilegíveis têm estados próprios na revisão; o registo original é preservado mesmo quando o ficheiro não pode ser recuperado. Os ficheiros antigos permanecem no disco. Ligações e autoria perdidas por substituições anteriores não são reconstruídas por suposição.

O documento atual mantém um apontador compatível para os leitores existentes. As versões anteriores ficam num histórico paginado de 25 entradas, com download autenticado por guia e versão. Guias fechadas ou sem viatura conservam consulta e carregamento administrativos. O carregamento não altera materiais, consumos, movimentos, notas da guia, obra, quilometragem ou estado operacional. Continua a ser arquivo documental interno; emissão, comunicação e validação fiscal AT ficam fora deste percurso.

## Gravação e integridade

A revisão valida o ficheiro em memória e assina durante cinco minutos a proposta, a identidade, o UUID e a fotografia da guia/documento atual. Não cria ficheiros provisórios. A confirmação relê e bloqueia a guia e o apontador, verifica novamente os bytes do ficheiro e do anexo antigo e recusa uma revisão desatualizada. Arquivo antigo, nova versão, apontador, atualização da guia, auditoria e comprovativo são uma única transação PostgreSQL. A atualização da guia invalida revisões administrativas concorrentes.

Repetições da mesma confirmação devolvem o comprovativo original. Perda de resposta, reinício ou recarga permitem consultar o resultado por conta/UUID sem reenviar o ficheiro. Encerrar uma tentativa recupera uma confirmação existente ou impede gravação tardia. Apenas a referência `{version, owner, guideId, requestId}` fica no armazenamento do separador; ficheiro e motivo ficam em memória. Identidade diferente, suspensão e expiração limpam os dados visíveis e recusam respostas tardias.

A migração 43 acrescenta uma tabela e índices, sem reescrever linhas antigas. Restrições SQL exigem tipo de versão válido, autor ADMIN, tamanho/hash presentes e coerência do tamanho com os bytes; versões antigas sem bytes conservam tamanho/hash nulos. A chave por autor/UUID/tipo admite o arquivo antigo e a nova versão na mesma confirmação. A relação impede eliminar uma guia com versões existentes. O ensaio nativo de restauro passa a incluir bytes binários na tabela e a compará-los após `pg_dump`/`pg_restore`, além das tabelas e ficheiros já verificados.

## Tipos e acesso

PDF, PNG, JPEG, WebP, XML e TXT até 26 214 400 bytes. Nome, extensão, MIME, tamanho e hash têm de concordar. PDF exige cabeçalho, fim e posição de referência plausíveis; imagens são descodificadas com limite de 48 milhões de píxeis e recusam múltiplas páginas. Texto exige UTF-8 sem controlos binários; XML recusa DTD/entidades e raízes HTML/SVG/script. Estas verificações não são um validador PDF/XML completo, antivírus ou certificação do conteúdo.

URLs antigas de `/uploads/.../guides` e aliases para essa pasta deixam de ser públicos. O leitor antigo devolve uma URL autenticada sem alterar o registo guardado. ADMIN consulta versões históricas; técnicos e chefes de equipa precisam de estar ativos e atualmente atribuídos à viatura da guia. Uma mudança de atribuição retira o acesso do token anterior. Clientes e administradores ENV são recusados. Ficheiros de outra guia nunca são aceites pelo ID de versão isolado.

Respostas privadas, sem cache, com `nosniff`, disposição de anexo e prova de conta/guia/versão/viatura/hash. O leitor do navegador confirma essas identidades e o SHA-256 antes de abrir. XML, TXT e ficheiros legados são downloads inertes; PDF/imagens novos usam o leitor autenticado existente. Conta alterada, expiração e cancelamento revogam a abertura. O POST antigo responde 409 antes de qualquer gravação em disco.

## Verificação local

840 testes unitários em 107 ficheiros, incluindo 14 novos; quatro testes técnicos. Sintaxe: 666 backend, 276 frontend, 44 inline; alterações finais verificadas individualmente. Onze grupos locais distintos: documentos API/navegador, abertura autenticada, recuperação documental, PDFs de guias, anexos de chat, frota, criação/materiais/estados de guias e preferências de navegação. PGlite 0.5.8 isolado não substitui o gate PostgreSQL nativo.

A API verifica leitura sem gravações, limites exatos e excesso de tamanho, campos/ficheiros multipart duplicados, conteúdo incompatível, original e metadados preservados, pasta pública/alias protegidos, permissões ADMIN/técnico/chefe e mudança de viatura, histórico órfão, paginação, perda de resposta/reinício/repetição, revisões concorrentes, ficheiro antigo alterado, prova expirada/adulterada e cancelamento. Sete falhas SQL — arquivo legado, versão nova, criação e atualização do apontador, guia, auditoria e comprovativo — revertem integralmente. Stock, obra e dados financeiros são comparados antes/depois.

O navegador verifica a entrada real no histórico, revisão de nomes como texto, PDF/XML, rejeição de conta/guia/versão/hash errados, ligação real na guia do técnico, clique repetido, recarga sem conservar ficheiro, rede indisponível/repetição/anulação, conflito, expiração, armazenamento sem quota ou sem gravação, referência corrompida, listas/histórico parciais, resposta antiga, filtros e idioma. Dezoito capturas em PT/EN/FR/ES/DE e 320/390/1440, alvos de 44 px e revisão visual móvel/desktop. Foi corrigida uma referência residual à função antiga de carregamento na página da frota. As falhas de preparação dos ensaios estão registadas na evidência, incluindo token de técnico sem associação, caminhos temporários partilhados e seletor do cartão documental.

O ensaio local da migração compara guia, materiais e registo legado antes/depois das 42 migrações anteriores mais a nova, verifica bytes binários e recusa tipo/autor/tamanho/hash/bytes incoerentes, duplicação e relação inválida. O ensaio nativo completo foi atualizado para aplicar a migração e exigir ausência de diferenças de esquema.

## Publicação e retoma

[Evidência local e hashes](evidence/20260925_task370_local.json). Cache v181; runner com 276 grupos; 43 migrações, uma nova tabela, nenhuma dependência nova. Inventário: 120 HTML, 108 páginas com referência literal em 297 scripts ativos, 12 na fila, zero referências locais inexistentes e dois recursos indexados não materializados.

Publicada em `33f8ccf7f73294cd480c9bd18d021139a66a6e29`, árvore `cd82930cc832e6447784117505620ec22ffe2c83`, idêntica à preparada e validada localmente, na branch `work/field-readiness-20260915-simulation`. [CI 36193770611](https://github.com/ts7520305-svg/cristalwater/actions/runs/36193770611), job `108264772521`, em execução. O gate PostgreSQL nativo de **276 grupos e restauro permanece por confirmar**. O restauro inclui agora a tabela de versões e o ensaio explícito dos bytes; não foi executado localmente.

TASK368: 271/272 grupos aprovados, falha no teste antigo de recuperação documental e restauro não executado. [Evidência nativa](evidence/20260925_task368_ci.json). A correção está na TASK369, cujo gate de 274 grupos permanece em execução na última consulta. A autorização do servidor foi conservada; a regressão passou localmente nesta etapa.

**Próxima revisão: fecho manual da guia de obra em `/admin-vehicles`.** O botão antigo solicita quilómetros num `prompt` e envia diretamente para `/api/guides/work/:id/close`; rever identidade, quilometragem, transição, stock, auditoria, concorrência e recuperação. Manutenção/custos, atribuições, presets e alertas permanecem para revisão própria. Volume documental/base de dados, políticas operacionais de arquivo/cópias, conciliação histórica, VPS e piloto físico continuam pendentes. Sem merge/deploy/contactos reais; aplicação não declarada completa.
