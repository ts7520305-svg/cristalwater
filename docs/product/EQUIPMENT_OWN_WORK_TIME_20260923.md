# TASK307 — tempos próprios das revisões de equipamento

## Resultado e limite

O técnico pode marcar início e fim enquanto realiza uma revisão de equipamento numa visita regular ou extra. O intervalo é opcional e só é enviado com as observações e a confirmação explícita da execução. Fica no recibo e histórico da manutenção, com instantes UTC, duração inteira em milissegundos, técnico e contexto original da visita. As horas são apresentadas com o fuso do dispositivo.

Esta etapa fornece a origem necessária à valorização posterior. Não calcula custos, não reparte salário, não cria consumos nem acrescenta horas aos totais financeiros. O intervalo pertence a uma atividade dentro da visita: a futura valorização terá de repartir o custo da visita, com orçamento comum, antes de o atribuir à manutenção. Tempos próprios dos lembretes de serviço e materiais continuam pendentes. Não é certificação independente de presença física.

## Regras verificáveis

- Início e fim explícitos e positivos, formato UTC canónico, dentro da visita iniciada, com técnico atribuído e fim não posterior à confirmação no servidor. Campos incompletos, datas normalizadas indevidamente e campos adicionais são recusados. O formato antigo sem contexto moderno não aceita tempos silenciosamente.
- Intervalos adjacentes são permitidos. Sobreposição com outra revisão da mesma visita é recusada sob o bloqueio do pai; pedidos simultâneos para planos diferentes não registam o mesmo intervalo duas vezes. A verificação comum da TASK305 deteta outros serviços do técnico, excluindo a própria visita que contém a revisão.
- Os registos mantêm REGULAR/EXTRA separados, mesmo com o mesmo ID. O técnico é o atribuído à visita e não um identificador fornecido livremente no pedido.
- Recibo original, execução, plano, histórico e auditoria são gravados na mesma transação. Repetições devolvem o mesmo recibo; uma recusa já confirmada continua recusada. Falha na auditoria ou recibo reverte todas as alterações.
- A consulta compara o registo com o recibo original e os horários/contexto atuais. Alteração ou remoção do tempo, mudança do pai ou conflito conhecido posterior exigem revisão e preservam o registo anterior. Uma revisão antiga sem tempo fica «Tempo próprio não registado», sem inventar duração zero.
- Rascunhos incluem início, mesmo sem notas, e fim; sobrevivem ao recarregamento. Web Locks e comparação do rascunho impedem sobreposição entre janelas; quota, corrupção, mudança de conta e confirmações incompletas preservam os dados. Só a confirmação do mesmo tempo limpa o rascunho. Um início sem fim impede o envio; limpar o tempo é uma ação explícita.
- Despesas, pagamentos, consumos, preços e decisões comerciais não são alterados. A fotografia de tempo usa o JSON já existente do recibo da conclusão; não há migração, tabela ou dependência nova.

## Validação local

Novo grupo de integração API/navegador: intervalos inválidos e futuros, formatos antigos, permissões, pais de ID igual, concorrência entre dois processos, adjacência, recuperação exata, alteração do pedido, rollback, origem posterior alterada, conflito com outro serviço, tempo alterado/removido, rascunho iniciado sem notas, recarregamento, duas janelas, sessão e confirmações com tempo ausente/duração/origem erradas. Controla que a operação não escreve nas tabelas financeiras, movimentos ou email.

Regressões aprovadas: fluxo de equipamento regular e extra, forma antiga de conclusão, rascunhos/recibos no navegador, atribuição manual de despesas e receita de manutenção. O percurso integral com formulários reais também marca início/fim e verifica a origem no recibo. Ecrãs revistos a 320/390/1440 px e no formulário real móvel. O relógio e os pedidos são locais ao ensaio; sem fornecedores ou contactos reais.

409 unitários/65 ficheiros; runner de 209 para 210 grupos. Mantém 35 migrações/126 tabelas. Cache v122. Sintaxe aprovada: 602 JS backend, 201 JS frontend e 62 scripts inline. Execução nativa e restauro confirmados no CI indicado abaixo.

## Publicação

Base `4fbae82733dc84e1909995e6c4aac0901cf04104`, fecho TASK306. Publicação apenas em `work/field-readiness-20260915-simulation`, sem força. Principal `feature/technicians-v25` preservada; sem merge ou deploy. CI/restauro desta versão confirmados conforme a evidência seguinte.

## CI e fecho

Código publicado `8af70dc573370101a8f6d3b9f712daf6008bddae`, árvore `c842074336a72e1f773b37bf3326e7ce9e8128bf`, igual à validada localmente. [CI 35919764440](https://github.com/ts7520305-svg/cristalwater/actions/runs/35919764440), job `107380430208`, aprovado entre 2026-09-23T21:01:10Z e 2026-09-23T21:29:28Z (28m18s). 17 etapas aprovadas; 210/210 grupos previstos distintos, sem falha, falta, entrada inesperada ou duplicação. 409 unitários/65 ficheiros, quatro testes técnicos, gate geral de navegador, sintaxe 602/201/62 e 35 migrações. Restauro PostgreSQL 16 de 126 tabelas/46 ficheiros, com linhas e hashes iguais.

Evidência completa em `evidence/20260923_task307_ci.json`, com os 210 resultados e hash SHA256 do log. A confirmação posterior altera apenas documentação e conserva o código e testes desta árvore.

Próxima etapa: valorização monetária com repartição explícita e orçamento partilhado entre visita e manutenção; tempos de lembretes e consumos próprios continuam abertos. Custos completos, receitas completas e lucro permanecem por apurar.
