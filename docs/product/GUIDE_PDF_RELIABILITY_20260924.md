# TASK335 — PDFs operacionais legíveis e identidade das guias

## Resultado

As guias de transporte, a última guia da viatura, as guias de obra e as fichas de seguro passam a usar as fontes Unicode já distribuídas pela aplicação. A normalização só afeta o PDF: conserva os registos originais. Caracteres sem suporte recebem uma indicação explícita `[U+…]`, acompanhada de uma explicação, em vez de desaparecerem.

O gerador partilhado prepara o documento completo antes de enviar a resposta, conserva notas extensas, mantém as linhas correntes juntas quando cabem numa página, repete o cabeçalho e numera todas as páginas. As datas usam `Europe/Lisbon`. As respostas incluem `private, no-store` e `nosniff`. Continuam disponíveis as mensagens de seguro não registado e de guia provisória.

A revisão encontrou uma divergência entre o caminho bruto usado pelo controlo de viatura e os parâmetros descodificados e convertidos em números usados pelos controladores. A validação anterior ao controlo recusa IDs alternativos (sinal, zero inicial, decimal, expoente, codificação percentual e valores fora de Int32) e diferenças de maiúsculas nas rotas com identidade. Abrange também os metadados das guias, seguro e stock; conserva as ações nomeadas de início/consumo/atribuição e as permissões existentes.

Não há migrações, dependências, alterações do stock, pagamentos, faturas, comprovativos ou ficheiros oficiais anexados. Os PDFs continuam a representar os registos operacionais; não criam documentos fiscais nem substituem os anexos oficiais.

## Validação local

- 579 testes unitários em 79 ficheiros, incluindo Unicode latino/grego/cirílico, caracteres sem suporte, notas maiores que uma página, contagem exata de páginas e ausência de resposta parcial após falha.
- Quatro testes técnicos; sintaxe de 623 ficheiros backend, 218 frontend e 62 scripts inline. As últimas alterações pontuais também passaram `node --check`.
- Cinco grupos distintos de API/Chromium aprovados: `test-field-guide-pdf.js`, `test-field-document-recovery.js`, `test-field-write-recovery.js`, `test-field-client-services-ui.js` e `test-field-client-service-pricing.js`.
- Quatro endpoints PDF: administrador e técnico da viatura; recusas sem sessão, por cliente e por técnico de outra viatura; IDs alternativos, ausência de documento, guia provisória e seguro ausente. Comparação integral dos registos antes/depois, incluindo datas de atualização, consumos, stock e contagens financeiras/comprovativos.
- Seis páginas revistas visualmente: transporte (1), obra (3), seguro com notas extensas (2). A última guia reproduz a mesma apresentação do transporte. Datas finais regeneradas e verificadas.
- Editor de serviços e preços por visita: recuperação, versão original, nomes completos, textos literais e larguras 320/390/1440. O ensaio de consumo conserva o início/fecho, os recibos, as fotografias e a recuperação de falhas.

Ambiente isolado local: PGlite com protocolo PostgreSQL, Chromium e 40 migrações aditivas. Não é um restauro nativo PostgreSQL 16. Runner alargado de 231 para 232 grupos; aprovação completa e restauro do novo código dependem do CI.

## Falhas anteriores de CI resolvidas no ensaio

Os CI da TASK332 (`36042944183`) e TASK333 (`36043258018`) executaram 230 grupos distintos: 229 passaram e apenas `test-field-client-services-ui.js` falhou. Um seletor antigo de nomes completos recolhia também a nova descrição da forma de cobrança. O teste passa a selecionar os nomes dentro da regra e verifica separadamente a descrição da cobrança. Não altera a aplicação nem remove verificações de conteúdo, recuperação ou acesso.

As evidências originais permanecem em [TASK332](evidence/20260924_task332_initial_failure.json) e [TASK333](evidence/20260924_task333_initial_failure.json). Em ambos, o restauro foi omitido. A correção e o percurso de preços passaram localmente; confirmar o CI integrado antes de declarar aprovação desses lotes. Uma primeira chamada local usou um nome inexistente para o teste de preços; a invocação corrigida executou os três grupos previstos e terminou com código zero.

Base de trabalho: `81d543938f95aa68fb253d4cb7847fd5d91dc1b7`. Publicação apenas em `work/field-readiness-20260915-simulation`, sem merge, deploy ou contactos reais. [Evidência local](evidence/20260924_task335_local.json).

## Publicação

Publicada em `4325bf01e173b3f94df42f2281aebf3de5f7f0c5`, árvore `a7c9a7a0548ad718383c90d2b795dd55f6a96849`, idêntica à validada localmente. [CI 36048130043](https://github.com/ts7520305-svg/cristalwater/actions/runs/36048130043) em execução; aprovação completa e restauro por confirmar.


## Resultado do CI inicial

O CI `36048130043`, job `107796650083`, terminou com 231/232 grupos distintos aprovados. Apenas `test-field-extra-execution.js` falhou: uma visita ambígua criada no ensaio histórico anterior mantinha a cobrança EXTRA por omissão e bloqueava corretamente a consulta comercial global. A TASK337 torna essa fixture explicitamente sem cobrança e conserva o bloqueio e a divergência histórica. A sequência dos dois ensaios passou integralmente em API/Chromium, também depois da integração da TASK336. O seletor do editor corrigido nesta TASK335 passou no CI. Restauro omitido nessa execução; [evidência inicial](evidence/20260924_task335_initial_failure.json). Novo código e CI constam da [TASK337](FINANCIAL_DOCUMENT_PDF_RELIABILITY_20260924.md).
