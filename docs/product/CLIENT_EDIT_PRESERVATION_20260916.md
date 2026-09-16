# TASK188 — Preservação de dados na edição de clientes

Data: 16/09/2026. Branch: `work/field-readiness-20260915-simulation`.

## Falha reproduzida

O formulário administrativo usa `PUT /api/core/clients/:id`. Essa rota reutilizava o normalizador de criação, que define contrato/faturação desligados e campos omitidos a null. Uma alteração apenas ao nome de um cliente ativo devolvia HTTP 200, mas desativava contrato e faturação, mudava o estado para SETUP e apagava email e morada.

Reprodução isolada anterior à alteração: `field-qa-runtime/run-1789547148498/reproduce-entity-edit.cjs.log`.

```json
{"clientNameOnly":{"status":200,"contractActive":false,"billingActive":false,"lifecycle":"SETUP","email":null,"address":null,"credit":85.25}}
{"staleClientAccepted":true}
{"poolWithoutHistory":{"status":200,"name":"Changed despite missing history","history":0}}
```

A reprodução também identificou ausência de controlo de versão no cliente e sucesso indevido após falhar o histórico de piscina. Esses dois problemas continuam pendentes desta entrega.

## Correção

- Os dois aliases de edição de clientes usam `ClientBusiness.update`. Os valores de criação mantêm-se exclusivos da criação.
- Apenas os campos enviados são alterados. Omissão de contactos, dados fiscais, credenciais, contrato/faturação, arquivo, preços e saldo conserva o estado existente. Limpezas explícitas de campos opcionais continuam possíveis; `fiscalNif: null` tem precedência sobre o alias `nif`.
- A linha do cliente é bloqueada antes da leitura e escrita. A alteração e `UserAuditLog` são confirmados na mesma transação; uma falha na auditoria reverte também o cliente.
- A autoria deriva da sessão autenticada, com separação entre User e Technician, incluindo as sessões antigas. As permissões existentes são preservadas: ADMIN no alias core; ADMIN/TEAM_LEADER no alias comum.
- Password e PIN opcionais são guardados como hashes bcrypt quando alterados; valores vazios conservam os anteriores. Valores e hashes são excluídos da resposta e dos snapshots da auditoria, que guardam apenas indicadores de alteração.
- Erros internos devolvem uma mensagem neutra, sem detalhes da base de dados. Nomes vazios, texto com tipo inválido e credenciais inválidas são recusados antes da escrita.

Não são alteradas faturas, pagamentos, movimentos de crédito ou a lógica própria de ativação/arquivo. Não há migração nova.

## Validação

O executor local desligou-se após a reprodução (`409 environment_offline`). A implementação foi preparada sobre o commit remoto `6abcecf6f61703508f9d04144c3353d27a37b97f`, árvore `187042168b437f76b767167ed21ba3e4104e646b`, e a sintaxe dos cinco ficheiros JavaScript alterados foi analisada. Não foi executada localmente antes da primeira publicação.

O teste de integração `scripts/test-field-client-edit-preservation.js`, integrado como o 90.º grupo operacional, verifica:

- alteração apenas do nome nos dois aliases e preservação integral dos outros campos;
- limpeza explícita, credenciais vazias e alteração real de password/PIN sem exposição na resposta/auditoria;
- alterações concorrentes a campos diferentes;
- falha forçada da auditoria, reversão integral e recuperação nos dois aliases;
- dados inválidos, acesso anónimo/CLIENT recusado e manutenção da permissão TEAM_LEADER com autoria correta;
- conservação do estado arquivado e igualdade integral da fatura e pagamentos anteriores.

A aprovação depende do workflow `Field readiness integration` do commit publicado, incluindo os 90 grupos, unitários/técnicos, scripts de navegador, treze migrações aditivas e backup/restauro nativo em PostgreSQL 16. O sucesso da TASK187 não substitui este resultado. Consultar o workflow ligado ao commit para o resultado final.

## Limites e retoma

A edição continua sem UUID/comprovativo de reenvio nem controlo de versão. Alterações concorrentes ao mesmo campo podem sobrepor-se; esta entrega não resolve formulários obsoletos, respostas perdidas ou confirmação no navegador. Não foram modificados os formulários de clientes nem as rotas/formulários de piscinas.

Quando o executor regressar, reconciliar o checkout com o commit remoto, preservando a imagem preexistente `docs/product/evidence/group3/acceptance/technician-guide-1440x900.png`. Retomar controlo de versão/recuperação de clientes e a atomicidade/histórico dos aliases de piscinas. Não declarar prontidão global.

## Primeira execução nativa e correção do ensaio E2E

Workflow `35075302355`, commit `bb2cf83589161d721443481d0c831540ba6ac1d3`: 324 unitários, quatro técnicos, 17 scripts de navegador, sintaxe de 524 ficheiros e treze migrações aprovados. O novo teste de preservação de clientes passou. Resultado operacional: 89 de 90 grupos aprovados; o restauro foi omitido pelo CI após a falha de `test-field-e2e.js`.

A falha ocorreu no anexo do cliente móvel: o teste preenchia diretamente o input de ficheiro assim que a mensagem anterior era limpa, antes de terminar o carregamento da conversa e de o botão de anexo voltar a estar disponível. O emissor mantém `working=true` durante esse carregamento e recusa outro envio nesse intervalo.

O ensaio passa a reter deliberadamente a resposta de atualização da conversa, verificar que o botão de anexo está desativado/ocupado, libertar a atualização e escolher o ficheiro através do botão e seletor reais. Mantém as verificações de UUID/conteúdo, envio único e persistência do anexo, sem aumentar os tempos limite nem alterar o produto. Confirmar o CI completo da nova árvore, incluindo restauro.

## Confirmação final da TASK188

O executor regressou e o checkout foi reconciliado com `00b4247a328bdc2349722713335765ca7756be72`, conservando a alteração preexistente na imagem do guia. O E2E corrigido e a preservação de clientes passaram localmente em `field-qa-runtime/run-1789548978140`.

Workflow `35076385728` aprovado para essa revisão, árvore `e94d19261d268039c979b7979e6aebcbbc09ac05`: 90 grupos operacionais, 324 unitários/quatro técnicos, 17 scripts de navegador, treze migrações e restauro de 104 tabelas/22 ficheiros com linhas e hashes iguais. As indicações anteriores de validação/reconciliação pendente pertencem ao registo da primeira publicação.
