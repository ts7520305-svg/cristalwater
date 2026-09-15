# TASK132 — Conservar a última escolha de idioma ao recarregar

## Investigação

A publicação da TASK131 originou duas execuções do mesmo commit. O workflow 34969380298 aprovou os 37 grupos e restauro; o 34969361875 falhou na espera pelo texto português de recuperação do formulário da ficha, mantendo os restantes 36 grupos aprovados. A investigação identificou que a gravação de idioma só tinha uma fila em memória e que o ensaio herdava a preferência remota de outros testes.

Foi reproduzida uma falha concreta em `field-qa-runtime/run-1789476013301`: gravar alemão, reter a resposta, escolher português e recarregar. O português ficava na fila antiga; a página nova voltava ao alemão recebido do servidor. Resultado observado: última escolha pt, idioma após recarregar de.

## Correção

A escolha por sincronizar fica guardada localmente por conta, com idioma e identificador do pedido, sem credencial no registo. Ao reabrir, essa escolha prevalece sobre uma preferência remota antiga e é reenviada apenas pela conta a que pertence. Uma confirmação válida do idioma exato limpa apenas o pedido correspondente. Respostas perdidas ou diferentes conservam a escolha pendente. O regresso da ligação permite retomar a sincronização.

A fila continua ordenada dentro da página e ignora pedidos entretanto substituídos. Uma resposta de uma conta anterior não limpa nem aplica preferências da conta atual. Sem alteração de schema ou endpoint, nem nova dependência.

O teste de recuperação de lembretes passa a definir explicitamente português no seu ambiente isolado, em vez de herdar o idioma de outro grupo. Mantêm-se todas as verificações de recuperação, dados, repetição, idiomas e sessão; acrescentou-se diagnóstico do idioma/texto visível em caso de falha. Não se aumentaram os tempos de espera nem se acrescentaram tentativas automáticas aos testes.

## Verificação

Ensaio dirigido aprovado em `field-qa-runtime/run-1789476149709`: última escolha durante resposta anterior retida; recarregamento; resposta perdida depois da gravação; resposta com outro idioma; troca de conta; regresso à conta original; retorno da ligação. Os percursos de criação/recuperação de lembretes e do CRM também passaram nesse ensaio.

272 testes unitários em 54 ficheiros, 4 de técnicos e os 17 scripts de navegador aprovados. A bateria integrada inclui agora 38 grupos. Confirmar o workflow do commit final para a bateria integral PostgreSQL 16 e restauro; não usar o workflow da TASK131 como prova desta correção adicional.

## Ficheiros e limites

`frontend/cw-i18n.js`, `scripts/test-field-language-reload.js`, `scripts/test-field-reminder-lifecycle.js`, `scripts/test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.

A escolha pendente depende da conservação dos dados do navegador. Não há arbitragem global entre escolhas simultâneas em dispositivos diferentes. Não se modifica a conta de outra pessoa ou qualquer preferência de produção nos ensaios.
