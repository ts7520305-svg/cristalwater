# TASK217 — Rascunhos modernos de trabalho

## Resultado

O formulário de campo conserva medições, notas, checklist, produtos e contexto de trabalho por conta, tipo de visita e piscina. A consulta inicial preenche os valores existentes no servidor. Visitas REGULAR/EXTRA com o mesmo número mantêm rascunhos distintos.

A escrita usa Web Locks por conta, compara o rascunho observado de cada visita e confirma a leitura dos bytes gravados. A comparação incide na visita alterada; gravar outra visita da conta conserva as restantes. Selecionar uma visita sem modificar o conteúdo não cria uma nova versão nem provoca um conflito artificial.

## Revisão e preservação

- Os campos não alterados acompanham a resposta atual do servidor. Alterações diferentes no mesmo campo apresentam o valor nesta janela e o valor a rever. Escolher um valor é explícito; as diferenças ainda não resolvidas ficam guardadas com o rascunho e bloqueiam a conclusão.
- Uma alteração noutra janela conserva os campos visíveis e os dados já guardados. “Comparar rascunhos” combina alterações em campos distintos e mostra ambas as alternativas quando o mesmo campo mudou. Produtos e ocorrências são comparados como conjuntos completos, sem somar doses ou inferir trabalho realizado.
- Rascunhos tipados anteriores, sem referência do servidor, não recebem uma referência inventada. Diferenças exigem revisão antes de migrar. Registos antigos sem conta/tipo continuam preservados para reconciliação.
- Corrupção, conta ou piscina incompatível, falta de espaço, ausência de Web Locks e leitura diferente após gravação nunca produzem uma indicação de sucesso. A repetição local é explícita e os campos em memória são conservados.
- A hora de início confirmada pelo servidor substitui a hora provisória local. A confirmação do início não cria uma falsa disputa de medições.

O painel de diferenças está no conteúdo deslocável, separado da barra fixa de ações. Texto é inserido literalmente. Os botões não são recriados sem necessidade durante a gravação, preservando cliques ao sair de um campo. Impedimentos têm o seu próprio rascunho da TASK216; mudar de visita carrega ou limpa esse formulário pela identidade correta.

## Conclusão e correção

Antes de concluir, o formulário aguarda a gravação, verifica novamente o rascunho sob o mesmo bloqueio e prepara o pedido imutável antes da rede. Os campos de execução ficam bloqueados durante a preparação/envio. Uma conclusão pendente ou já confirmada conserva o UUID e conteúdo originais; outra janela não os substitui por novos valores. A recuperação continua no painel de envios existente.

O rascunho da correção REGULAR usa a mesma preservação local e distingue a fase de correção da execução original. Após resposta válida, a referência local acompanha o registo corrigido. O endpoint de correção REGULAR conserva o contrato anterior: este lote não lhe acrescenta um comprovativo transacional novo nem uma versão opaca no servidor. A correção EXTRA mantém o fluxo próprio da TASK214.

A revisão de fim de dia inclui rascunhos não submetidos e estados de gravação/revisão por resolver. O service worker v45 inclui o módulo novo; dados operacionais não entram na cache pública. Sem migração nova: mantêm-se 20 migrações aditivas.

## Evidência

- `run-1789633193588`: novo ensaio `test-field-modern-visit-drafts.js` aprovado em Chromium real. Sete campos, checklist e produtos após recarga offline; quota e leitura não confirmada; resposta do escritório; diferenças persistentes; duas janelas com bloqueio realmente disputado; alterações separadas/comuns; identidade REGULAR/EXTRA; dados corrompidos/conta/piscina errada; ausência de Web Locks; migração de rascunho anterior; conclusão offline e UUID original; tentativa tardia noutra janela; um débito de stock; conclusão extra separada; correção regular após recarga; troca de conta.
- E2E e execução extra aprovados em `run-1789632544841`; recuperação da ronda e impedimentos extra em `run-1789632616245`; identidade dos tipos em `run-1789632892041`. Na árvore funcional final, `run-1789633193588` aprovou o novo grupo, o E2E completo e os impedimentos extra, incluindo os ajustes de interface.
- 388 testes unitários, quatro testes técnicos, 17 scripts de navegador e sintaxe de 538 ficheiros backend aprovados. Runner integrado ampliado para 120 grupos.
- Painel revisto a 320, 390 e 1440 px; captura `reports/field-ui/MODERN_DRAFT_CONFLICTS.png` inspecionada.

Publicação, CI nativo e restauro deste lote ainda por confirmar. O adaptador local PGlite serve o ensaio funcional dirigido; não substitui PostgreSQL 16 nativo. PNG preexistente preservado com SHA256 `fba3c8189d9e0a31d96b378550736f865d30a4019f5e8d4d4487b15cfc543a71`.

## Limites e continuidade

A persistência começa com a indicação de rascunho guardado. Escrita em curso ou falhada pode perder os campos em memória se o navegador for terminado; existe aviso de saída. Não há sincronização dos rascunhos entre dispositivos. As janelas devem carregar esta versão para participar no bloqueio coordenado.

A comparação com o servidor usa a última resposta recebida, incluindo a cópia de ronda identificada como offline. Não acrescenta controlo de versão transacional às conclusões antigas nem elimina alterações concorrentes posteriores no servidor. A atribuição continua a ser verificada pelos contratos de escrita existentes.

Prosseguir com restantes filas/documentos modernos, entrada TEAM_LEADER, paginação e inventário visual por perfil, a partir da matriz atual. Sem deploy, alteração em main, fornecedores reais ou conclusão global do sistema.
