# TASK374 — Modelos de materiais da frota

## Comportamento

`/vehicle-stock-preset` permite à administração rever e guardar os materiais iniciais de uma viatura, com entrada na gestão da frota. A lista paginada distingue modelo ausente, vazio, com materiais, inválido e acima do limite de revisão. O detalhe é carregado separadamente; uma falha de leitura não abre um formulário vazio pronto a substituir o conteúdo existente.

- Na edição, cada posição original tem uma decisão explícita: manter, alterar campos ou retirar. Só os campos escolhidos são substituídos. Nomes e unidades exatos, tipo omitido/nulo, linhas duplicadas e dados adicionais permanecem intactos nas linhas mantidas. Não se agregam materiais nem se convertem unidades.
- Quantidades de zero a um milhão, com até seis casas decimais; zero continua a ser uma linha. Formatos coercivos, negativos, exponenciais, campos arbitrários e revisões sem alteração efetiva são recusados.
- Substituir exige novas linhas; permite reparar conteúdo inválido. Esvaziar é uma operação própria: grava `[]`, distinguindo a ausência de modelo e impedindo a herança dos materiais da última guia em novas obras provisórias. O lote não elimina registos de modelo.
- O registo anterior completo fica na auditoria e no comprovativo, incluindo o texto original exato, notas, identidade e datas. Atualizar conserva as notas e a data de criação; a alteração de conteúdo recebe uma nova data de atualização. Uma criação não inventa notas.
- A revisão apresenta a viatura, origem prioritária dos materiais, obras/guias existentes, cada linha anterior/final e motivo. Campos legíveis substituem a apresentação inicial em JSON; os dados adicionais continuam disponíveis para consulta. Valores completos ficam visíveis sob os campos estreitos do telemóvel.

Obras abertas elegíveis conservam os seus materiais. Ao abrir uma nova obra, uma guia AT ativa tem prioridade; sem guia ativa, um modelo existente tem prioridade sobre a última guia, incluindo quando está vazio. Sem modelo, mantém-se a herança da última guia. A abertura partilha o mesmo validador e recusa modelos inválidos. Desempate da última guia por data e ID. Associação incompatível ou múltiplas obras/guias é assinalada na revisão; a abertura conserva as suas próprias validações de elegibilidade.

Guardar o modelo não altera obras abertas, materiais de guias AT, movimentos de stock, custos, pagamentos ou documentos oficiais. O leitor antigo fornece apenas os campos operacionais, com estado explícito, sem dados adicionais privados. Conteúdo inválido devolve 409 e indisponibilidade devolve 503. O PUT antigo exige a revisão própria.

## Gravação e recuperação

Modelo, auditoria e comprovativo por conta/UUID são confirmados na mesma transação. A revisão assinada de cinco minutos inclui a proposta e o estado exato da viatura, registo e associações de obra/guia. Alterações concorrentes obrigam a rever novamente. O bloqueio de viatura partilhado com a abertura de obras protege também a criação de uma chave ainda ausente.

Perda da resposta, reinício e repetições concorrentes recuperam o resultado original. Anulação persistente impede confirmação tardia. No separador guarda-se apenas a referência mínima por conta; linhas, motivo e prova permanecem em memória. Respostas incompletas, proprietário incoerente, falhas de armazenamento, referências corrompidas, troca de conta, expiração e suspensão não confirmam operações indevidas.

Revisão limitada a 100 linhas, 200 000 caracteres do conteúdo original, profundidade/volume de dados adicionais e 100 associações abertas/ativas. Valores acima desses limites permanecem conservados e exigem tratamento próprio; não são truncados nem migrados automaticamente.

## Validação

904 testes unitários em 111 ficheiros, incluindo 15 novos; quatro testes técnicos; sintaxe de 678 scripts backend, 288 frontend e 44 inline. Dez grupos locais distintos aprovados:

