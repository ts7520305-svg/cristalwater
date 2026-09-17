# TASK215 — Revisões de equipamento em visitas extra e recuperação de envios

## Resultado

O modo de campo permite consultar os planos preventivos e registar a execução tanto em visitas REGULAR como EXTRA. A seleção, a consulta, as notas, o pedido, o comprovativo e os avisos conservam o tipo e o número da visita, a piscina e o plano. Números iguais entre ServiceVisit e ExtraVisit não identificam a mesma intervenção.

A revisão exige visita iniciada e aberta, atribuição atual, plano ativo na versão consultada, observações e confirmação explícita do trabalho. Uma execução por plano/visita avança o calendário e grava o histórico, a auditoria e o comprovativo na mesma transação. Uma falha em qualquer destes registos reverte o conjunto.

## Compatibilidade e dados

A vigésima migração permite uma referência extra na tabela existente de execuções, com chave estrangeira restritiva, índice único por plano/visita extra e restrição de exatamente uma referência regular ou extra. As execuções antigas conservam a visita regular e a resposta histórica; não se reclassificam registos pelo número.

Os consumidores antigos sem contrato tipado conservam as respostas e regras de autorização anteriores. O contrato atual usa `EQUIPMENT_MAINTENANCE` em `FieldWriteRequest`, com conta, UUID, plano e hash do conteúdo completo. Recuperar um comprovativo já emitido devolve apenas a resposta original dessa conta; reatribuição e alterações posteriores não permitem novas escritas sem acesso atual.

Visita fechada/não iniciada, versão alterada, execução duplicada e piscina entretanto alterada geram recusas com comprovativo e sem efeitos. O mesmo pedido recusado nunca começa a aplicar-se automaticamente quando o contexto muda. Reutilizar o UUID com outro conteúdo é conflito.

## Telemóvel e avisos

- Notas guardadas por conta/tipo/visita/plano, com gravação verificada e comparação entre janelas. Quota, corrupção ou conflito conservam os dados anteriores e impedem o envio inseguro.
- Pedido imutável guardado antes da rede. Fecho/recarga da página, perda de resposta e mudança de sessão não descartam a operação. HTTP 202, corpo incompleto e confirmação de outra visita/piscina não retiram a pendência.
- Atualizar a lista e encontrar o plano já avançado não substitui o comprovativo do pedido original. A recuperação usa o mesmo UUID e conteúdo e não repete a manutenção.
- Aviso global inclui pedidos pendentes, recusas por reconhecer e notas não enviadas; a revisão do fim do dia inclui essas pendências. Descartar notas exige ação explícita e não elimina um pedido já iniciado.
- Consulta local identificada com data, conta e visita permite leitura sem rede. Uma recusa atual de acesso não apresenta a consulta antiga como válida. A cache pública v43 inclui o módulo; os dados operacionais continuam fora da cache do service worker.
- Avisos preventivos para EXTRA têm identidade própria; avisos REGULAR antigos mantêm a identidade e os estados de leitura/push. Reatribuição, cancelamento, fecho, plano em pausa e manutenção concluída são reavaliados na leitura e na reconciliação.

O registo da manutenção não conclui a visita, não altera medições/consumos e não cria documentos comerciais. A intervenção física continua a ser confirmada pelo técnico; o comprovativo confirma o registo no servidor.

## Evidência local e publicação

Confirmação final em PostgreSQL 16: [CI 35188698984](https://github.com/ts7520305-svg/cristalwater/actions/runs/35188698984), commit `8de555abda6d648486a7b980f8ce8fa1e249c494`, árvore `6a22afc8a9ba66c94fbfbd06d2cfa442d9470e61`. Aprovados 118/118 grupos, 388 testes unitários, quatro testes técnicos, 17 scripts de navegador, 20 migrações e sintaxe de 537 ficheiros backend. Restauro de 110 tabelas e 31 ficheiros com linhas e hashes iguais. Esta atualização posterior altera apenas documentação.

- `run-1789624365514`: API antiga, avisos regulares e formulário real regular aprovados. A asserção antiga de painel vazio numa visita extra foi atualizada para a consulta extra sem planos; o ensaio de isolamento aprovado em `run-1789624693362`.
- `run-1789624993582`: novo grupo completo extra, formulário regular, correção extra e recuperação das escritas de campo aprovados. Inclui seis pedidos iguais concorrentes, pedidos distintos concorrentes, resposta perdida depois de gravar, registo único, reatribuição, rollback de auditoria, avisos tipados e recarga do formulário real em Chromium.
- Navegador: recusa reconhecida sem apagar o comprovativo, HTTP 202/corpo incompleto/tipo trocado, plano avançado sem confirmação, rascunho após recarga, duas janelas, quota/corrupção, consulta offline, mudança de conta e larguras 320/390/1280 px aprovados.
- 388 testes unitários, quatro testes técnicos, 17 scripts de navegador e sintaxe de 537 ficheiros backend aprovados localmente. Runner integrado passa a 118 grupos. Capturas de pendência/confirmação revistas; o erro de transporte é apresentado em português.
- As 20 migrações passaram no ensaio local, com esquema final idêntico ao Prisma. O ensaio verifica dados antigos, exclusividade da referência, chave estrangeira, unicidade e bloqueio de remoção, antes de comparar o esquema. Violações esperadas são capturadas dentro de subtransações PostgreSQL para não depender da tradução de erros do adaptador local.

Código publicado e CI/restauro confirmados na branch de trabalho. Backup local `backup/task215-local-20260917`; PNG preexistente preservado com SHA256 `fba3c8189d9e0a31d96b378550736f865d30a4019f5e8d4d4487b15cfc543a71`. Impedimentos/regressos ExtraVisit e a concorrência geral dos rascunhos modernos continuam como trabalho seguinte.
