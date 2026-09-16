# TASK205 — Recuperação da rota antiga por identidade

## Falhas e comportamento atual

A página antiga guardava `offline_visits` globalmente e usava uma chave por ID numérico como alternativa. Sem snapshot próprio podia apresentar a rota de outra conta. O merge voltava a incluir visitas já ausentes da resposta do servidor e sobrepunha nomes/coordenadas antigos aos dados recentes. A lista de fotos lia `VisitPhoto`, enquanto o endpoint devolvia `photos`.

A nova cache `cwLegacyRoute:v2:<identidade tipada>:<dia>` inclui conta, técnico, dia e instante da última consulta ao servidor. A validação recusa linhas de outra identidade, IDs repetidos, visita ativa/pendências alheias e JSON ilegível. Dados globais/numéricos anteriores permanecem intactos e não são importados por presunção. A página sem cache válida explica a indisponibilidade; não declara que o técnico está sem visitas.

As respostas atuais são verificadas por conta/dia, estado HTTP, lista e contagem apresentada. Só as visitas presentes na resposta atual entram na lista; nomes, coordenadas e fotos vêm dessa resposta. Pedidos completos removidos da lista permanecem na recuperação de envios, com o UUID original. A indicação de conclusão pendente vem do armazenamento de pedidos, não de um estado antigo da cache. Campos em edição conservam-se no Map existente durante atualização da página.

Quota ou corrupção não são tratadas como gravação offline bem-sucedida. Uma consulta falhada conserva a lista e cache anteriores, com aviso. Respostas fora de ordem não substituem a consulta mais recente; mudar de conta oculta a lista anterior sem apagar dados guardados. O cache é informativo e não prova que as atribuições ainda estão atuais durante a falta de rede.

## Data, localização e fotografias

O filtro partilhado dos dois endpoints diários usa a data planeada antes da data de criação, conservando visitas iniciadas ou terminadas no dia. Uma visita futura criada hoje deixa de aparecer como trabalho de hoje. Ambos os endpoints respondem `private, no-store`.

Coordenadas ausentes mantêm-se `null`, incluindo visitas extra; a página antiga pede confirmação da morada e impede navegação para valores presumidos. Coordenadas realmente iguais a zero continuam válidas. Fotos devolvidas em `photos` são apresentadas; foi verificada uma imagem real criada pelo endpoint autenticado, incluindo carregamento no navegador após atualização.

## Evidência

`test-field-legacy-route-recovery.js` cobre os dois endpoints, reload offline real, históricos globais/numéricos, titularidade, atualização de nome/fotografia, visita reatribuída com pedido pendente, erro HTTP/resposta de outra conta, quota/corrupção, resposta fora de ordem e mudança de sessão. Inclui navegação com coordenadas ausentes e com 0,0 efetivo. `legacy-route-cache.test.js` acrescenta nove casos de identidade e conservação de bytes.

Quatro grupos aprovados em `run-1789586324705`, incluindo regressões de fotografias/conclusões, sugestão de rota e alerta. Quatro regressões finais em `run-1789586467449`: nova recuperação, E2E dos perfis, GPS e sugestão por dia. 370 unitários/quatro técnicos aprovados. O runner passa a 109 grupos, sem migração nova; confirmar CI e restauro da árvore publicada.

## Limites e próximo trabalho

Os seis campos de visita ainda não submetidos não sobreviverão ao reload só por existir esta cache de rota: continuam no Map da página. A sua persistência é a tarefa seguinte. Esta alteração não revê a cache numérica do ecrã moderno, limites de paginação de todos os leitores, push físico ou emissões globais de eventos por outros módulos. Históricos sem identidade comprovada precisam de revisão; não há recuperação automática nem eliminação. Sem deploy, alterações em main ou afirmação de prontidão global.
