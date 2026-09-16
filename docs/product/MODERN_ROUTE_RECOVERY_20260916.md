# Recuperação da ronda no modo de campo — TASK207

## Falha reproduzida

O modo de campo usava `cwFieldRoute:<id numérico>` e aceitava a lista sem confirmar titularidade ou dia. Em `run-1789588893331`, a página real apresentou uma ronda histórica de 2020 injetada nessa chave quando a consulta atual devolveu 503. A asserção que proíbe atribuir esse histórico à sessão atual falhou antes da correção.

## Alteração

`cw-field-route-cache.js` usa a identidade tipada da sessão, o papel e o dia: `cwFieldRoute:v2:<conta>:<papel>:<dia>`. O registo contém titular, técnico, papel, dia e instante da consulta ao servidor, sem credenciais. Valida resposta, contagem, técnico, tipos de visita e IDs únicos por tipo; visitas REGULAR e EXTRA com o mesmo ID numérico continuam distintas. Históricos numéricos permanecem intactos e não são importados.

A página captura sessão/dia/ordem da consulta antes da rede. Respostas antigas ou de outra sessão não atualizam a ronda nem a cache. A resposta atual substitui a lista, retirando visitas reatribuídas; o armazenamento independente de conclusões pendentes é conservado. Recarga offline só aceita a cache da conta, papel e dia atuais e indica a data da consulta anterior, sem dar uma confirmação atual à revisão do dia.

Quota ou corrupção permitem apresentar uma resposta válida atual com aviso explícito de que a ronda não ficou guardada para uso offline. Bytes corrompidos ou com titularidade/papel errado não são sobrescritos. Respostas incompatíveis não substituem a cache. HTTP 401/403 não autoriza recuperar uma rota como se a consulta tivesse sido bem-sucedida.

As atualizações locais de início/conclusão/visita incompleta conservam o instante original da consulta ao servidor. Apoios e visitas de amanhã acrescentados à vista não se transformam na rota confirmada de hoje. Mudar de dia limpa a ronda apresentada e consulta a chave nova. Mudar de sessão oculta e desativa o conteúdo da página anterior, preservando os dados para a conta original. O service worker v35 inclui o módulo novo.

## Evidência

- `tests/field-route-cache.test.js`: doze casos, incluindo identidade User/Technician, papel/dia, corrupção, resposta incompatível, IDs iguais em tipos diferentes e atualização local sem alterar a data de confirmação.
- `scripts/test-field-modern-route-recovery.js`: ensaio integral aprovado em `run-1789589300581`; versão final com resposta tardia após mudança de conta e revisão visual aprovada em `run-1789589352377`.
- Regressões de fotografias/conclusões, rascunhos antigos e percurso completo técnico/cliente/ADMIN aprovadas em `run-1789589181047`. O primeiro ensaio do grupo novo nessa execução parou num seletor de teste `#list` inexistente; foi corrigido para o `#visitList` real e repetido sem retirar a verificação.
- 382 unitários e os 17 scripts independentes de navegador aprovados; sintaxe de 533 ficheiros backend aprovada. Revisão de largura a 320, 390 e 1440 px e captura `reports/field-ui/MODERN_ROUTE_OFFLINE.png`.
- Runner ampliado para 111 grupos, sem migração nova. Confirmar CI e restauro da árvore publicada; a aprovação da TASK206 não substitui esta validação.

## Reconciliação e limites

A suspeita de broadcast global dos eventos de rota não se confirmou no processo real: `installRealtimeAccess` substitui `global.io.emit` por emissão para `role:MANAGEMENT`. Não foi feita uma segunda correção desse ponto. A seleção de destinatários em módulos novos continua a exigir a sua própria revisão.

Este lote trata a ronda, não todos os armazenamentos do modo de campo. Rascunhos modernos, visitas incompletas, documentos e lembretes ainda têm chaves/contratos próprios; a revisão de identidade e conservação desses dados continua no inventário. O guard atual da página também restringe a entrada a TECHNICIAN, apesar de o contrato partilhado reconhecer TEAM_LEADER. Limites de paginação dos leitores não foram alterados.

Cache offline não prova atribuição atual; não sincroniza dispositivos nem recupera dados que já foram apagados. Sem ensaio prolongado em telefone real, deploy, alterações em main ou declaração de conclusão global.
