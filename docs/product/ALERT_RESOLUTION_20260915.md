# TASK134 — Resolução segura dos alertas

## Reprodução

O PUT administrativo de resolução devolveu 200 e marcou um alerta técnico como RESOLVED enquanto o respetivo lembrete de água continuava aberto. Evidência: `field-qa-runtime/run-1789478946210/test-field-alert-resolution.log` (`waterStillOpen: true`). O mesmo código apagava o texto do problema de visitas impedidas, sem alterar o estado que as mantinha na lista; pedidos repetidos também podiam acrescentar notas ou alterar datas de resolução.

## Comportamento entregue

O controlador delega em `AlertResolutionBusiness`. As quatro origens aceites são notification, technical, visit e generic; o formato numérico antigo continua a identificar notificações. Prefixos desconhecidos, valores ambíguos e IDs fora do intervalo da base são recusados. A conversão para faturação reutiliza o mesmo parser estrito.

A água aberta e a bomba em manual exigem confirmação no respetivo lembrete operacional. A associação ao lembrete também protege alertas antigos com tipo genérico. Depois de o lembrete estar confirmado como concluído, um aviso histórico associado pode ser retirado sem alterar o estado físico ou a responsabilidade. Referências críticas sem associação verificável são recusadas. Visitas impedidas/incompletas, cobertura de visitas e manutenção preventiva devem ser tratadas no respetivo fluxo; a resolução genérica não executa esses serviços.

Cada resolução normal bloqueia a linha, valida a versão opcional e grava a alteração com um comprovativo na mesma transação. O comprovativo contém o registo original, administrador, data e resposta. Repetições exatas conservam a confirmação e não duplicam o comprovativo; um novo relato alterado rejeita a versão anterior. Nas visitas normais, apenas o campo de alerta é limpo: notas internas, medições e estado operacional são conservados, e o relato original fica no comprovativo. Uma falha ao gravar o comprovativo reverte a alteração.

O ecrã apresenta o contexto exato na confirmação, impede submissão repetida e envia a versão recebida na lista. Valida origem, ID, versão e data da confirmação. Respostas perdidas ou trocadas ficam por confirmar e permitem repetir; uma confirmação válida retira localmente apenas a versão tratada. Uma atualização falhada conserva o resultado conhecido e avisa que os restantes dados precisam de atualização. Mudanças de sessão antes ou depois do envio impedem a apresentação da resposta na sessão nova.

A criação de uma reparação com resolução do aviso usa a mesma confirmação validada. Se a reparação ficou criada mas a confirmação do aviso se perdeu, o ecrã indica claramente a reparação criada e permite tratar depois o aviso; não pede para criar novamente a reparação.

## Validação

Ensaio dirigido em `field-qa-runtime/run-1789479629638`: novo fluxo API/base/Chromium, visibilidade completa dos alertas e regressão de água/regressos aprovados. Inclui proteção física, associação com tipo legado, fecho pelo fluxo existente, avisos históricos após fecho, visitas impedidas, oito pedidos simultâneos por origem, alias numérico, versão alterada, referência desconhecida, duas ocorrências com dois comprovativos, rollback nas quatro origens e preservação do texto/autor/data.

No navegador: texto literal seguro, cancelamento, cliques repetidos, resposta perdida depois do commit, repetição, resposta trocada, alteração durante a confirmação, falha de refrescamento, reparação criada com confirmação de resolução perdida, mudança de sessão antes/depois do envio e larguras 320/390/1280 px. O ensaio `field-qa-runtime/run-1789479728066` identificou um botão disponível durante o fim da operação anterior. A sincronização do estado ocupado foi corrigida, sem aumentar timeouts ou acrescentar repetições aos testes. Revisão final aprovada em `field-qa-runtime/run-1789479845553`, incluindo o corpo malformado e a visibilidade dos alertas.

302 testes unitários em 56 ficheiros e 4 testes de técnicos; sintaxe de 495 ficheiros backend e dos scripts alterados. O novo grupo integra os 40 grupos da bateria operacional. Os 17 scripts de navegador passaram. Confirmar o workflow final do commit publicado para a bateria integral, incluindo PostgreSQL 16, atualização aditiva e restauro.

## Ficheiros

| Ficheiro | Responsabilidade |
| --- | --- |
| `src/business/admin/AlertResolutionBusiness.js` | Resolução transacional e comprovativo |
| `src/services/alertResolutionStateService.js` | Referência, versão e requisitos operacionais |
| `src/services/alertPresentationService.js` | Versão e requisito na lista |
| `src/routes/alertRoutes.js` | Delegação e erros HTTP |
| `frontend/admin-alerts.js` | Confirmação, recuperação e sessão |
| `tests/alert-resolution.test.js` | Referências, versões e requisitos |
| `scripts/test-field-alert-resolution.js` | Percurso API/base/navegador |
| `scripts/test-field-suite.js` | Registo do novo grupo |
| `docs/product/ALERT_RESOLUTION_20260915.md` | Este relatório |
| `docs/product/CURRENT_WORK_CHECKPOINT.md` | Continuidade |

## Limites

Clientes antigos que omitam expectedVersion conservam o comportamento de tratar o estado atual; não beneficiam da recusa de uma confirmação antiga, embora mantenham os bloqueios operacionais, transação e repetição segura. O ecrã atualizado envia a versão. Não se alteram o esquema, a entrega em segundo plano, o fluxo físico de fecho, a faturação ou a emissão fiscal. A criação da reparação e a resolução do alerta são duas operações distintas, com resultado parcial explicitamente apresentado. Os comprovativos não substituem a ficha operacional nem concluem visitas. O novo texto explicativo foi verificado em português; não se declara revisão integral dos outros idiomas. VPS e ensaios físicos não fazem parte desta validação.
