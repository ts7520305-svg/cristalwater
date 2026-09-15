# TASK137 — classificação visual de faturas em rascunho

Data: 2026-09-15
Branch: `work/field-readiness-20260915-simulation`

## Objetivo

Fechar no ecrã de faturas a distinção entre um documento em `DRAFT`/`RASCUNHO` e uma dívida efetivamente emitida/cobrável.

## Implementação

- `frontend/invoice-draft-classification.js`
  - reconhece `DRAFT` e `RASCUNHO` como rascunho;
  - mostra badge `RASCUNHO` e tratamento visual próprio;
  - força o valor em aberto do rascunho a `0` para efeitos de cobrança e filtros;
  - impede que um rascunho apareça como pago apenas por ter valor em aberto zero;
  - exclui rascunhos dos filtros de dívida/atraso e pendentes;
  - acrescenta filtro dedicado `Rascunhos`;
  - acrescenta contador de rascunhos no resumo;
  - desativa `Registar pagamento` no rascunho;
  - desativa a partilha do PDF antes da emissão;
  - mantém apenas a pré-visualização do PDF;
  - mostra aviso explícito de que o documento ainda não foi emitido e não conta como dívida.

- `frontend/invoices.html`
  - carrega a camada de classificação de rascunhos após `invoices.js`.

- `scripts/test-invoice-draft-classification-browser.js`
  - teste browser real com `DRAFT`, `PENDING`, `PAID` e `OVERDUE`;
  - confirma classificação visual, resumo, filtros e deep-link `?status=draft`;
  - confirma que o rascunho não entra no total em aberto;
  - confirma que a ação de pagamento não chega ao backend;
  - confirma que o filtro de devedores mantém documentos emitidos em aberto sem incluir rascunhos.

- `scripts/test-field-suite.js`
  - preservado o runner de integração isolada existente;
  - adicionado `test-invoice-draft-classification-browser.js` ao fim da bateria.

## Validação

Workflow `Field readiness integration`, run `58`, commit `957739f9f07a8f9e4180143d68018905cd98e6c4`: **PASS**.

Passaram:
- instalação/validação Prisma e migrações aditivas;
- syntax check;
- 322 testes Vitest;
- testes do técnico;
- bateria browser de campo;
- suite de integração de campo completa, agora incluindo a classificação de rascunhos;
- restore isolado de base de dados e uploads;
- upload de evidências.

Nenhuma alteração foi aplicada a dados reais ou ao servidor de produção neste checkpoint.

## Correção de CI durante a tarefa

Uma primeira alteração substituiu por engano o runner histórico `scripts/test-field-suite.js` por uma variante incompatível que chamava um script npm inexistente (`test:migrations`). O erro foi identificado pelos logs do GitHub Actions, o runner original foi restaurado integralmente e o novo teste foi acrescentado sem remover a cobertura anterior. O run 58 confirmou a correção completa.

## Próximo passo — TASK138

Fechar o ciclo `DRAFT -> ISSUED -> cobrança` no ecrã e no backend:

1. disponibilizar ação explícita para emitir/ativar cobrança de um rascunho;
2. endurecer `issueInvoice` para impedir transições inválidas/reemissões acidentais;
3. rever `sendInvoice` para não transformar silenciosamente um rascunho em emitido sem confirmação explícita;
4. testar emissão, envio, pagamento e estados inválidos de ponta a ponta;
5. manter as operações fiscais externas desativadas no ambiente QA.
