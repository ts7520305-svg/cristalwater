# TASK326 — Verificação complementar das devoluções e do custo líquido

Base publicada: `db6bd0f4da86b541452c0733e67f92cd6bae3287`, com devoluções parciais e correção da sincronização de lembretes. Este complemento mantém o modelo de stock, os contratos anteriores, as 40 migrações e os documentos originais.

## Alterações

A consulta de materiais apresenta, por produto, as quantidades originalmente consumida, devolvida e restante. Um produto inteiramente devolvido deixa de apresentar uma caixa para nova devolução. A proposta financeira apresenta as mesmas quantidades e recorda que custos anteriores continuam reservados até à anulação expressa.

A prova de devolução exige que o hash anterior corresponda ao último comprovativo referido ou, na primeira devolução, ao consumo original. Totais anteriores têm de ser coerentes com a existência de devoluções. A cadeia financeira recusa movimentos repetidos entre comprovativos. A interface também vincula o hash anterior à cadeia que acabou de consultar.

## Ensaios executados

- 548 testes unitários em 77 ficheiros, quatro testes técnicos e sintaxe 620 backend / 217 frontend / 62 scripts inline. Dois casos unitários adicionais verificam contradições em hashes/totais e reutilização de um movimento entre comprovativos aparentemente consistentes.
- API em duas instâncias, numa base isolada com as 40 migrações: origens CENTRAL/VEHICLE, vários produtos, devoluções sucessivas com seis casas decimais, devolução integral de um produto mantendo outro consumido e anulação final apenas do restante. Quantidades inválidas, excesso acumulado e reposição total disfarçada de devolução parcial são recusados.
- Custos anteriores permanecem intactos e reservados. Só o produto afetado fica por rever. A fonte antiga de versão 8 permanece verificável; a versão 11 conserva os comprovativos relevantes e valoriza apenas a quantidade líquida. O ensaio executa a anulação financeira explícita e a nova valorização, compara valores e comprova que uma devolução de outro produto não modifica a fonte já revista.
- Três falhas injetadas conservam stock, movimentos, recibos, histórico e auditoria. Pedidos iguais devolvem o mesmo resultado; pedidos diferentes concorrentes e a corrida entre uma atribuição de custo e uma devolução aplicam apenas a proposta ainda válida. Adulterar um movimento real bloqueia novos efeitos. Declaração, lembrete, pagamento e consumo originais são comparados antes/depois.
- Navegador Chromium real: rascunho após recarga, vírgula decimal, proposta adulterada com hash recalculado, offline, clique duplo, resposta perdida, consulta sem novo POST e reenvio do mesmo UUID. Nova valorização líquida, revisão do custo após segunda devolução, anulação do restante e limpeza ao mudar a conta. Inspeção visual a 320/390/1440 e em modo escuro.
- Regressão da API e do navegador de materiais dos lembretes passou. O ensaio geral de navegador que falhou no CI inicial também passou localmente com a correção publicada: confirmação offline conservada e fecho sincronizado após criação.

Os ensaios locais usam PGlite isolado e o navegador real; não substituem o CI completo com PostgreSQL 16 e restauro. O runner passa a 229 grupos e a cache a `cristalwater-field-20260924-v143`. Sem novas migrações, tabelas ou dependências. A aprovação nativa deste complemento permanece pendente nesta versão documental.
