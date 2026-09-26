# TASK375 — Revisão das regras globais de alerta

## Comportamento

`/operational-risk-rules` oferece à administração uma revisão própria das regras de avisos visuais. A entrada está na frota, mas o âmbito é global: inclui pagamentos, guias, seguro/inspeção, materiais, pendências e associação de riscos aos técnicos. A página explica que desligar uma regra apenas oculta o aviso; não resolve a situação nem envia mensagens.

Cada um dos doze campos exige uma decisão: manter, alterar ou usar o predefinido. Manter conserva também a ausência de um valor guardado. Usar o predefinido remove apenas a substituição desse campo, mostrando o valor que ficará em vigor. Alterar grava apenas o valor escolhido. A edição conserva chaves adicionais; a substituição integral é explícita e conserva o original completo no histórico auditado.

- Configuração ausente e configuração parcial identificam os predefinidos aplicados, sem escrever durante a leitura. Configuração completa, inválida e acima do limite são estados distintos.
- Booleanos são explícitos, incluindo falso. Dias inteiros de zero a 3650 e limiar de stock de zero a um milhão com até seis casas decimais. Sem coerção de textos, campos vazios ou formatos exponenciais. Zero permanece zero.
- O limiar de stock continua a comparar cada quantidade na sua unidade existente; não converte unidades. Os avisos continuam a depender dos dados operacionais e da elegibilidade já existente no motor.
- Um objeto antigo com um campo inválido pode ser reparado nesse campo, conservando os restantes. Conteúdo não interpretável exige substituição explícita. Revisões sem alteração efetiva são recusadas.
- A revisão mostra âmbito, motivo, valor guardado, valor efetivo anterior/final, operação e origem guardada/predefinida para cada campo. A página permite consultar o texto original exato.
- Registo, auditoria e comprovativo conservam texto anterior, notas, identidade e data de criação; atualizar altera apenas conteúdo e data de atualização. A criação não inventa notas.

O formulário antigo da frota apresenta as regras apenas para consulta e encaminha para a revisão. O acesso à revisão continua disponível quando o resumo dos alertas está indisponível, permitindo corrigir uma configuração inválida. O PUT antigo e as escritas individuais/em lote nas configurações gerais recusam esta chave com 409, antes de alterar dados.

## Gravação e leitura

Configuração, auditoria e comprovativo por conta/UUID são gravados na mesma transação. A autoria vem da sessão autenticada. Prova assinada de cinco minutos, vinculada à proposta e ao registo exato, incluindo notas/datas. Bloqueio da chave global protege criação e edição concorrentes. Uma alteração simultânea exige nova revisão.

Perda de resposta, reinício e repetição concorrente recuperam o resultado original. Anulação persistente impede confirmação tardia. A referência mínima por conta fica no separador; motivo, valores e prova ficam em memória. Troca de conta, expiração, suspensão, referência corrompida, armazenamento indisponível e respostas incompletas não confirmam operações indevidas.

O resumo e a leitura das regras usam o mesmo contrato. Conteúdo inválido deixa de aparecer como predefinidos válidos. Falhas reais das leituras operacionais deixam de ser convertidas em listas vazias. O componente partilhado nas páginas administrativas deixa de recalcular um resumo alternativo com predefinidos após falha; mostra indisponibilidade e limpa marcações antigas. Respostas privadas sem cache, apenas para administradores.

A configuração tem um limite de 200 000 caracteres e limites de profundidade/volume dos dados adicionais. Conteúdo acima do limite permanece conservado e exige tratamento próprio. Este lote não redesenha todo o motor de riscos: continuam pendentes a revisão dos limites existentes de 200 pendências/500 faturas por resumo, a classificação de dados históricos e a validação com volume real.

## Validação

918 testes unitários em 112 ficheiros, incluindo 14 novos; quatro testes técnicos; sintaxe de 681 scripts backend, 291 frontend e 44 inline. Oito grupos locais distintos aprovados:

