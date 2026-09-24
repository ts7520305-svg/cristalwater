# TASK328 — Exceções de calendário por instalação e data

O editor permite indicar uma data sem visitas ou substituir todos os horários habituais de uma instalação por horários próprios nessa data. A exceção tem motivo, técnico/ronda próprios e pertence à vigência do acordo. Pode acrescentar visitas numa semana inativa da cadência ou numa instalação sem regra nessa época. A mensalidade mantém-se; esta ação não representa um desconto ou cobrança suplementar.

Uma exceção por instalação/data, até 500 por acordo, com horários distintos e datas reais. Instalações alheias são recusadas mesmo em exceções sem visitas. A simulação, versão imutável, confirmação recuperável, bloqueios transacionais e proteção de visitas iniciadas/manuais continuam comuns ao calendário. Remover uma exceção exige nova versão e simulação; os registos antigos não são apagados. O motivo e a atribuição constam da proveniência das visitas próprias.

O rascunho conserva também o mês a planear. O teste de recarga revelou que a alteração isolada do mês não era persistida; a gravação foi corrigida sem tratar uma simples escolha de mês como alteração do acordo. Rascunhos antigos continuam legíveis. Motivos longos usam uma caixa com várias linhas, depois de o primeiro teste a 320 px detetar texto cortado num campo de linha única.

## Verificação

- 559 unitários/77 ficheiros, quatro técnicos e sintaxe 620 backend / 217 frontend / 62 scripts inline aprovados.
- Cinco testes unitários adicionais: precedência por data, semanas inativas, datas/horas inválidas e colisões, compatibilidade/preço e origem conservada.
- API em base descartável com 40 migrações: exclusão, substituição por dois horários, atribuição a outro técnico, instalação alheia, motivo alterado depois da simulação, confirmação concorrente, visita iniciada preservada, geração semanal sem duplicação e remoção recuperável da exceção. Regressões de cadências e do calendário de 24 meses aprovadas.
- Chromium real: exceção e mês recuperados após recarga; datas/horas e motivo confirmados no acordo; apresentação a 320/390/1440; regressões de resposta perdida, reenvio, offline e mudança de conta aprovadas. O primeiro ensaio falhou por apresentação, o segundo pelo mês perdido; o ensaio final passou com ambas as correções.

Ensaios locais PGlite/socket e Chromium, fornecedores desligados. Sem migrações/tabelas/dependências novas, cache v145. CI completo PostgreSQL 16 e restauro desta alteração ainda pendentes. Preço por visita permanece um requisito separado.


## Aprovação nativa do conjunto de calendário

TASK328 aprovada, incluindo as cadências da TASK327: código `b000c06d7dc178b960464b240d409e860cf52937`, árvore `06e34b4b51fc60ae0128021fd6478e8e674b2007`. [CI 36039651544](https://github.com/ts7520305-svg/cristalwater/actions/runs/36039651544), job `107768352309`, com 17 etapas e 229/229 grupos distintos previstos aprovados, 559 unitários/77 ficheiros, quatro técnicos, sintaxe 620/217/62 e 40 migrações. Job de 18:12:49Z a 18:42:07Z de 24/09/2026; restauro PostgreSQL 16 de 127 tabelas/46 ficheiros com linhas e hashes iguais. [Evidência](evidence/20260924_task328_ci.json). A falha inicial da TASK327 e a correção temporal posterior permanecem documentadas; esta aprovação aplica-se apenas ao código e árvore identificados.
