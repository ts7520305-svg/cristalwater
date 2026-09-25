# TASK368 — edição revista dos materiais de guias

## Problema e comportamento

A edição antiga eliminava e recriava os itens de transporte, sincronizava a obra por nome/unidade e podia deixar apenas parte dos dados alterada se uma operação falhasse. O novo percurso `/transport-guide-items`, acessível pelo botão «Editar materiais» no histórico da frota, exige conta ADMIN User, ligação explícita entre os IDs dos materiais de transporte e de obra, motivo e revisão antes de confirmar.

- Os itens existentes conservam ID, nome, tipo, unidade e consumo. Todos têm de constar da proposta; não há eliminação nem associação automática por nome. Os IDs de obra não podem ser usados duas vezes. Nomes iguais são permitidos, mas cada ligação exige o respetivo ID.
- O administrador corrige a quantidade total inicial, até um milhão com seis casas decimais. O total não pode ser inferior ao já consumido; o saldo final é calculado em milionésimos. Reduzir o total até ao consumido deixa saldo zero e conserva a linha. Novos materiais exigem nome, tipo, unidade e quantidade positiva, criando um par de itens.
- A revisão apresenta a viatura, as duas guias, motivo, IDs ligados, total anterior de transporte, total inicial atual na obra, consumo conservado, saldo atual/final e diferença de stock. A quantidade indicada é um total revisto, não uma carga adicional.
- A edição aplica-se a uma guia de transporte ativa, viatura ativa e uma única obra associada aberta. Obras múltiplas/fechadas, linhas em falta ou saldo histórico incoerente exigem reconciliação separada. Não se reabre nem reconstrói o histórico implicitamente. Não altera metadados, datas, estados, notas, quilómetros, técnicos ou documentos existentes.
- Transação única para alterações/criação dos itens, diferenças de stock da viatura, atualização da versão da guia, auditoria com valores anteriores/posteriores e comprovativo. Cada diferença não nula gera `VehicleStockMovement` ADJUSTMENT, com quantidade assinada, origem `REVIEWED_GUIDE_ITEMS`, IDs, motivo e valores. Nenhum movimento anterior é alterado. Não deduz o armazém nem cria `StockMovement`, faturação ou pagamentos.
- A ordem de bloqueios coordena-se com criação/associação de guias e consumo manual. A confirmação relê a guia/obra/materiais sob bloqueio e exige a mesma fotografia revista. Dois administradores com revisões concorrentes não aplicam ambas; consumo posterior à revisão invalida a correção.
- Prova assinada de cinco minutos, ligada à conta, UUID, proposta e estado. Repetições, resposta perdida e reinício devolvem o mesmo comprovativo. A consulta de resultado não escreve; encerrar uma tentativa impede confirmação tardia ou recupera a confirmação já existente.
- O antigo PUT de materiais devolve 409 com o novo percurso, incluindo páginas antigas em cache. A função de eliminação/recriação e o sincronizador por nome, agora sem utilizadores, foram removidos.

## Interface e preservação de sessão

Página própria em PT/EN/FR/ES/DE, diretório com páginas de 25 guias, pesquisa por referência/matrícula e filtro por ID. As guias incompatíveis são identificadas como indisponíveis; dados parciais, duplicados ou acima do limite de 100 materiais/obras não são aceites como completos. Campos em memória; apenas `{version, owner, guideId, requestId}` persiste por conta/separador. Não há reenvio automático.

Escolha do ID de obra obrigatória e vazia de início. As opções mostram ID/unidade/consumo/total; o material completo e as quantidades aparecem também por baixo do seletor, legíveis no telemóvel. Os campos e ligações sobrevivem à pesquisa e à mudança de idioma. Alteração/expiração da identidade, respostas tardias, suspensão e retorno à página são tratados pelo mesmo protocolo verificado dos percursos anteriores. Dados de materiais são texto, nunca HTML.

## Validação local

805 testes unitários em 105 ficheiros, incluindo 12 novos, e quatro técnicos. Sintaxe: 659 backend, 270 frontend e 44 scripts inline; ficheiros finais alterados também verificados individualmente. Nenhuma migração, tabela ou dependência nova; 42 migrações existentes aplicadas no ambiente isolado. Runtime local PGlite 0.5.8/pglite-socket 0.2.11; não equivale ao gate PostgreSQL nativo.

