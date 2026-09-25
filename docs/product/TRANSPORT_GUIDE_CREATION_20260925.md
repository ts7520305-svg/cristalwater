# TASK367 — criação revista de guias e associação de obra provisória

## Âmbito e problema

A criação antiga podia fechar obras, substituir uma guia por coincidência de código, recriar materiais e registar cargas em operações separadas, ignorando algumas falhas. A consulta de stock podia criar/sincronizar a obra ou reabrir uma obra fechada. Associar uma guia a uma obra provisória dependia de correspondências pelo nome e podia alterar o histórico.

O novo percurso `/transport-guide-create`, acessível pela viatura escolhida em `/admin-vehicles`, é exclusivo de ADMIN autenticado em conta User. Cria um registo interno de transporte e permite escolher explicitamente entre nova obra ou associação de uma obra provisória existente. **Não emite nem valida uma guia na AT.** O anexo oficial continua a ser uma operação separada, no histórico existente.

## Comportamento implementado

- Diretório privado com páginas de 25 viaturas ativas, pesquisa por matrícula/nome e filtro por ID. Projeção sem contactos, PINs, palavras-passe ou custos. Mais de 100 técnicos, obras, transportes ativos ou materiais por obra exige revisão administrativa; não se confirma uma lista truncada.
- Escolha explícita de viatura, modo de obra, técnico ou ausência de técnico, estado interno, origem, destino, motivo e início. Referência AT obrigatória fora do estado provisório, sem alteração da caixa nem substituição de um código existente. Quilómetros opcionais: vazio é nulo, zero é zero. Início/fim em hora civil de Lisboa, convertidos para instantes canónicos; hora inexistente recusada e repetição de outono exige primeira ou segunda ocorrência. Fim opcional, nunca anterior ao início.
- Uma a 100 linhas de material. Nome, tipo, unidade e quantidade explícitos nas linhas novas. Quantidade total inicial até 1 000 000 e seis casas decimais, sem expoentes ou agrupamentos. Não representa uma carga adicional nem uma transferência do armazém.
- Ao associar obra provisória, cada item existente é identificado pelo seu ID, incluído obrigatoriamente e conservado com nome/tipo/unidade/consumo. O total inicial revisto não pode ser inferior ao já consumido; o saldo é calculado em milionésimos seguros. Linhas novas são permitidas. Mantêm-se ID da obra, técnico, quilómetros, notas e movimentos anteriores, incluindo movimentos sem transporte associado. Não há reatribuição retroativa de movimentos nem correção histórica implícita.
- A revisão apresenta identidade, totais, consumo já registado, saldo final e todas as obras/transportes que serão fechados. Prova assinada de cinco minutos, vinculada à conta, UUID, campos e estado consultado. Alteração de atribuição, materiais, obra, viatura ou transporte invalida a revisão. Código existente é recusado, nunca usado para fazer upsert.
- Confirmação única e transacional: novo transporte/itens, criação ou associação da obra, atualização dos totais sem trocar IDs, fechos revistos, cargas de viatura, resolução do bloqueio de AT em falta da obra associada, auditoria e comprovativo. A ordem de bloqueios coordena abertura de obra e consumo manual. Duas revisões concorrentes da mesma viatura permitem uma confirmação; a outra precisa de nova revisão.
- Cada linha do novo transporte produz um `VehicleStockMovement` do tipo LOAD, identificado como stock inicial revisto ou associação provisória. Não cria `StockMovement`, não deduz `StockBalance` do armazém e não altera faturação, visitas, pagamentos ou custos. O fecho conserva materiais, notas, quilómetros e documentos antigos.
- Pedido por administrador/UUID: resposta perdida, reinício e repetições concorrentes recuperam o mesmo comprovativo. GET não escreve; encerrar a tentativa regista uma anulação ou recupera a confirmação existente. Proposta/prova ficam em memória; só `{version, owner, vehicleId, requestId}` persiste por conta/separador. Armazenamento indisponível, escrita ignorada ou bytes inválidos impedem novos envios sem apagar dados existentes. Não há repetição automática.
- Página própria em PT/EN/FR/ES/DE, campos preservados ao filtrar ou mudar idioma, identidade coerente entre aliases, limpeza na suspensão/troca/expiração da sessão e rejeição de respostas tardias. Estados de preparação, revisão, erro, confirmação desconhecida, anulação e comprovativo são distintos. Texto de materiais nunca é interpretado como HTML.

## Coordenação dos percursos existentes

O POST antigo de criação de transporte responde 409 e indica o percurso revisto. O formulário administrativo encaminha para a nova página com viatura e idioma; a área de histórico, edição e anexos permanece disponível. Os dois auxiliares ativos de simulação foram adaptados ao protocolo review/commit e têm testes para os três formatos de resposta usados pelos scripts.

