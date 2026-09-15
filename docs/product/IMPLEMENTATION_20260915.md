# Entregas após a revisão de completude

## TASK 83 — GPS offline legado

O emissor antigo guarda cada ponto numa entrada imutável, separada por identidade autenticada, com data de medição e precisão. A confirmação remove apenas esse ponto: novos registos durante o envio ficam preservados. A credencial é capturada antes do pedido e uma resposta de outra sessão não confirma nem remove registos. Os pontos antigos da fila global não são atribuídos a alguém apenas por coincidência de ID; ficam preservados com aviso para apoio. Falhas HTTP, respostas negativas e erros de armazenamento não são anunciados como sincronização bem-sucedida. A página antiga deixa de anunciar sincronização completa enquanto o GPS tem pendências.

Ficheiros: `frontend/js/offline/offline-gps.js`, `frontend/technician.js`, `tests/legacy-gps-offline.test.js` e este documento. Oito testes cobrem novos pontos durante confirmação, mudança de conta, recusa HTTP/JSON, fila ilegível, dados antigos, falta de espaço, precisão/data e múltiplos watchers. Os testes passam; npm test passou 168 testes em 40 ficheiros, e os quatro testes de técnico passaram.

Limites: não converte automaticamente a antiga fila sem identidade inequívoca; não altera as filas antigas de fotografias e visitas. O GPS não é prova independente de presença física.