Dez grupos locais distintos: materiais API/navegador, criação de guias API/navegador, consumo manual API, stock operacional/conclusão de visita, PDFs de guias, abertura autenticada de documentos, navegador de frota e navegação comum. A API verifica oito pontos SQL de reversão: INSERT/UPDATE em ambos os tipos de item, movimento de viatura, atualização da guia, auditoria e comprovativo. Cada erro é injetado num processo HTTP separado; os dados são comparados antes de reiniciar o processo.

O teste entra pelo botão real «Editar materiais» do histórico da frota e conserva guia/idioma. Este percurso revelou que os formatadores `cleanRiskAnchor` e `issueText` tinham sido retirados na TASK365 apesar de continuarem a ser usados pelos alertas das guias. Ambos foram repostos, sem recuperar o cálculo alternativo de riscos no navegador. O ensaio exige que o histórico carregue com alertas reais e sem diálogos de erro.

O navegador verifica clique repetido, resposta perdida/recarga, falha de rede/repetição/anulação, consumos posteriores, revisão expirada, armazenamento com exceção/escrita ignorada, referência corrompida, respostas incompletas/atrasadas, duas contas durante revisão/confirmação, perfis recusados e sessão expirada. Dezoito capturas, cinco idiomas, larguras 320/390/1440, alvos de 44 px e ausência de deslocação horizontal. Capturas de edição móvel alemã e revisão desktop portuguesa inspecionadas após o ajuste das quantidades abaixo do seletor.

A regressão antiga de consumo confundia a sequência textual `997`, possível num UUID/data público, com um valor financeiro. Passa a procurar as chaves financeiras `monthlyFee`, `monthlyAmount`, `hourlyCost` e `password`, mantendo a verificação de contactos e PIN. Uma execução também encontrou colisão de prepared statement `s23` no adaptador PGlite ao iniciar o grupo de consumo após os erros SQL injetados no grupo de materiais. O grupo foi repetido por inteiro numa instância isolada nova; a evidência conserva as tentativas e os resultados, sem suprimir verificações. O auxiliar novo de teste do navegador foi corrigido para não enviar simultaneamente `exp` e `expiresIn` ao gerar a sessão curta de ensaio.

[Evidência local e hashes](evidence/20260925_task368_local.json). Cache v179; runner com 272 grupos distintos. Inventário: 118 HTML, 106 páginas com referência literal em 293 scripts ativos, 12 na fila, zero recursos locais inexistentes e dois recursos indexados não materializados. Referência literal não comprova conclusão de um módulo.

## Publicação e retoma

Publicada em `5f7d8cae657fac440f824f24c7e76c6397162c6e`, árvore `7762edf035ceb4d315e8d767691f6157c4783c95`, idêntica à preparada e validada localmente, na branch `work/field-readiness-20260915-simulation`. [CI 36186019162](https://github.com/ts7520305-svg/cristalwater/actions/runs/36186019162), job `108239427314`, em execução. O gate PostgreSQL nativo de **272 grupos e restauro permanece por confirmar**.

TASK367 já publicada em `1ceb2b90d054949d1125eedd993c7c34e06365a1`, árvore `79c2e69555d59d450b593b028d9f89bf42860f24`. [CI 36182594290](https://github.com/ts7520305-svg/cristalwater/actions/runs/36182594290), job `108228289199`, concluído com 269/270 grupos aprovados e restauro não executado. Falha no teste de recuperação documental corrigida na TASK369, mantendo a autorização do servidor; [evidência](evidence/20260925_task367_ci.json).

Próxima revisão: metadados/estado das guias e depois documentos oficiais/anexos. O PUT antigo de metadados ainda aceita atualizações parciais sem revisão própria; datas omitidas, transições de estado e resolução de pendências merecem análise. Fecho manual de obra, manutenção/custos, atribuições, presets e regras de alerta também continuam na fila. A seleção por nome no consumo automático de visitas não foi redesenhada. Sem conciliação histórica implícita, emissão/validação AT, merge, deploy ou contactos reais. Volume, VPS/cópias operacionais e piloto físico permanecem abertos; a aplicação não é declarada completa.
