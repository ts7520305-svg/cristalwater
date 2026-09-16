# TASK194 — Gravação atómica da ficha técnica

## Reprodução

A rota `PUT /api/core/pools/:id/technical-sheet` gravava piscina, ficha, equipamento, sala técnica e perfil de cálculo em operações separadas. Ignorava falhas no histórico, nota e aviso de propagação, e aceitava a autoria indicada no corpo/cabeçalho.

Em `field-qa-runtime/run-1789557327125`, uma falha forçada na criação de `TECHNICAL_SHEET_CHANGE` devolveu HTTP 200/`ok:true`. A piscina foi renomeada, o volume passou de 48 para 60 m³ e os componentes ficaram alterados, apesar de faltar o histórico obrigatório. O novo teste falhou nessa versão como esperado.

## Correção

- A rota delega em `PoolTechnicalSheetBusiness`. ADMIN autenticado e identificador válido são obrigatórios; a autoria deriva da identidade autenticada e ignora os campos `actor` e `x-user-email` enviados pelo chamador.
- A transação bloqueia piscina e quatro relações na mesma ordem do editor geral e só depois lê a base. Atualiza os campos explícitos, cria o histórico da alteração, a nota opcional, o evento durável e o aviso ADMIN. Uma falha em qualquer dessas escritas reverte todo o conjunto.
- Campos omitidos e relações sem alterações são preservados. Nome/notas gerais não substituem observações ou parâmetros de tratamento. Zero, `false` e campos opcionais vazios são distinguidos; números inválidos/negativos ou inteiros fora do domínio são recusados.
- O cálculo usa os valores técnicos atuais para completar uma alteração parcial das dimensões. Quando consegue calcular o volume, piscina, ficha e perfil recebem o mesmo valor. Diâmetro/fator fornecidos são conservados no perfil. Profundidades mínima/máxima incompatíveis são recusadas.
- O histórico regista as fotografias completas antes/depois sob bloqueio. Duas alterações concorrentes em campos distintos conservam ambos os valores e uma cadeia coerente de estados.
- Base de Conhecimento e EventBus em memória recebem a projeção apenas depois do commit. Uma falha nessa projeção não desfaz nem oculta os registos duráveis; `propagation.persisted` e `livePublished` distinguem os dois resultados. A publicação local não comprova receção por um dispositivo/fornecedor externo.
- As alterações desta rota invalidam a versão observada pelo editor geral de piscinas, incluindo quando só muda uma relação técnica.

## Formulário existente

O formulário só guarda depois de carregar uma ficha válida. Durante o pedido, bloqueia o botão e os campos enviados, evitando uma segunda submissão e alterações locais que a atualização seguinte apagaria. Captura erros e conserva os dados e a nota histórica quando a gravação não está confirmada.

A confirmação exige HTTP 200, `ok:true`, a piscina certa, identificador de histórico e confirmação de persistência interna. Respostas 202, vazias/incompletas ou relativas a outra piscina não limpam a nota nem exibem sucesso. Uma falha ao atualizar a lista depois da confirmação é apresentada separadamente. Uma mudança de sessão bloqueia a escrita/aplicação do resultado antigo. Os novos estados são apresentados nos cinco idiomas existentes.

Estas verificações são mínimas: esta ficha ainda não usa UUID, versão observada, comprovativo imutável nem recuperação de pedidos após reload. Uma resposta perdida após commit continua a exigir consulta do estado atual; repetir uma submissão antiga pode criar outro histórico. A recuperação completa do editor geral não deve ser atribuída a esta página.

## Validação

- `test-field-technical-sheet-atomicity.js`: oito falhas dirigidas (quatro componentes, histórico principal, nota, evento e notificação), preservação total, autoria autenticada, cálculo parcial, valores omitidos/zero, acessos e concorrência; criação de relações antes inexistentes também reverte integralmente.
- O mesmo grupo abre a página administrativa real em Chromium, guarda o formulário completo, provoca falha de notificação, mantém a nota não confirmada, bloqueia um segundo envio e rejeita confirmações intermédias/incompletas/trocadas.
- `run-1789557546209`: reversões e preservação passaram; o teste de acesso usava um token de técnico sem técnico correspondente e obteve 401. A fixture foi corrigida para criar uma identidade real, conservando a exigência de 403 para o perfil sem permissão.
- `run-1789557645101`: grupo novo, recuperação UI do editor geral e percurso E2E aprovados. Teste final API/formulário em `run-1789557859047` aprovado. 324 unitários, quatro testes de técnicos e sintaxe de 527 ficheiros backend aprovados. O executor local usa PGlite por TCP; confirmar o CI nativo em PostgreSQL 16.
- A revisão `run-1789558010655` foi interrompida por `UnexpectedMessage`/ligação encerrada no adaptador PGlite durante injeção de falhas. Repetição numa instância nova em `run-1789558079120`: todas as verificações API/formulário passaram, sem alterar asserções.
- Runner passa de 95 para 96 grupos. Sem migração nova; continuam quinze migrações aditivas e 106 tabelas esperadas no restauro.
- Base anterior confirmada: TASK192–193, commit `5ac158fc641a1174a0216ce3f6cf1bc9a6fbf431`, árvore `5535379efc87b96cdc96ec6888bcaf7a44c027d1`, workflow `35088517697`: 95 grupos, 324 unitários/quatro técnicos, 17 scripts de navegador e restauro de 106 tabelas/22 ficheiros com linhas e hashes iguais. Verificar o workflow próprio desta nova alteração.

## Próximo ponto

Implementar versão, confirmação exata e recuperação durável nesta ficha, com rascunhos por conta/piscina e revisão de conflitos. Rever separadamente submissão/transição/aprovação de propostas técnicas, cujos escritores antigos não foram alterados aqui. Continuam também o inventário visual global e as restantes escritas antigas.

Sem merge em main, deploy/VPS, mensagens a fornecedores reais ou emissão fiscal. Esta alteração não declara o sistema integralmente pronto.
