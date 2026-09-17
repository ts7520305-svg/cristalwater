# TASK227 — Cancelamento de pedido por mudança de sessão

## Reprodução

A regressão local durante a TASK226 encontrou `signal is aborted without reason` em vez da mensagem de mudança de conta. O caso foi intermitente quando a resposta retida chegava antes do monitor de sessão; esperar pelo cancelamento antes de libertar a resposta reproduziu a falha de forma determinística.

## Correção

O tratamento de falhas em `CWFieldWriteStore.send` verifica a identidade antes de atualizar o estado de falha e novamente depois da atualização. Se a conta mudou, apresenta a mensagem existente para reabrir a conta original e conservar o envio. Um cancelamento de `fetch` deixa assim de esconder o motivo da interrupção.

Não altera UUID, conteúdo, titularidade, confirmação, política de repetição ou filas persistidas. Não atualiza a fila da nova conta nem interpreta o cancelamento como confirmação. Falhas de rede na mesma sessão continuam a usar o tratamento anterior.

## Evidência

- Reprodução determinística no teste de sessão: upload retido, troca de conta, cancelamento antes da resposta e erro técnico confirmado.
- O mesmo teste mantém as verificações de preservação das fotografias das duas contas, ausência de conclusão cruzada, regresso à conta original e recuperação do pedido.
- Os 19 scripts de navegador passaram, incluindo cancelamento determinístico, ambas as filas de fotografias e recuperação na conta original. A primeira repetição sem controlar a ordem também passou, confirmando a corrida que o ensaio final agora força.
- `run-1789647623689`: recuperação de escritas API, interface e E2E completo aprovados após a correção.
- Confirmar CI/restauro da árvore conjunta TASK226–227 antes de declarar o lote fechado.