1. Modelos API: permissões; leitura operacional sem metadados privados; estados ausente/vazio/inválido; originais, notas e duplicados; seis reversões SQL em criação/atualização, auditoria e comprovativo; perda/reinício/repetição; duas revisões concorrentes; arquivo, metadados alterados, expiração e anulação; prioridade real de AT/modelo/vazio/última guia; concorrência com abertura real de obra; volume/paginação e preservação dos dados e bytes oficiais.
2. Modelos no navegador: entrada real da frota; falha de detalhe e recarga; edição de campos, remoção/adição, vazio explícito e reparação; texto escapado; duplo clique; perda/recarregar/offline/repetir/anular; pesquisa sem perder preparação; armazenamento e sessões; respostas parciais/tardias.
3. Frota API.
4. Frota no navegador.
5. Atribuição de técnicos API.
6. Fecho de obra API.
7. Criação de guia de transporte API.
8. PDFs de guias.
9. Simulação mensal pela API.
10. Simulação acelerada de dois anos pela API, incluindo 24 meses, 72 faturas únicas e 144 pagamentos parciais concorrentes conciliados.

Dezoito capturas em português, inglês, francês, espanhol e alemão, larguras 320/390/1440 e controlos de 44 px. Revistas visualmente `de-320.png` e `review-pt-1440.png`; grupo completo de navegador repetido após melhorar a leitura dos campos e dados adicionais. A verificação da opção desativada usa a propriedade DOM nativa, pois o auxiliar do navegador não a reconheceu no elemento `option`.

A indisponibilidade real da tabela de modelos é simulada no fim do grupo API: a primeira execução revelou que a renomeação de tabela pode encerrar a ligação PGlite usada pela autenticação seguinte. O teste de indisponibilidade foi mantido, colocado depois dos cenários funcionais e o grupo repetido integralmente. Não se mudou a autenticação nem se transformou a falha em lista vazia.

QA isolada com dados sintéticos, PGlite 0.5.8/socket 0.2.11 e Chromium 153. Nenhuma migração nova; 43 migrações aditivas existentes e 128 tabelas esperadas. Os ensaios locais de concorrência não substituem PostgreSQL nativo. Evidência: `evidence/20260926_task374_local.json`. Inventário: 124 HTML, 117 de raiz/sete auxiliares, 112 com referência literal em 305 scripts ativos, 12 sem referência literal, nenhum recurso em falta e dois recursos rastreados indisponíveis na cópia local.

## Publicação e próximo ponto

Publicada em `4f2dbd6a4eb794d5dab21b932e0a41c2584827db`, árvore `52322e6f98950c9ee6b5f374d2f1c9a937dac86a`, idêntica à preparada e validada localmente, na branch `work/field-readiness-20260915-simulation`. [CI 36220493972](https://github.com/ts7520305-svg/cristalwater/actions/runs/36220493972), job `108344709185`, em execução; **gate PostgreSQL nativo de 284 grupos e restauro ainda por confirmar**. Runner com 284 grupos; cache v185.

TASK372 confirmada: [CI 36217019968](https://github.com/ts7520305-svg/cristalwater/actions/runs/36217019968), job `108334888707`, 280/280 grupos esperados distintos, 17 etapas aprovadas e restauro de 128 tabelas/47 ficheiros com linhas e hashes iguais. [Evidência nativa](evidence/20260926_task372_ci.json). TASK373: [CI 36218570468](https://github.com/ts7520305-svg/cristalwater/actions/runs/36218570468), job `108339358313`, ainda em execução na última consulta; 282 grupos/restauro por confirmar.

Continuar nas regras de alerta da frota, revendo preservação, validação, auditoria, concorrência e recuperação. A quilometragem na abertura antiga de obra continua por rever. Conciliação histórica, volume real, arquivo/cópias operacionais, VPS e piloto físico permanecem abertos; aplicação não declarada completa. Sem merge, deploy ou contactos reais.
