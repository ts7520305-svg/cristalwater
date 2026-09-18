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

O ambiente local usa PGlite/socket com multiplexagem e base descartável, não PostgreSQL 16 nativo. Um primeiro arranque sem configuração de compatibilidade falhou por colisão de prepared statements; a configuração local foi corrigida. Um encerramento inicial do adaptador falhou depois de o script aprovar; os ensaios finais terminam com sucesso. A migração nativa, a concorrência real e o restauro foram posteriormente confirmados no workflow final identificado abaixo; essa aprovação não é inferida dos ensaios locais.

## Primeira validação nativa e correção de apresentação

O primeiro CI `35325817914`, no commit `5addca4fcabc503f73982ab273612ca57b248c6e`, aprovou 147/148 grupos, 395 unitários/63 ficheiros, quatro testes técnicos, 21 scripts do gate de navegador, sintaxe e migração aditiva. A API sazonal passou em 3163 ms, incluindo concorrência real em PostgreSQL 16. A interface parou no ensaio de 320 px: o seletor de atribuição tinha 35 px de overflow interno. O restauro foi omitido por depender da aprovação integral; este CI não aprova o lote completo.

A diferença foi reproduzida com Chromium 149, versão principal usada pelo CI: um seletor nativo de 208 px de área útil devolvia 710 px de largura de conteúdo para um nome longo; com a apresentação corrigida, ambos medem 208 px. O seletor mantém as opções e navegação nativas, usa seta explícita e reticências, e o nome completo da instalação/atribuição aparece em texto com quebra de linha. Não se abreviam nomes nem se retira a verificação de overflow. O ensaio passou a usar nomes longos e confirmar a sua apresentação integral; o diagnóstico identifica o campo exato. Cache v78.

Interface completa aprovada com Chromium 149 em `run-1789722098016`, incluindo larguras 320/390/1440, contraste claro/escuro, seis visitas, rascunhos, resposta perdida, confirmação trocada, repetição, offline, falha de armazenamento e mudança de sessão. A captura de 320 px foi revista. A versão local anterior de Chromium era 153, pelo que a passagem nela não provava a apresentação do navegador do CI. O novo commit foi depois aprovado no workflow completo e no restauro, conforme o registo seguinte.

## Confirmação nativa final

Commit `6225b346c1ad071d86cd3e835edebf1d7b03d174`, árvore `41de68cead5e76761c82544ec95ff2b9abc704e4`, [CI `35327538194`](https://github.com/ts7520305-svg/cristalwater/actions/runs/35327538194), job `105544003874`, concluído com sucesso em 18/09/2026 às 09:19:12 UTC. Os 148 grupos são distintos e têm código zero, incluindo API sazonal (4137 ms) e interface completa com nomes longos (8590 ms). Nenhum grupo foi omitido.

Também aprovados: 395 testes unitários em 63 ficheiros, quatro testes técnicos, 21 scripts do gate de navegador, sintaxe de 552 JS backend/182 frontend/56 inline e 21 migrações aditivas com preservação de dados e equivalência ao esquema atual. O restauro em PostgreSQL 16 recuperou 110 tabelas e 32 ficheiros, com igualdade das linhas e dos hashes dos ficheiros.

A árvore publicada da correção é idêntica à árvore local `71206b443c83903a092b25cdbcfdf29dc5f27e94`, preservada em `backup/seasonal-mobile-local-20260918`. A implementação anterior e a autorização estão em `backup/seasonal-local-20260918`; as duas publicações conservaram o antecessor remoto e não usaram força. Este registo de aprovação altera apenas documentação; a evidência pertence ao commit de código acima.

## Limites e continuação

Publicação atual: **concluída e validada na branch de trabalho**, após autorização explícita do proprietário em 18/09 («Sim continua»). A publicação inicial `5addca4fcabc503f73982ab273612ca57b248c6e` foi seguida pela correção `6225b346c1ad071d86cd3e835edebf1d7b03d174`, aprovada no CI/restauro indicado acima. O primeiro CI de 147/148 grupos é histórico e não substitui a aprovação final.

Não houve alteração de clientes reais, emissão fiscal, fornecedores, main ou VPS. Esta entrega não certifica todos os requisitos do sistema. Continuam próprios os preços por visita no acordo sazonal, exceções datadas/cadências adicionais, validação física e os restantes itens da matriz. Próximo percurso após este lote aprovado: relatórios pelos alertas, fotografias autorizadas, relatórios EXTRA e fontes Unicode/traduções. Não voltar a tratar o exemplo de três visitas como uma frequência obrigatória.