GET de stock passa a ser estritamente de leitura: sem criação, sincronização, reposição de saldos ou reabertura de obras. Várias obras abertas ambíguas exigem revisão. Os aliases de abertura coordenam-se pelo bloqueio da viatura; repetição devolve a obra existente sem alterar quilómetros, notas ou materiais. Uma obra já fechada não é reaberta implicitamente. O âmbito da viatura aplica-se também a TEAM_LEADER, por PIN ou User associado.

O consumo automático na conclusão de visita bloqueia e relê a obra antes de tocar nos itens. Se foi fechada ou mudou a associação, a transação da visita é recusada. Este ajuste não substitui a revisão mais ampla desse escritor: a escolha antiga de material pelo nome e as restantes regras de conclusão não foram redesenhadas neste lote.

## Validação

793 testes unitários em 104 ficheiros, incluindo 21 novos; quatro testes técnicos. Sintaxe: 656 backend, 267 frontend e 44 scripts inline. Sem dependências, tabelas ou migrações novas; as 42 alterações aditivas existentes são aplicadas no ambiente isolado. PGlite 0.5.8/pglite-socket 0.2.11 local não substitui PostgreSQL nativo.

Os dois grupos novos API/navegador e os grupos de frota passaram. A API cobre exclusividade ADMIN, privacidade, campos estritos, associação explícita, conservação do histórico, concorrência, resposta perdida/reinício, anulação, prova alterada/expirada e alterações de saldo/atribuição/transporte. Oito pontos SQL injetados revertem todas as linhas: sete INSERTs e a atualização de um item na associação provisória. Cada erro usa um processo HTTP isolado, com invariância verificada antes de o reiniciar.

O navegador usa a página e API reais, incluindo falta de rede, clique repetido, recuperação após recarga, armazenamento com falhas, pacote incompleto, pesquisa concorrente, mudança de conta durante revisão/commit, expiração e suspensão. Vinte capturas abrangem cinco idiomas, larguras 320/390/1440, revisão e materiais; alvos de 44 px e ausência de deslocação horizontal do documento verificados. Inspeção visual das capturas móveis, formulário de materiais e revisão desktop efetuada.

Treze grupos locais distintos aprovados: criação API/navegador, frota API/navegador, consumo API/navegador, stock operacional, mês, dois anos, interligações, PDFs de guias, abertura autenticada de documentos e navegação. [Evidência local, grupos e hashes](evidence/20260925_task367_local.json). O teste de consumo antigo esperava 409 também ao chefe de equipa que indicava a obra de outra viatura: agora verifica exatamente 409 na própria e 403 na alheia para ambos os perfis de campo, mantendo a exigência de ausência de escrita. Após os erros SQL injetados no consumo, a fixture do navegador falhou antes de abrir a página com uma colisão de prepared statement do adaptador PGlite. O grupo completo de navegador e as regressões seguintes passaram numa instância isolada nova, sem alterar as verificações. Os logs das duas ocorrências são conservados na evidência.

Cache v178. Runner com 270 grupos distintos. Inventário: 117 HTML, 105 páginas com referência literal em 291 scripts ativos, 12 na fila; nenhum recurso local ausente da aplicação e dois recursos existentes no índice não materializados nesta cópia. Referências literais não provam conclusão dos módulos.

## Publicação, limites e retoma

Lote publicado na branch `work/field-readiness-20260915-simulation` em `1ceb2b90d054949d1125eedd993c7c34e06365a1`, árvore `79c2e69555d59d450b593b028d9f89bf42860f24`, igual à validada localmente. [CI 36182594290](https://github.com/ts7520305-svg/cristalwater/actions/runs/36182594290), job `108228289199`, em execução na consulta de retoma. O gate nativo de 270 grupos e restauro permanece pendente.

TASK366 confirmada: [CI 36169342475](https://github.com/ts7520305-svg/cristalwater/actions/runs/36169342475), job `108184782991`, **268/268 grupos esperados distintos**, 17 etapas, 42 migrações e restauro de 127 tabelas/47 ficheiros com linhas e hashes iguais, em 40m00s. [Evidência nativa](evidence/20260925_task366_ci.json).

**Próxima revisão: edição dos materiais e metadados/estado das guias, depois documentos oficiais/anexos.** O atual `updateTransportGuideItems` ainda elimina/recria itens de transporte e sincroniza por nome/unidade em várias operações; os outros escritores antigos não partilham integralmente este protocolo. Não se afirma atomicidade global entre todos os escritores de guias. Fecho manual de obra, manutenção/custos, atribuições, presets e regras de alerta conservam revisão própria.

A abertura provisória conserva a origem anterior em preset/última guia; não é conciliação de stock físico. Aviso de AT em falta continua best-effort após uma nova abertura provisória, fora da transação dessa abertura. Validação de volume, conciliação histórica, PostgreSQL/restauro do lote, VPS/cópias operacionais e piloto físico permanecem abertos. Scripts históricos fora do runner que chamem a criação antiga precisam de adaptação. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
