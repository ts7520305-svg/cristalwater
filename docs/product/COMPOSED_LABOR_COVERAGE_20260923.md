# TASK306 — cobertura do trabalho com várias componentes de custo

## Resultado e problema reproduzido

A cobertura financeira conta uma visita valorizada quando as suas parcelas pertencem à mesma composição de trabalho confirmada. Salário e encargos continuam a ser parcelas monetárias próprias; a duração da visita conta uma vez na cobertura. Valorização individual, falta de valorização e revisão de fontes mantêm estados distintos.

Na base TASK305, a composição e ambas as despesas estavam confirmadas, mas a cobertura classificava a visita como LABOR_REVIEW porque havia duas parcelas. A reprodução pela API deu duas visitas, zero com tempo valorizado, uma sem valorização e uma por rever. Depois da correção, a mesma composição dá uma visita valorizada, uma sem valorização e nenhuma por rever. O segundo serviço, com o mesmo ID numérico e tipo EXTRA, conserva a sua identidade própria.

## Regra de leitura e limites

- A leitura usa o identificador de grupo atribuído pelo verificador de integridade do livro de despesas e exige que corresponda ao marcador da parcela. Não aceita um marcador isolado como prova de composição.
- As parcelas confirmadas do mesmo grupo representam uma medição. Valorizações individuais conservam identidades próprias. Qualquer parcela por rever, quantidade diferente da duração ou mais de uma medição independente mantém a visita por rever.
- A validação anterior continua a conferir documentos, participação de cada parcela, registos originais, quantidades, destinatário, orçamento e sobreposições de tempo. A correção não retira essas verificações nem altera montantes, datas, pagamentos ou comprovativos.
- Composições históricas de documentos inteiros v1, composições v2 de parcelas e misturas com documentos inteiros usam a mesma contagem. A anulação conjunta deixa a visita sem valorização; uma nova valorização válida volta a confirmá-la sem contar o grupo anulado.
- Os totais incluem todas as visitas do período; as listas de exemplos continuam limitadas a dez. Uma atribuição manual não passa a ser tempo medido. Ausência de consumo continua diferente de custo zero.
- Alteração apenas na projeção de cobertura, sem consultas adicionais, formato novo da API, migração, tabela, dependência ou alteração dos ecrãs. Mantém 35 migrações, 126 tabelas e cache v121. O resumo administrativo, a resposta por regras locais e o contexto do fornecedor simulado recebem a mesma correção.

## Verificação

Novo `scripts/test-field-composed-cost-coverage.js`, integrado no runner (208 → 209 grupos): composições v1/v2, documentos inteiros, parcelas e misturas; REGULAR/EXTRA com o mesmo ID; custo individual e atribuição manual; contagens completas com mais de dez exemplos; pagamentos e comprovativos imutáveis em consultas; resposta local e contexto enviado ao fornecedor simulado; API e ecrã real a 320/390 px; alteração e reposição de uma parcela, marcador forjado, conflitos reais de horários, recusa de nova valorização individual duplicada, anulação conjunta e substituição. A consulta de outro mês conserva o seu próprio denominador.

O cenário inicial falhou com a classificação reproduzida e passou depois da correção. A revisão visual confirma contagens e aviso de revisão legíveis. 409 testes unitários em 65 ficheiros aprovados; sintaxe 601 JS backend, 201 frontend e 62 scripts inline. Regressões de cobertura financeira, assistente financeiro API/UI e integridade dos tempos aprovadas. Logs locais `/tmp/cw306-*.log`, imagens em `reports/field-visual/composed-cost-coverage-*`.

## Publicação e próximo âmbito

Base `c3461e4e2860968a468bddf75df7e3769470b763`. Publicada apenas em `work/field-readiness-20260915-simulation`, sem força, com CI completo e restauro PostgreSQL 16 da versão final confirmados abaixo. Principal `feature/technicians-v25` preservada em `6f27081e1d183ff584a62255b016b373836734db`; sem merge, deploy ou contactos reais.

Corrige a classificação de trabalho já valorizado na cobertura de visitas REGULAR/EXTRA. Não acrescenta custos medidos próprios das manutenções nem altera o denominador para reparações/manutenções. Restantes gastos, ajustes/origens de receita, históricos, volume, fornecedores/VPS e piloto físico continuam abertos. Custos/receitas completos, lucro e margem permanecem por apurar.

## CI da versão final

Código `d93f3e2ffea493140d6f3621438f9a5e3b10d511`, árvore `0da598fa0fe424c6ea5ae80a4e7e2a6ab294c29b`, igual à validada localmente. [CI 35912816866](https://github.com/ts7520305-svg/cristalwater/actions/runs/35912816866), job `107356686960`: 17 etapas aprovadas em 23/09/2026 entre 19:58:12 e 20:27:00 UTC, 28m48s.

Logs completos conferidos: 209/209 grupos previstos distintos, todos com código zero e sem sinal; sem falha, omissão, grupo inesperado ou duplicação. O novo grupo de cobertura composta passou em 29700 ms. Passaram também 409 unitários/65 ficheiros, quatro testes técnicos, o gate geral do navegador, 35 migrações e sintaxe 601/201/62. Restauro PostgreSQL 16: 126 tabelas/46 ficheiros, linhas da base de dados e hashes dos ficheiros iguais.

Evidência completa em [evidence/20260923_task306_ci.json](evidence/20260923_task306_ci.json). O fecho posterior altera apenas documentação e conserva as árvores de código, migrações e testes aprovados. O ponto de retoma distingue esta correção das restantes lacunas financeiras; não atribui cobertura completa nem prontidão de produção.
