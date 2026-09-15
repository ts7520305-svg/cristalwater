# Entregas após a revisão de completude

## TASK 83 — GPS offline legado

O emissor antigo guarda cada ponto numa entrada imutável, separada por identidade autenticada, com data de medição e precisão. A confirmação remove apenas esse ponto: novos registos durante o envio ficam preservados. A credencial é capturada antes do pedido e uma resposta de outra sessão não confirma nem remove registos. Os pontos antigos da fila global não são atribuídos a alguém apenas por coincidência de ID; ficam preservados com aviso para apoio. Falhas HTTP, respostas negativas e erros de armazenamento não são anunciados como sincronização bem-sucedida. A página antiga deixa de anunciar sincronização completa enquanto o GPS tem pendências.

Ficheiros: `frontend/js/offline/offline-gps.js`, `frontend/technician.js`, `tests/legacy-gps-offline.test.js` e este documento. Oito testes cobrem novos pontos durante confirmação, mudança de conta, recusa HTTP/JSON, fila ilegível, dados antigos, falta de espaço, precisão/data e múltiplos watchers. Os testes passam; npm test passou 168 testes em 40 ficheiros, e os quatro testes de técnico passaram.

Limites: não converte automaticamente a antiga fila sem identidade inequívoca; não altera as filas antigas de fotografias e visitas. O GPS não é prova independente de presença física.

## TASK 84 — configurações com comportamento verdadeiro

PWA, proteção offline e aprovação humana das ações IA são capacidades fixas desta versão. A API devolve o valor efetivo e recusa tentativas de desligar essas capacidades; os valores antigos guardados não se sobrepõem ao comportamento efetivo. Um pedido bulk com uma dessas opções é recusado antes de gravar as restantes opções. A interface deixa de mostrar interruptores inoperantes para PWA/offline. Os estados de IA e segurança usam a mesma fonte para indicar aprovação humana obrigatória.

Ficheiros: systemSettingService, settingsRoutes, aiAdminController, securityController, admin-operational-settings.html, test-field-access-api e este documento. Testes de API aprovados em `settings-capabilities.log`: configurações fixas devolvem 409 na alteração e true na leitura; bulk recusado não altera a outra chave. As opções de preparação de mensalidades e lembretes ficam desligadas por defeito. Não se apaga nenhum trabalho offline.
