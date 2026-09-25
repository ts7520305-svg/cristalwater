# TASK369 — Dados e estado das guias de transporte

## Comportamento entregue

O antigo PUT de metadados apagava `validUntil` quando o campo era omitido, misturava edição e transição livre de estado e podia fechar a guia de transporte deixando a obra aberta. A resolução de pendências e a auditoria eram gravações separadas. O novo percurso `/transport-guide-manage`, acessível pelos botões de editar/fechar/anular no histórico da frota, exige ADMIN User, motivo e revisão explícita antes de confirmar.

- **Editar dados:** cada campo começa em «Manter». Campos omitidos conservam o valor exato, incluindo segundos/milissegundos e nulos. «Alterar» envia apenas o campo escolhido; «Limpar» envia nulo explicitamente. Texto vazio e nulo são distintos. Referência AT, origem, destino, notas, validade e rascunho têm validação própria. O motivo administrativo não substitui as notas da guia.
- **Datas:** alterações usam hora civil de Lisboa. A hora inexistente na primavera é recusada; a hora repetida no outono exige escolher a primeira ou a segunda ocorrência. Início/fim são validados conjuntamente quando alterados. Uma edição de notas preserva datas históricas, mesmo quando estas exigem futura reconciliação.
- **Fechar:** apenas uma guia ativa pode passar a fechada. Todas as obras abertas ligadas são identificadas na revisão e fechadas na mesma transação. Obras já fechadas conservam a data original.
- **Anular:** disponível para guia ativa ou fechada. Fecha obras abertas ainda ligadas, conservando o fecho anterior de uma guia já fechada. Se o escritor antigo tiver deixado uma obra aberta, essa obra recebe a data real desta confirmação, sem uma data de fecho retroativa. As pendências documentais anteriores não são dadas como resolvidas por anular/fechar.
- **Reativar:** exige guia fechada/anulada, viatura ativa sem outra guia ativa ou obra aberta e escolha explícita do ID da obra fechada a reabrir. O técnico associado deve continuar ativo e atribuído à mesma viatura. Sem obras ligadas, reativa apenas o transporte; a abertura posterior conserva o percurso próprio. Não reatribui técnicos, não cria stock e não repõe consumos. O fecho anterior fica na auditoria.
- **Pendências:** os IDs de `MISSING_TRANSPORT_GUIDE` a resolver constam da revisão. Só são resolvidos para obra aberta, guia ativa e referência fornecida fora de rascunho, através de escolha explícita de referência/rascunho ou reativação. A identidade vem da sessão ADMIN, nunca de cabeçalhos de nome/email. O registo continua a ser interno; não há comunicação nem validação fiscal AT.

Guias históricas sem viatura permitem edição de metadados, sem inventar uma associação. Estados desconhecidos, relações incoerentes ou volume acima do limite são recusados para revisão separada. Há até 100 obras, itens por obra, itens de transporte e pendências por fotografia; a adequação a volumes reais maiores permanece por validar.

## Gravação e recuperação

Revisão assinada por cinco minutos, ligada a administrador, UUID, proposta e fotografia de guia/obras/itens/viatura/técnicos/pendências e possíveis conflitos. A confirmação relê esses dados sob bloqueios, na ordem partilhada com criação/abertura/consumo de guias. Alterações posteriores, incluindo consumo efetivo ou mudança de atribuição, invalidam a revisão. Duas reativações concorrentes na mesma viatura não deixam duas guias ativas.

Metadados, estados, fechos/reabertura, resolução de pendências, auditoria e comprovativo são gravados numa transação. A auditoria inclui motivo, ação e valores anteriores/posteriores. O comprovativo conserva também o instante da operação, distinguindo um fecho histórico da guia do fecho atual de uma obra. Repetições ou recuperação após resposta perdida/reinício devolvem o mesmo resultado; os validadores aceitam a ordenação de propriedades JSONB sem aceitar alterações de conteúdo. Encerrar uma tentativa impede gravação tardia ou recupera a confirmação já existente.

Materiais e respetivos IDs, quantidades, consumos, movimentos, quilómetros, notas de obra, anexos e ficheiros oficiais não são reescritos. O PUT antigo de metadados responde 409 e indica o novo percurso, também para páginas antigas em cache. Foi removido o auxiliar antigo de resolução de pendências, agora sem utilizadores.

## Interface e testes

