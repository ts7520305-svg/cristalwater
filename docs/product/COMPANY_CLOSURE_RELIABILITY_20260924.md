# TASK341 — Encerramentos com confirmação recuperável

## Resultado

A página `/admin-company-closures` deixou de enviar alterações sem identificação. Criar, editar pela API, ativar, cancelar e gerar avisos usam agora a versão revista do encerramento, um pedido único e um comprovativo durável no protocolo existente `FieldWriteRequest`. Pedidos repetidos devolvem o mesmo resultado; reutilização do ID com conteúdo diferente é recusada. Pedidos concorrentes sobre uma versão antiga não se sobrepõem silenciosamente.

O pedido é conservado antes do envio, separado por conta e sem guardar o token. A falta de espaço bloqueia o envio. Após perda de ligação, resposta incompatível ou recarregamento, o botão de confirmação consulta o comprovativo e só repete o mesmo pedido quando necessário. A mudança de conta ou expiração limpa os dados visíveis, conservando o pedido e o rascunho para a conta original. Nenhuma recuperação é enviada automaticamente.

O autor e a aprovação vêm da sessão autenticada, não do corpo do pedido. A auditoria e o comprovativo são gravados na mesma transação da alteração. Uma falha de auditoria desfaz a alteração. Os metadados anteriores, o autor original e os avisos já emitidos são conservados; o motivo de cancelamento fica na auditoria. Fechar o diálogo ou indicar um motivo vazio não cancela o encerramento.

Os novos intervalos usam dias UTC válidos, incluindo o último dia até 23:59:59.999. Intervalos anteriores não são reescritos: a prévia consulta os instantes efetivamente guardados. Estados, tipos, opções, comprimentos e identificadores são validados. Os URLs anteriores continuam disponíveis, mas gravações antigas sem pedido/versão recebem 428 e exigem revisão na interface atual.

## Avisos e âmbito operacional

A geração exige um encerramento ativo e uma ação explícita. Existe no máximo uma emissão por encerramento, incluindo deteção de avisos antigos. Destinatários cliente têm de estar ativos, não eliminados e com arquivo ativo; a opção técnica conserva o aviso de papel da equipa existente. A emissão sem destinatários é recusada, sem consumir uma emissão futura. As datas dos modelos são substituídas apenas no aviso produzido, conservando a mensagem original.

O pedido cria registos de notificação na aplicação; não chama fornecedores de email/WhatsApp nem executa envios externos neste ensaio. Cancelar o encerramento não apaga avisos anteriormente criados, facto agora apresentado no diálogo.

As opções de pausa, serviços críticos, portal e ação de rondas continuam a ser preferências guardadas. **Este módulo não pausa nem reagenda visitas automaticamente e não acrescenta integração no portal cliente.** A interface deixou de apresentar essas preferências como ações já executadas. A consulta `/active` continua administrativa e exige estado explicitamente ativo, sem alargar permissões.

O endpoint de impacto anterior consultava `priority` e `visitType`, campos inexistentes em `ServiceVisit`. A prévia passou a ler as visitas regulares reais no intervalo. A prioridade fica explicitamente por confirmar; não são inventados zero serviços críticos ou uma classificação normal de todas as visitas. As visitas e os valores financeiros permanecem inalterados.

## Consulta e apresentação

A lista tem identidade/versão, filtros exatos e cache privada. Falhas são 503 sanitizados, sem listas vazias de substituição. O limite de 100 encerramentos é assinalado e existem filtros de datas/estado. A prévia distingue o limite de 500 visitas de um resultado completo. Dados, vazio confirmado, erro, parcial, mudança de filtros e respostas tardias têm estados próprios.

Texto histórico é apresentado como texto, sem interpolação HTML executável. Foram revistos o contraste e as larguras 320/390/1440. Os atalhos antes chamados “Obras” e “Planeamento operacional” foram corrigidos para “Férias e encerramentos”, mantendo os mesmos destinos e permissões. Um caso de restauração tardia dos filtros pelo navegador após recarregar passa a repetir a leitura para os valores realmente visíveis.

## Validação local

- 606 testes unitários em 83 ficheiros, quatro testes de técnico e sintaxe 628 backend / 221 frontend / 62 scripts inline.
- Três grupos integrados aprovados: `test-field-company-closures.js`, `test-field-legacy-admin-access.js` e `test-administration-os-operational.js`.
- API: recusa de contas sem permissão, data final inclusiva, campos estritos, autor da sessão, originais conservados, duas criações simultâneas com o mesmo pedido, duas ativações concorrentes, versão desatualizada, isolamento do comprovativo por conta, rollback de auditoria, emissão única, destinatário inativo excluído, modelos e limites.
- Chromium: dados/vazio/parcial/erro, modelos indisponíveis, identidade errada, HTML inerte, impacto sem classificação inventada, resposta perdida depois de gravar, recarregamento/recuperação, diálogo fechado/vazio sem mutação, conflito, resposta tardia de filtros, quota, comprovativo incompatível, timeout, offline e troca de conta.
- Visitas, instantes, metadados anteriores e contagens financeiras comparados antes/depois. A limpeza do ensaio atinge apenas as suas próprias fixtures e comprovativos.
- O teste estático antigo foi atualizado para a extração do serviço e passou. Não substitui os ensaios de comportamento.

Ambiente isolado: PGlite, Chromium normal e 40 migrações aditivas existentes. Sem nova migração, tabela ou dependência. Cache v153; runner com 238 grupos. A prova de concorrência local não substitui o CI PostgreSQL nativo deste commit.

## Continuidade confirmada

TASK339 aprovada no [CI 36054372854](https://github.com/ts7520305-svg/cristalwater/actions/runs/36054372854): 236/236 grupos esperados distintos, 17 etapas e restauro de 127 tabelas/47 ficheiros, com linhas e hashes iguais. TASK340 aprovada no [CI 36057362407](https://github.com/ts7520305-svg/cristalwater/actions/runs/36057362407): 237/237 grupos, 17 etapas e restauro de 127 tabelas/47 ficheiros. [Evidência TASK339](evidence/20260924_task339_ci.json) e [TASK340](evidence/20260924_task340_ci.json), com comparação integral ao runner de cada commit.

Inventário: 115 HTML; 78 páginas com referência literal nos 259 scripts ativos e 37 na fila de pesquisa. As referências não constituem prova de cobertura completa. A revisão visual deste lote é PT, não equivale à tradução nos cinco idiomas; as duas imagens de marca não materializadas localmente continuam identificadas no inventário.

## Publicação e retoma

Base `0b3ef23a4cb769c79150d36c0329c5478ec17270`; preparada para publicação na branch `work/field-readiness-20260915-simulation`. CI e restauro do novo código ainda por confirmar. [Evidência local](evidence/20260924_task341_local.json).

Continuar a fila de páginas e os critérios históricos, financeiros e multilingues ainda abertos. O reagendamento operacional e a integração dos encerramentos no portal são trabalhos separados, não capacidades declaradas como concluídas por este lote. Sem merge, deploy ou contactos reais.
