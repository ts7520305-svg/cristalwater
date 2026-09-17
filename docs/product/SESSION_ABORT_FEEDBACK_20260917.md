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
- Árvore conjunta confirmada: commit `bc5e4e35efccf89c9bb085a2ff5749ecb82c4e62`, árvore `1b5d7378b1c89a03209e407dc43143e2b2a8cbea`, CI `35221384674`: 124/124 grupos, 388 unitários/quatro técnicos, 19 scripts de navegador, 20 migrações, sintaxe de 539 ficheiros e restauro de 110 tabelas/32 ficheiros com linhas/hashes iguais em PostgreSQL 16. A evidência corresponde a esse código; este registo posterior é documental.
