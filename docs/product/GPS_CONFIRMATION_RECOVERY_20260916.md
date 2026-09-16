# TASK200 — Confirmação e recuperação do GPS

## Resultado e reprodução

Os emissores antigos usam a mesma fila persistente por conta. Um ponto só sai dessa fila depois de receber HTTP 200 com confirmação da sua identidade, conteúdo e destino, ou reconhecimento explícito de que foi ignorado pela política de atualidade. A página GPS permite confirmar os pontos guardados sem captar uma leitura nova.

O diagnóstico de chave global/substituição da fila por snapshot no checkpoint anterior estava desatualizado: a TASK83 já tinha introduzido `cwGpsPoint:v2:<conta>:<UUID>` e isolamento por conta. Essa implementação foi conservada. A reprodução anterior à TASK200 demonstrou outra falha: HTTP 202 com `{unrelated:true}` eliminava o ponto e devolvia zero pendências. A validação anterior apenas recusava respostas HTTP negativas ou indicadores explícitos de falha.

## Contrato e conservação

- Pedidos com `pointId` exigem UUID, campos conhecidos, coordenadas/precisão numéricas e data original válida. A API confirma `GPS_READING`, UUID, conta, técnico, coordenadas, precisão, instante e um resultado: `RECORDED`, `OLDER_LOCATION` ou `STALE_LOCATION`. Pedidos antigos sem UUID conservam o contrato anterior.
- Cada leitura é validada, gravada e relida antes do transporte. Corrupção, quota ou campos incoerentes impedem o envio; os bytes já existentes ficam preservados. As chaves v2 da TASK83 permanecem válidas, sem migração. A antiga fila global não é atribuída à conta atual.
- A resposta precisa de corresponder a todos os campos originais. Respostas incompletas, HTTP 202/204, conta/UUID/conteúdo trocados ou resultado desconhecido conservam o ponto. A eliminação local verifica novamente o conteúdo e remove apenas aquela chave.
- Web Locks coordena o envio por conta entre janelas. Um lote lê até cem pontos; leituras captadas durante o transporte continuam pendentes. O mesmo instante original acompanha cada tentativa; o bloqueio transacional por técnico impede regressão da localização e duplicação do histórico nas tentativas ensaiadas.
- Mudança de credencial interrompe o observador e o transporte. Confirmações tardias não limpam a fila nem os indicadores da conta seguinte. Observadores substituídos e callbacks de obtenção anteriores a `pagehide` não voltam a captar. A expiração reconhecida pela autenticação central impede novo transporte até reentrada; a fila continua guardada.
- Localização atual e histórico continuam na mesma transação. O ensaio de falha na escrita do histórico conserva ambos os estados anteriores. Nenhuma tabela, migração ou dependência foi acrescentada.

## Percursos visíveis

`technician-gps` passa a usar o adaptador comum, apresenta pendências e acrescenta “Confirmar pontos guardados”. Só apresenta “Sincronizado” para uma leitura confirmada como `RECORDED`; leituras antigas reconhecidas pedem uma posição atual. A página técnica antiga conserva a utilização restante quando encontra GPS corrompido e deixa de anunciar sincronização completa quando há GPS pendente, sem atribuição ou em envio noutra janela.

O recurso de compatibilidade `gps.js` também usa o adaptador, sem técnico de recurso fixo nem coordenadas na consola. O service worker passa a v29 e inclui a página/emissor GPS no conjunto de recursos públicos. As mensagens alteradas seguem o português destes percursos; esta tarefa não demonstra tradução integral dos ecrãs antigos.

## Evidência local

| Ensaio | Resultado |
|---|---|
| Seis pedidos simultâneos em dois processos | Uma leitura registada e cinco reconhecimentos de leitura não mais recente; um ponto no histórico |
| Resposta perdida e reinício do processo | Mesma leitura confirmada no reenvio, sem segundo ponto no histórico |
| Payload inválido, técnico diferente, leitura antiga e falha SQL no histórico | Recusas/resultado explícitos; rollback integral de localização e histórico |
| Página GPS real: offline, resposta perdida, reload e quatro confirmações erradas/incompletas | Conteúdo original conservado; confirmação explícita recupera a pendência |
| Duas janelas, nova leitura durante envio e observador antigo | Envios coordenados; nenhuma substituição da fila por snapshot ou nova captura do observador parado |
| Quota, troca de conta com resposta tardia, retorno da conta original | Nenhum envio sem gravação; recuperação sem duplicar histórico |
| Retorno de página, callback manual tardio, GPS corrompido e fila global sem autoria | Controlos recuperados; dados conservados; página antiga utilizável sem falso estado de sincronização |
| Novo grupo e regressões GPS/sprint 4.4/T1 | Quatro grupos aprovados em `run-1789572891450` |
| Testes unitários / técnicos | 340 / 4 aprovados; 28 testes nos dois ficheiros GPS |
| Scripts independentes de navegador / sintaxe backend | 17 / 530 ficheiros aprovados |

`scripts/test-field-gps-recovery.js` integra o runner, que passa a **102 grupos**. Permanecem **17 migrações aditivas**. Este relatório antecede a publicação da TASK200: confirmar o CI nativo com PostgreSQL 16 e restauro da árvore publicada, incluindo igualdade de linhas e hashes. A base TASK198–199 foi confirmada no workflow `35110081844`, com 108 tabelas/22 ficheiros restaurados.

## Limites e próximo trabalho

A confirmação GPS descreve o processamento da tentativa, não um recibo imutável guardado por UUID. Um reenvio pode passar de `RECORDED` para `OLDER_LOCATION` ou `STALE_LOCATION`; não há proteção nova contra reutilizar o UUID com conteúdo diferente. A ausência de duplicação nos casos cobertos depende do instante original e da serialização por técnico.

A política existente de atualidade mantém-se: leituras com mais de cinco minutos são ignoradas, sem acrescentar histórico nem atualizar a localização. O reconhecimento explícito permite retirar essas pendências e a interface explica que é necessária uma posição atual. Esta tarefa não cria arquivo de trajetos offline prolongados nem altera a política de retenção.

Web Locks e armazenamento local funcional são necessários. Apagar os dados do navegador elimina as pendências locais. As outras filas antigas de visitas/fotografias não foram redesenhadas. Os ensaios usam geolocalização sintética; não comprovam GPS/bateria/background num telefone real nem prontidão global. Rever as restantes escritas usadas pelos ecrãs e confrontar qualquer lacuna antiga com o código e os relatórios posteriores antes de a retomar.
