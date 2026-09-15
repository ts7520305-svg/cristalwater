# TASK163 — Acesso antigo aos alertas sob as regras atuais

A reprodução `field-qa-runtime/run-1789504900794` confirmou resposta 200, sem sessão, na listagem de alertas montada em `/api/client-auth`. O mesmo router continha uma atualização direta do estado do alerta, separada das regras da TASK134.

A autenticação de clientes mantém-se pública. As duas rotas antigas de alertas passam a exigir uma conta ADMIN ativa. A listagem conserva a resposta em array e delega no negócio. A resolução usa o negócio comum com referência técnica explícita, preservando a confirmação física de água/bomba, a versão, a transação e o comprovativo partilhado com `/api/alerts`.

Ensaio `field-qa-runtime/run-1789504955148` aprovado: visitante/cliente/técnico recusados, nenhuma escrita após recusa, consulta administrativa, bloqueio do alerta de água, oito resoluções concorrentes entre ambos os endpoints com um único comprovativo, versão antiga e IDs inválidos. Inclui regressões completas da resolução moderna e do login de documentos. Testes unitários/técnicos/sintaxe executados antes do commit. Runner com 68 grupos.

Seis ficheiros: router, negócio de listagem, teste, runner, relatório e checkpoint. Sem migração. A resposta de resolução antiga passa a usar o comprovativo atual, com `reference` e versões; nenhum consumidor frontend desse endpoint foi localizado. Não mantém a escrita direta vulnerável como compatibilidade.
