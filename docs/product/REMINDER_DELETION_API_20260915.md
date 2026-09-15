# TASK129 — Eliminação de lembretes com destino e versão verificados

## Problema reproduzido

A rota DELETE da ficha arredondava identificadores decimais e aceitava qualquer categoria da piscina. O ensaio `field-qa-runtime/run-1789472795963` devolveu 200 ao eliminar `id.5` e um lembrete GENERAL. Ambos os registos foram indevidamente removidos na base descartável.

## Alteração

A rota delega a eliminação na Business. IDs positivos dentro do intervalo PostgreSQL são validados sem arredondamento; só as categorias TECHNICAL_PERIODIC_SERVICE e POOL_SERVICE_REMINDER da piscina indicada são elegíveis. A validação de IDs/categorias é partilhada com criação e conclusão. Mantém-se autorização administrativa.

A operação bloqueia o identificador e a linha numa transação. Uma versão `expectedUpdatedAt` diferente devolve 409. A eliminação e o comprovativo ficam na mesma transação, reutilizando OperationalReminder concluído, sem destinatário. O comprovativo guarda o registo original, ator e resposta. Repetições reconhecem a eliminação original, com data estável; outra piscina ou versão é recusada. O bloqueio da linha é partilhado com a conclusão, impedindo que uma confirmação antiga elimine uma ocorrência entretanto concluída.

Sem alteração de schema ou migração. Mantêm-se `ok`, `deleted`, `reminderId`; acrescentam-se piscina, versão e data da eliminação. Clientes legados que omitam `expectedUpdatedAt` mantêm a eliminação do registo atual; a proteção contra confirmação antiga depende do envio da versão, a ligar nos dois ecrãs na TASK130. A cópia de auditoria não é uma funcionalidade de restauro pela interface.

## Verificação

Teste integrado dirigido aprovado em `field-qa-runtime/run-1789473148930`: IDs inválidos, categoria geral, piscina errada, inexistência, sessão ausente, técnico recusado, versões inválidas e alteradas, oito eliminações simultâneas com um comprovativo, repetição antiga, rollback real por trigger de falha, conclusão antes/depois de eliminar e quatro disputas simultâneas. Os percursos existentes de conclusão e criação também passaram nesse ensaio.

Não se eliminam visitas nem histórico técnico. Ensaios executados em QA local descartável; PostgreSQL nativo e restauro serão confirmados no workflow do lote publicado.

Antes do commit: 272 testes unitários em 54 ficheiros, 4 testes de técnicos, sintaxe de 491 ficheiros backend e do novo script aprovados. A nova bateria integrada tem 36 grupos.
