# TASK377 — Histórico paginado de guias, obras e movimentos da frota

## Comportamento

Os três históricos de `/admin-vehicles` usam agora `/api/fleet-history`, reservado a uma conta User ADMIN autenticada. As listas anteriores mostravam apenas 20 guias/obras, oito materiais por obra e 30 movimentos, sem total nem acesso às restantes páginas. A nova consulta apresenta 25 registos por página, total de resultados e detalhe com materiais também paginados. Não há alteração de guias, stock, quilometragem, documentos ou movimentos nesta API.

Filtros por viatura, referência do registo, estado/tipo exato e intervalo de criação; obras/movimentos aceitam técnico e guia AT, e movimentos aceitam obra. Pesquisa literal por código AT/matrícula, matrícula/técnico ou material/tipo/unidade/origem, conforme o histórico. `%`, `_` e barras não se transformam em padrões de pesquisa. Os dias inicial e final são inclusivos no horário Europe/Lisbon, incluindo dias de 23 e 25 horas. Não são filtros pela validade fiscal da guia nem pela data de conclusão da obra.

Ordenação por criação decrescente e ID decrescente. Cada resposta lê total e página numa transação RepeatableRead. A primeira página estabelece o maior ID disponível; as seguintes conservam esse limite, e Atualizar inclui novas inserções. Alterações ou eliminações de registos existentes podem mudar resultados entre pedidos: o limite de inserção não é uma fotografia imutável de toda a consulta.

O detalhe mantém o registo selecionado ao mudar filtros, página ou idioma. Mostra notas exatas, associações, datas, origem/destino, leituras inicial/final e todos os materiais através das respetivas páginas. Zero e ausência, unidades distintas, nomes duplicados e quantidades assinadas são conservados. Viaturas inativas/arquivadas e referências históricas sem relação disponível continuam identificadas pelo número; não são eliminadas silenciosamente do histórico.

Referências de documento são distinguidas entre ausente, inválida e registada. Uma referência registada oferece a ligação autenticada `/api/transport-guide-documents/current/:id`; não comprova por si só a disponibilidade dos bytes. A abertura continua a usar o leitor protegido existente. Documentos/versões, edição da guia/materiais e fecho/anulação abrem os percursos de revisão existentes. Ligações entre AT, obras e movimentos permitem restringir a consulta correspondente.

## Leitura, sessão e apresentação

Projeções limitadas a identificação operacional e dados do histórico, sem contactos, credenciais, custos do técnico ou URLs de armazenamento. Pedidos GET privados, sem cache; resposta vinculada à conta, versão, filtros, página, total e referências. Respostas incompletas, repetidas, desordenadas ou com identidade incorreta são recusadas. Falha SQL devolve indisponível, nunca sucesso com lista vazia. Registo desaparecido e dados históricos incompatíveis têm estados próprios na API.

Lista e detalhe têm carregamento/erro/repetição independentes. Uma leitura falhada limpa os dados e ações dessa leitura, preservando filtros e a identidade do detalhe selecionado. Uma resposta tardia não substitui uma pesquisa ou seleção posterior. Mudança de conta, identidade incoerente, expiração e suspensão limpam dados e controlos; o regresso de uma sessão válida consulta novamente. Formulários de alteração da viatura e seletores adjacentes mantêm os seus valores durante consultas e mudanças de idioma.

Os históricos carregam independentemente dos alertas e das escolhas de viatura. Um alvo de alerta que esteja fora da primeira página pode ser consultado pelo ID exato. A revisão visual cobre os novos componentes em português, inglês, francês, espanhol e alemão, com 320/390/1440 px e controlos de pelo menos 44 px. A interface geral herdada continua com o seu próprio âmbito de tradução e recursos.

## Validação

- 944 testes unitários em 114 ficheiros, nove novos; quatro testes técnicos. Sintaxe: 687 scripts backend, 297 frontend e 44 inline.
- Nove grupos locais distintos: histórico API/navegador, documentos AT no navegador, materiais AT no navegador, gestão AT no navegador, fecho de obra no navegador, frota no navegador, navegação/preferências e simulação mensal via API.
- Percurso completo de 27 AT, 27 obras e 207 movimentos; ordem estável, limite de novas inserções, filtros combinados/literais e 28 materiais por detalhe repartidos em duas páginas.
- Dias de mudança de hora, quantidades negativas/zero, leituras zero/nulo, notas/unidades exatas, arquivo, relações órfãs, metadados inválidos e registo removido verificados.
- ADMIN autorizado; CLIENT, principal ENV_ADMIN e TECHNICIAN/TEAM_LEADER por PIN e User recusados. Quatro falhas SQL reais: Vehicle, SystemSetting, WorkGuideItem e VehicleStockMovement. Nenhuma produz lista vazia bem-sucedida.
- Comparação integral de 27 modelos durante os pedidos da API, 13 modelos durante a sessão de navegador e bytes do documento oficial inalterados; zero escritas de API no teste do novo histórico.
- Navegador com falhas independentes, offline, respostas parciais, cabeçalhos/conta errados, respostas tardias de lista/detalhe, alvo antigo de alerta, suspensão/regresso, mudança de conta durante leitura, identidade incoerente inicial e expiração.
- Dezoito capturas do histórico. Inspeção manual do filtro móvel PT, detalhe de obra DE a 320 px e movimento PT em desktop. Capturas finais aguardam o aviso transitório de rede desaparecer normalmente.
- O teste estático de ligações autenticadas foi atualizado para o módulo que as gera. As primeiras tentativas de QA e as respetivas correções de preparação/seleção do teste estão documentadas na evidência local; os grupos válidos foram concluídos integralmente.

[Evidência local](evidence/20260926_task377_local.json). QA local com PGlite 0.5.8 e dados sintéticos; não substitui PostgreSQL nativo. Sem migração nova: 43 existentes e 128 tabelas. Cache v188; runner de 290 grupos. Inventário: 126 HTML, 119 entradas de raiz, sete auxiliares, 114 páginas com referência literal em 311 scripts ativos, 12 sem referência literal, zero recursos ausentes e duas referências Git indisponíveis nesta cópia.

## Publicação e validação nativa

Preparada sobre `bb5eb4970d6b3dcdfb41f2c92600b3ae5795f142` para a branch `work/field-readiness-20260915-simulation`. SHA, árvore e CI serão registados após publicação. O gate PostgreSQL nativo deste lote permanece por confirmar.

TASK375 confirmada no [CI 36221808091](https://github.com/ts7520305-svg/cristalwater/actions/runs/36221808091), job `108348349992`: 286/286 scripts esperados distintos com código zero, 17 etapas e restauro de 128 tabelas/47 ficheiros com linhas e hashes iguais. [Evidência nativa](evidence/20260926_task375_ci.json). TASK376, [CI 36223589014](https://github.com/ts7520305-svg/cristalwater/actions/runs/36223589014), job `108353287692`, ainda em execução na última consulta; 288 grupos e restauro não declarados aprovados.

## Retoma

Rever os leitores antigos `/api/guides/transport`, `/api/guides/work` e `/api/guides/movements` e os seus consumidores restantes, especialmente projeções e âmbito efetivo TECHNICIAN/TEAM_LEADER quando há partilha de viatura. A frota administrativa já não os usa para estes três históricos; este lote não altera os contratos antigos para outros consumidores.

Conciliação histórica, desempenho/volume real, limites do motor de alertas, arquivo/cópias operacionais, VPS e piloto físico continuam abertos. O histórico não valida fiscalmente documentos nem consolida materiais com unidades diferentes. Sem merge/deploy/contactos reais; aplicação não declarada completa.