1. Regras API: permissões; leitura sem escrita; ausência/parcial/inválido; falsos/zeros/decimais; preservação de originais/notas/chaves adicionais/omissões; bloqueio dos escritores antigos e gerais; seis reversões SQL em criação/atualização, auditoria e comprovativo; duas criações concorrentes e duas edições concorrentes; perda/reinício/repetição; notas concorrentes, expiração e anulação; efeito real de desligar/restaurar uma regra no resumo; reparação/substituição; volume e indisponibilidade real de tabelas.
2. Regras no navegador: entrada real da frota; valores guardados/predefinidos; manter/alterar/predefinido; revisão do âmbito global; texto escapado; duplo clique; perda/recarregar/offline/repetir/anular; alterações concorrentes; armazenamento/sessões; reparação de campo inválido e substituição explícita; outra página administrativa sem resumo alternativo após falha.
3. Frota API.
4. Frota no navegador, incluindo campos de regra só de consulta, entrada na revisão e ausência de escrita antiga.
5. Configurações/permissões API.
6. Administração antiga/permissões API.
7. Preferências e navegação no navegador.
8. Simulação mensal pela API: cinco clientes, nove equipamentos, 54 visitas, 60 movimentos de consumo, seis reparações, cinco faturas e pagamentos totais/parciais, mensagens e notificações internas QA.

Dezoito capturas da nova revisão em português, inglês, francês, espanhol e alemão, larguras 320/390/1440 e controlos de 44 px. Revistas visualmente `de-320.png` e `review-pt-1440.png`. Os testes de preservação comparam obras, guias, materiais, stock, custos, faturas/pagamentos, notificações, pendências, mensagens e bytes do documento oficial antes/depois da configuração.

A simulação de indisponibilidade renomeia temporariamente tabelas apenas em QA. A primeira execução encontrou a quebra de ligação PGlite após uma dessas renomeações; cada cenário passou a usar um processo API novo, mantendo a autenticação real e a expectativa 503. O grupo completo foi repetido com sucesso. Uma chamada local usou um nome inexistente de script de navegação; não foi contada como aprovada. O script correto de preferências/navegação e a simulação mensal foram executados depois e aprovados.

QA isolada com dados sintéticos, PGlite 0.5.8/socket 0.2.11 e Chromium 153. Nenhuma migração nova; 43 existentes e 128 tabelas esperadas. PGlite não substitui a prova de concorrência em PostgreSQL nativo. Evidência: `evidence/20260926_task375_local.json`. Inventário: 125 HTML, 118 de raiz/sete auxiliares, 113 com referência literal em 307 scripts ativos, 12 sem referência literal, nenhum recurso em falta e dois recursos rastreados indisponíveis na cópia local.

## Publicação e próximo ponto

Lote preparado para a branch `work/field-readiness-20260915-simulation`. Runner com 286 grupos; cache v186. Gate PostgreSQL nativo e restauro deste lote ainda não confirmados.

TASK373 confirmada: [CI 36218570468](https://github.com/ts7520305-svg/cristalwater/actions/runs/36218570468), job `108339358313`, 282/282 grupos esperados distintos, 17 etapas aprovadas e restauro de 128 tabelas/47 ficheiros com linhas e hashes iguais. [Evidência nativa](evidence/20260926_task373_ci.json). TASK374: [CI 36220493972](https://github.com/ts7520305-svg/cristalwater/actions/runs/36220493972), job `108344709185`, ainda em execução na última consulta; 284 grupos/restauro por confirmar.

Continuar na abertura antiga de guia de obra e na quilometragem: o percurso permite atualizar a leitura sem a revisão e as garantias de recuperação próprias. Rever identidade/atribuição, origem dos materiais, nulo/zero, leitura não decrescente, estado da obra, auditoria e confirmação recuperável. Volume/qualidade do resumo de riscos, conciliação histórica, arquivo/cópias operacionais, VPS e piloto físico permanecem abertos. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
