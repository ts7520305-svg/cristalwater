# TASK254–256 — Serviços, calendário e mensalidade por época

## Âmbito implementado

A clarificação do proprietário em 18/09/2026 é vinculativa: **três visitas é um exemplo, não um limite ou uma regra comum a todos os clientes**. Cada cliente, época e instalação tem o seu número contratado, serviços, dias, horários e atribuição. O editor aceita frequências semanais ou mensais, incluindo várias visitas no mesmo dia em horários diferentes. O limite de validação é 168 ocorrências por regra/período, para limitar pedidos desmesurados; não é um plano comercial predefinido. Os testes incluem seis e catorze visitas semanais.

O editor está em Configuração por Cliente, na secção «Serviços e visitas por época». Seleciona cliente, instalações, técnicos e rondas pelo nome. Atribuições indisponíveis são identificadas para revisão. O número de visitas nunca multiplica automaticamente a mensalidade.

O acordo usa versões imutáveis de `ClientRatePlan`: preço, serviços e calendário ficam na mesma versão. As épocas cobrem os doze meses, podem atravessar dezembro e repetem-se dentro das datas de vigência. Há épocas sem visitas e mensalidades zero. Início/fim a meio do mês conservam a proporcionalidade diária existente. Esta entrega suporta **mensalidade total do contrato, sem IVA**, incluindo as instalações indicadas; preços avulsos, exceções datadas e cadências quinzenais não foram acrescentados ao editor sazonal.

## Simulação e aplicação

- A simulação administrativa não cria versões, visitas ou documentos. Mostra valor mensal, datas, alterações, cancelamentos, preservações e pendências.
- Guardar aplica a nova versão, preenche o mês explicitamente simulado e revê todas as visitas automáticas futuras já existentes. Outros meses novos são preenchidos pela simulação mensal ou pela geração semanal existente; não se cria silenciosamente uma agenda ilimitada.
- Apenas visitas geradas por este acordo, ainda não iniciadas/concluídas/faturadas e sem alteração manual de data ou atribuição, são atualizadas/canceladas automaticamente. O estado anterior continua recuperável pela versão do acordo e pelo registo da visita; não se apagam visitas.
- Visitas antigas sem proveniência suficiente, manuais, reagendadas, iniciadas ou concluídas são preservadas. As que bloqueiam uma data aparecem para revisão. Sem horários completos, técnico ativo, atribuição inequívoca ou ficha operacional, não se inventa planeamento confirmado.
- Um token de simulação cobre versão, payload, contexto da agenda, atribuição e visitas observadas. Alterações entre simular e confirmar exigem nova revisão. Gravação, visita, receção do técnico, auditoria e comprovativo do pedido são transacionais.
- Pedidos UUID por conta/cliente devolvem a confirmação original em repetições, inclusive depois de uma revisão posterior. Reutilização com conteúdo diferente é recusada. A interface conserva rascunhos por janela/cliente, pedido partilhado entre janelas e confirmação verificada; falta de armazenamento bloqueia o envio.
- Os horários usam `Europe/Lisbon` independentemente do fuso do servidor. Dias mensais 29–31 são antecipados para o último dia dos meses mais curtos. Colisões decorrentes dessa antecipação são recusadas. Horas inexistentes na mudança de hora ficam pendentes.

## Integração

O gerador semanal consulta a regra de cada dia, incluindo semanas que cruzam meses/épocas. A frequência antiga de piscina/ronda deixa de gerar visitas para clientes com um acordo sazonal. Uma ronda selecionada fornece a atribuição vigente, respeitando a janela da ronda; os dias contratados vêm do acordo. A geração semanal apenas acrescenta visitas em falta; revisões/cancelamentos exigem a simulação administrativa. As pendências são indicadas no resultado e no ecrã de rondas.

`ServiceVisit.contractService` conserva versão, época, serviços e proveniência da data/atribuição, sem montantes monetários. É uma coluna JSONB aditiva, 21.ª migração do percurso de validação; visitas anteriores conservam `null`. Visitas incluídas são excluídas da cobrança avulsa automática mesmo que um percurso antigo lhes atribua `revenue`. O Finance OS também recusa referências de serviço avulso a essas visitas. Os percursos mensais registam a versão/fontes do preço; documentos existentes não são recalculados.

## Verificação local

- 395 testes unitários/63 ficheiros aprovados, incluindo dois anos completos, ano bissexto, épocas cruzadas, meses reais, vigência/proporções, horários múltiplos e três fusos do servidor.
- API e base: permissões ADMIN, piscina alheia, concorrência/reenvio, 24 meses reais, seis confirmações simultâneas, valores mensais, três geradores financeiros, preservação documental, início de visita entre simulação/confirmação, revisões, catorze visitas semanais, cancelamento sem apagar registos e reversão perante falha de auditoria.
- Chromium real: seis visitas semanais (duas no mesmo dia), edição por nomes, rascunhos por cliente e reload, resposta perdida após commit, resposta de outro cliente recusada, repetição exata, geração offline recuperada, mudança de conta, falha de armazenamento, texto literal e larguras 320/390/1440. Contraste de campos/legendas revisto em claro/escuro; imagens em `reports/field-visual/client-services-*`.
- Ensaio conjunto: `/tmp/cw-seasonal-runtime/run-1789720093197` — API sazonal, interface, preços anteriores e interligações aprovados. Regressão anterior incluiu o editor de preços já existente. A revisão final da proteção de faturação manual, automação mensal e Finance OS passou em `run-1789720155955`, com 395 unitários reconfirmados.
- Sintaxe: 552 JS backend, 182 frontend e 56 scripts inline. Cache v77. Inventário de páginas atualizado; runner passa de 146 para 148 grupos.

O ambiente local usa PGlite/socket com multiplexagem e base descartável, não PostgreSQL 16 nativo. Um primeiro arranque sem configuração de compatibilidade falhou por colisão de prepared statements; a configuração local foi corrigida. Um encerramento inicial do adaptador falhou depois de o script aprovar; os ensaios finais terminam com sucesso. Migração nativa, concorrência real e restauro devem ser confirmados no workflow do commit publicado, não inferidos destes ensaios locais.

## Limites e continuação

Publicação atual: **autorizada explicitamente pelo proprietário em 18/09**, que respondeu «Sim continua» à pergunta sobre publicar o lote na branch de trabalho do repositório público. A autorização resolve a recusa anterior da revisão automática. O commit de implementação é `664f311ca2206cd77208195de67b46e9adbc9b75`, árvore `4319b032d7add7b6e818215760d5c4cb7e9a5eb8`. A branch remota foi reconfirmada em `62fb82255301393a96df2c95f1749f12af852ecd`; a publicação e o CI nativo desta alteração são o próximo passo.

Não houve alteração de clientes reais, emissão fiscal, fornecedores, main ou VPS. Esta entrega não certifica todos os requisitos do sistema. Continuam próprios os preços por visita no acordo sazonal, exceções datadas/cadências adicionais, validação física e os restantes itens da matriz. Depois de confirmado o CI/restauro, retomar relatórios pelos alertas, fotografias autorizadas, relatórios EXTRA e fontes Unicode/traduções. Não voltar a tratar o exemplo de três visitas como uma frequência obrigatória.
