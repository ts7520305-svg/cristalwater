# TASK189 — Edição geral de piscinas com histórico obrigatório

Data: 16/09/2026. Branch: `work/field-readiness-20260915-simulation`.

## Problema e alcance

A reprodução `field-qa-runtime/run-1789547148498` demonstrou que `PUT /api/pools/:id` devolvia HTTP 200 e alterava a piscina apesar de uma falha forçada ao inserir o histórico. A ficha técnica também ignorava erros; a leitura anterior e o histórico ficavam fora da transação. O alias core tinha outro escritor, com transferência de visitas fora de transação e erros ignorados.

O normalizador da edição geral podia usar `type: POOL/JACUZZI` como tipo de desinfeção e `notes` como observações técnicas. A correção preserva os campos técnicos omitidos e distingue explicitamente os conceitos.

## Alterações

- Os dois aliases gerais usam `PoolEditBusiness.update`, com autenticação ADMIN e autor da sessão. O corpo e `x-user-email` não determinam a autoria.
- A piscina é bloqueada antes da leitura; alteração, atualização/criação da ficha técnica, transferência das visitas elegíveis e histórico são gravados na mesma transação. Nenhuma falha destas escritas é ignorada.
- Nome, notas e tipo geral não reescrevem tratamento, observações técnicas, equipamento, sala técnica ou perfil de cálculo. Os campos técnicos precisam de ser fornecidos explicitamente. Limpar o volume geral opcional conserva um volume já medido na ficha.
- Uma ficha em falta é criada com `CLORO` como valor padrão do modelo e com o volume da piscina; o tipo da infraestrutura não é usado como tratamento. Esta inicialização não constitui validação física do tratamento instalado.
- Na mudança de cliente, o destinatário tem de existir e estar ativo, sem arquivo. A validação e associação decorrem com o cliente bloqueado. Só são transferidas visitas PLANNED/PENDING/SCHEDULED, sem início, fim, comprovativo de conclusão ou faturação. Trabalho iniciado, terminado, cancelado ou faturado mantém o cliente anterior.
- Cada alteração guarda os snapshots anterior/posterior e o número de visitas transferidas no histórico. Dados omitidos e arquivo são preservados. Os dados do cliente na resposta excluem password e PIN.
- Tipos e valores inválidos são recusados; limites técnicos invertidos não são gravados. Erros internos devolvem uma mensagem neutra. Faturas, pagamentos e saldo não são alterados.

Sem migração nova nem dependências adicionais. Os endpoints de criação, ativação e arquivo continuam com os seus contratos próprios.

## Evidência

Três grupos aprovados localmente em `field-qa-runtime/run-1789549524328`: `test-field-pool-edit-atomicity`, `test-field-client-edit-preservation` e `test-field-legacy-admin-access`, todos com código 0.

O novo teste cobre ambos os aliases: preservação dos dados relacionados; distinção de tipo/notas; autoria; falha forçada no histórico, na ficha e nas visitas com reversão integral; transferência seletiva com igualdade dos registos históricos; dados inválidos e acesso recusado; alterações concorrentes a campos diferentes; criação da ficha em falta e conservação do arquivo. A fatura, os pagamentos, o saldo e o contrato anteriores permanecem iguais.

O runner passa a 91 grupos. Confirmar o workflow da árvore publicada, incluindo unitários/técnicos, scripts de navegador, treze migrações aditivas e backup/restauro nativo. A validação da TASK188 não substitui esta verificação.

## Base confirmada e retoma

TASK188 confirmada em `00b4247a328bdc2349722713335765ca7756be72`, árvore `e94d19261d268039c979b7979e6aebcbbc09ac05`, workflow `35076385728`: 90 grupos operacionais, 324 unitários/quatro técnicos, 17 scripts de navegador, treze migrações e restauro de 104 tabelas/22 ficheiros com linhas e hashes iguais. O executor regressou, o checkout foi reconciliado e o E2E corrigido passou também localmente em `run-1789548978140`. A alteração preexistente da imagem do guia técnico foi conservada.

Esta entrega trata apenas as duas rotas de edição geral. A rota específica `/api/core/pools/:id/technical-sheet`, os fluxos de propostas técnicas e outras escritas antigas continuam a precisar de revisão própria. Controlo de versão, pedidos por UUID, recuperação dos formulários e conflitos entre editores continuam pendentes nos clientes e piscinas. A transação não constitui proteção contra um formulário obsoleto ou um reenvio após resposta perdida.
