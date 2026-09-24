# TASK320 — Pausa e retoma nas revisões de equipamento

Base publicada: `03864a578b998a4ce077a4b2d035a9e4ef04a348`, fecho TASK319 aprovado no CI e restauro. Lote de 13 ficheiros.

## Resultado

O técnico pode parar e retomar o trabalho de uma revisão de equipamento, conservando até 20 intervalos positivos, ordenados e sem sobreposição. Intervalos adjacentes são permitidos. As pausas ficam disponíveis para outras revisões ou lembretes associados à mesma visita. O tempo e o custo usam apenas a soma dos intervalos.

O cronómetro mantém a precisão de milissegundos do registo existente. Os formatos e os comprovativos anteriores de um intervalo permanecem válidos. O novo formato `workTime.intervals` é exclusivo e gera um registo de esquema 2, com duração de cada intervalo, duração total e origem tipada REGULAR/EXTRA. Não inventa um intervalo contínuo entre a primeira entrada e a última saída.

## Integridade e custos

- Cada intervalo fica dentro da visita, antes da confirmação e, quando aplicável, antes do fim da visita. O técnico e a origem histórica permanecem vinculados ao comprovativo.
- Os conflitos são verificados por intervalo contra outras revisões, lembretes associados e os restantes serviços do técnico. Uma prova ausente ou alterada continua a bloquear novas reservas e a assinalar revisão.
- A comparação de recursos dos lembretes aceita a precisão de milissegundos dos pares de equipamento, mantendo a regra própria de segundos inteiros dos lembretes.
- A repartição financeira usa a prova de versão 4 para os novos registos. As provas anteriores de equipamento e lembretes conservam as versões e os hashes originais. Todos os intervalos, o técnico, a duração total e os limites da atribuição são novamente conferidos no servidor e no navegador.
- Equipamentos antigos, equipamentos com vários intervalos e lembretes usam o mesmo orçamento de tempo e cêntimos. A última parcela recebe o remanescente devido; o registo original da despesa e os pagamentos não são reescritos. Anular uma parcela restitui o respetivo saldo ao pai, conservando o histórico.

## Utilização e recuperação

O modo de campo acrescenta «Retomar trabalho» e «Remover último intervalo» aos comandos existentes. Apenas o último intervalo pode ficar aberto num rascunho; a confirmação exige todos fechados. Alterar o tempo repõe a confirmação explícita. Remover o segundo intervalo regressa ao formato antigo de um intervalo.

Rascunhos antigos e novos são conservados após recarga. A proteção entre janelas recusa uma edição sobre um rascunho entretanto alterado. O pedido preparado guarda todos os intervalos; uma resposta que altere qualquer duração é recusada, e a recuperação repete exatamente o pedido original sem duplicar a revisão. A troca de conta oculta os dados da sessão anterior.

O painel financeiro mostra cada intervalo, a soma efetiva e a exclusão das pausas. Uma duração adulterada, mesmo com hashes recalculados, é recusada antes da confirmação. Uma escrita cuja resposta se perdeu é recuperada por consulta ao comprovativo.

## Validação local

- 507 testes unitários em 73 ficheiros e quatro testes técnicos aprovados; sintaxe 616 backend / 215 frontend / 62 scripts inline.
- Novo grupo com API real e dois processos HTTP: formatos e limites, precisão de milissegundos, coexistência com recibos antigos, concorrência, pedido alterado, rollback, pausa livre, conflito no segundo intervalo, prova alterada e anulação explícita.
- Caso financeiro: visita de 12 segundos com custo de 100 cêntimos; três revisões antigas de um segundo recebem 8 cêntimos cada, a revisão com 1 + 2 segundos recebe 25, outra revisão na pausa recebe 17 e o lembrete recebe os 34 restantes. A soma permanece 100; a pausa da revisão nova não é imputada à sua parcela.
- Navegador real: pausa/retoma/remoção, rascunho aberto após recarga, duas janelas, resposta adulterada e repetição exata, rejeição de duração financeira incorreta, resposta financeira perdida e recuperação por consulta, isolamento de conta e ausência de erros de página. Larguras 320/390/1440; capturas do cronómetro e da parcela inspecionadas.
- Cinco regressões integradas aprovadas: tempo de equipamento, repartição do trabalho, intervalos dos lembretes associados, materiais de equipamento e correção administrativa dos materiais.
Código publicado `d201f216ade1e292a8d0a795f339c26922731825`, árvore `19fc5c961ab998f33762c3a8a311146f6506067d`, igual à validada localmente. [CI 36019143572](https://github.com/ts7520305-svg/cristalwater/actions/runs/36019143572), job `107699265852`, aprovado entre 2026-09-24T15:17:58Z e 2026-09-24T15:49:18Z (31m20s): 17 etapas, 223/223 grupos previstos distintos, sem falhas, faltas, entradas inesperadas ou duplicações; 507 unitários/73 ficheiros, quatro técnicos, gate geral de navegador, sintaxe 616/215/62 e 39 migrações. Restauro PostgreSQL 16 de 127 tabelas/46 ficheiros, com linhas e hashes iguais. Evidência [evidence/20260924_task320_ci.json](evidence/20260924_task320_ci.json). Cache v135, sem novas migrações/tabelas/dependências. O fecho posterior altera apenas documentação; a aprovação refere-se ao código e árvore acima.

## Limites e continuação

A duração não é somada novamente ao tempo integral da visita. A atribuição financeira conserva o limite existente do mesmo mês UTC; repartições entre meses e revisão histórica de registos sem comprovativo verificável continuam abertas. A correção posterior de tempos exige um percurso administrativo explícito com original e custos conservados. Receita/custo integrais, lucro, produção, fornecedores reais e piloto físico não ficam concluídos por este lote.