Página em PT/EN/FR/ES/DE, pesquisa paginada por referência/matrícula/ID, valores atuais e revisão antes/depois. O seletor de reabertura começa vazio e identifica obra, estado, técnico e fecho. Campos em memória; apenas `{version, owner, guideId, requestId}` persiste por conta/separador. Pesquisa e idioma preservam a preparação. Suspensão, conta diferente, expiração, respostas tardias, armazenamento indisponível/corrompido e respostas parciais não originam envios automáticos nem confirmação falsa. Texto de utilizador é mostrado como texto, incluindo entradas de ensaio com HTML.

826 testes unitários em 106 ficheiros, incluindo 21 novos, e quatro testes técnicos. Sintaxe: 662 backend, 273 frontend e 44 scripts inline; alterações finais também verificadas individualmente. Nenhuma migração, tabela ou dependência nova; 42 migrações existentes aplicadas em ambiente isolado. Onze grupos locais distintos aprovados: gestão de guias API/navegador; recuperação de documentos; criação de guias, materiais e frota no navegador; PDFs de guias; abertura autenticada de documentos; navegação; stock operacional/conclusão de visitas; consumo manual API. PGlite local não substitui PostgreSQL nativo.

A API ensaia cinco pontos SQL de reversão (obra, transporte, pendência, auditoria, comprovativo), perda de resposta/reinício/repetição, revisão concorrente e reativação concorrente de duas guias, referência duplicada, guia histórica sem viatura, técnico reatribuído, consumo após revisão, prova expirada/adulterada e anulação persistente. Compara stock/documentos e dados de negócio para garantir preservação.

O navegador entra pelo botão real do histórico e testa «Manter/Alterar/Limpar», precisão das datas mantidas, datas de Lisboa, fecho/anulação/reabertura, clique repetido, perda de resposta/recarga, rede indisponível/repetição/anulação, alterações posteriores, expiração, falhas e corrupção de armazenamento, pesquisa atrasada/parcial, filtros/idioma, suspensão e troca de conta durante revisão/confirmação. Dezoito capturas, cinco idiomas, 320/390/1440 e alvos de 44 px; edição móvel alemã e revisão portuguesa desktop inspecionadas. Corrigidos durante o desenvolvimento o tratamento da ordenação JSONB no comprovativo e a atribuição indevida de `type` a um textarea. Os logs das tentativas foram conservados na evidência local.

## Correção do gate anterior

[TASK367, CI 36182594290](https://github.com/ts7520305-svg/cristalwater/actions/runs/36182594290), job `108228289199`: **269/270 grupos aprovados**, migrações/sintaxe/unitários aprovados, **restauro não executado** após a falha. O teste de recuperação documental esperava documentos «Válidos» para um segundo técnico na mesma viatura, embora a leitura atual corretamente devolva apenas a obra do técnico autenticado. A expectativa antiga expirou na linha 143. O teste agora exige comprovativo da própria conta, obra nula, stock/movimentos vazios, estado «Rever» e preservação da cópia da primeira conta. A autorização do servidor foi mantida; o grupo foi repetido integralmente com sucesso. [Evidência nativa](evidence/20260925_task367_ci.json).

TASK368 terminou em 271/272 grupos aprovados, com a mesma expectativa antiga no teste de recuperação documental; restauro não executado. Correção incluída na TASK369, mantendo a autorização do servidor. [Evidência nativa](evidence/20260925_task368_ci.json).

## Publicação e retoma

[Evidência local e hashes](evidence/20260925_task369_local.json). Cache v180; runner de 274 grupos. Inventário: 119 HTML, 107 páginas com referência literal em 295 scripts ativos, 12 na fila, zero recursos locais inexistentes e dois recursos indexados não materializados. Referência literal não comprova conclusão de um módulo.

Publicada em `8ade13c23b59404961469de6b8f388c769cc2dd9`, árvore `4221ebc7913fac0aa1da54a8c562ae64730675d7`, idêntica à preparada e validada localmente, na branch `work/field-readiness-20260915-simulation`. [CI 36189626318](https://github.com/ts7520305-svg/cristalwater/actions/runs/36189626318), job `108251326109`, em execução. O gate PostgreSQL nativo de **274 grupos e restauro permanece por confirmar**.

**Próxima revisão: documentos oficiais/anexos das guias em `/admin-vehicles`.** O upload antigo substitui metadados em `SystemSetting` e grava auditoria separadamente; rever versões, associação, tipos/conteúdo, autoria, falhas e recuperação. Fecho manual de obra, manutenção/custos, atribuições, presets e regras de alerta continuam na fila. Escolha automática de material por nome em visitas não foi redesenhada. Conciliação histórica, volume, VPS/cópias operacionais e piloto físico permanecem abertos. Sem merge/deploy/contactos reais; aplicação não declarada completa.
