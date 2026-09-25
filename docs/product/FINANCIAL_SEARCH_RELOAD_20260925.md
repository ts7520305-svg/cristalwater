# TASK354 — pesquisa financeira após troca de conta

A falha de reposição de campos encontrada no centro de cobranças motivou uma verificação dirigida dos históricos de pagamentos e extras. Nos dois percursos, o cenário reforçado passou sem alterar o código das páginas. Esta tarefa acrescenta uma regressão permanente; não afirma ter corrigido um defeito que os ensaios não reproduziram. [Evidência local](evidence/20260925_task354_local.json).

Os ensaios existentes passam a deixar preenchida a pesquisa literal `50%_x` e a selecionar um cliente antes de mudar de administrador. A mudança de sessão oculta os dados, esvazia os filtros visíveis e bloqueia a atualização. Depois da recarga com a conta seguinte, a pesquisa e o cliente indicados no endereço são recuperados; o resultado contém exatamente o único registo correspondente. Segue-se o ensaio de expiração já existente.

Dois grupos completos de API/Chromium passaram, cada um com 105 registos principais em três páginas, além dos respetivos casos de dados históricos, acessos, falhas, respostas atrasadas, offline/timeout, idioma e recarga. Clientes, documentos, pagamentos e extras originais permanecem iguais, sem chamadas de escrita da página. Os testes de extras voltaram a cobrir PT/EN/FR/ES/DE em 320/390/1440; pagamentos cobriu os cinco idiomas em 390 e PT em 320/1440. A apresentação não foi alterada neste lote.

As duas verificações de sintaxe dos scripts e o controlo do diff passaram. A execução geral anterior continua registada na TASK353: 645 unitários/91 ficheiros, quatro técnicos e sintaxe 634/236/53. Não se declara uma nova execução desses testes gerais nesta tarefa.

Runner conserva 251 grupos distintos, cache v165 e 40 migrações existentes; não há alterações à página, à API, às regras financeiras ou ao armazenamento. Publicada em `bdd7b7d1a59c1fba843a812d1c8986561b38aa74`, árvore `6b7ae90a2907fdb1059c00bec0c84faf305b7db5`, idêntica à preparada e validada localmente. [CI 36122904203](https://github.com/ts7520305-svg/cristalwater/actions/runs/36122904203), job `108032336473`, em execução; os 251 grupos e o restauro PostgreSQL nativo deste lote continuam por confirmar. TASK351 conserva a evidência de 250/250 grupos e restauro aprovado; TASK352/353 permanecem em execução no último controlo.

O resultado cobre os navegadores e os cenários controlados dos ensaios. Não substitui o piloto iPhone/Android, a medição de volume ou a validação da produção. Retomar esses critérios e a fila finita das restantes páginas. Sem merge, deploy ou contactos reais.
